import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getPublicCatalogSnapshot } from '@/lib/publicCatalogServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Provider = 'groq' | 'openrouter' | 'gemini';
type ProductCard = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  href: string;
  hasVariants?: boolean;
  variantColors?: unknown;
  variantSizes?: unknown;
  colors?: unknown;
  sizes?: unknown;
  variants?: unknown;
  variantMatrix?: unknown;
  colorImages?: unknown;
};

type ChatMessage = { role: 'customer' | 'salaar'; text: string; createdAt?: string };

const WHATSAPP_NUMBER = '03238878009';
const SYSTEM_PROMPT = `You are Salaar, a human-style salesman for PrimeHubMall Pakistan.
Reply in short Roman Urdu/English matching the customer's length. Use pyar, adab and ehtram. Never write long AI essays, menus, or "press 1" prompts.
You help with bangles, jewellery, watches, retail/wholesale shopping, Prime Skill, Reseller Club, cart/order questions and general store help.
Store facts:
- Prime Skill is PrimeHubMall's practical skill area. Send customer to /prime-skill when relevant.
- Reseller Club is for wholesale/reseller customers. Send customer to /reseller-club when relevant.
- Ready/order lock flow: customer confirms cart/details, then Rs 300 advance locks the order. Complete ready video is shared on WhatsApp, remaining payment follows, then dispatch.
- Human support WhatsApp: ${WHATSAPP_NUMBER}.
If product cards are supplied below, mention them naturally and do not invent prices or products outside that list.
If confused, payment is stuck, customer is angry, or you are not confident, give ${WHATSAPP_NUMBER} and keep it short.`;

let rotationCursor = 0;

function splitKeys(value?: string): string[] {
  if (!value) return [];
  return value.split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean);
}

function providerKeys(provider: Provider): string[] {
  if (provider === 'groq') return [...splitKeys(process.env.GROQ_API_KEYS), ...splitKeys(process.env.GROQ_API_KEY)];
  if (provider === 'openrouter') return [...splitKeys(process.env.OPENROUTER_API_KEYS), ...splitKeys(process.env.OPENROUTER_API_KEY)];
  return [...splitKeys(process.env.GEMINI_API_KEYS), ...splitKeys(process.env.GEMINI_API_KEY)];
}

function rotated<T>(items: T[], offset: number): T[] {
  if (!items.length) return items;
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function cleanText(value: unknown, max = 600): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safePrice(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function productName(product: any): string {
  return cleanText(product?.title || product?.name || product?.productName || 'PrimeHub product', 100);
}

function productImage(product: any): string {
  if (typeof product?.imageUrl === 'string' && product.imageUrl) return product.imageUrl;
  if (typeof product?.image === 'string' && product.image) return product.image;
  if (Array.isArray(product?.images)) {
    const first = product.images.find((item: any) => typeof item === 'string' || item?.url || item?.imageUrl);
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
    if (first?.imageUrl) return first.imageUrl;
  }
  return '';
}

function searchable(product: any): string {
  const tags = Array.isArray(product?.tags) ? product.tags.join(' ') : '';
  return [product?.title, product?.name, product?.category, product?.subcategory, product?.description, product?.material, product?.color, tags]
    .filter(Boolean).join(' ').toLowerCase();
}

function wantsProducts(message: string): boolean {
  return /(bangle|bangles|kara|karray|jewel|watch|product|item|deal|dikha|show|chahi|price|rate|budget|under|kam|wholesale|retail|gift|set)/i.test(message);
}

function productTerms(message: string): string[] {
  const ignored = new Set(['mujhe','mery','meri','mera','koi','kuch','aur','show','dikhao','dikha','chahiye','chahi','price','rate','under','tak','se','kam','ka','ki','ke','hai','hain','please','plz','want','need','product','products','item','items']);
  return message.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !ignored.has(word));
}

function pickProducts(products: any[], message: string, shown: string[]): ProductCard[] {
  if (!wantsProducts(message)) return [];
  const shownSet = new Set(shown.map(String));
  const terms = productTerms(message);
  const scored = products
    .filter((p) => p && p.id != null && !shownSet.has(String(p.id)))
    .map((p) => {
      const hay = searchable(p);
      const score = terms.reduce((sum, term) => sum + (hay.includes(term) ? 2 : 0), 0) + (p?.active === false ? -20 : 0);
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);
  const matching = scored.filter((entry) => entry.score > 0);
  const source = matching.length ? matching : scored;
  return source.slice(0, 3).map(({ p }) => {
    const price = safePrice(p?.price || p?.salePrice || p?.retailPrice);
    const originalPrice = safePrice(p?.originalPrice || p?.compareAtPrice || p?.retailPrice || price);
    return {
      id: String(p.id),
      name: productName(p),
      price,
      originalPrice: originalPrice || price,
      image: productImage(p),
      href: `/product/${encodeURIComponent(String(p.id))}`,
      hasVariants: Boolean(p?.hasVariants || p?.variants?.length || p?.variantMatrix?.length || p?.variantColors?.length || p?.variantSizes?.length),
      variantColors: p?.variantColors,
      variantSizes: p?.variantSizes,
      colors: p?.colors,
      sizes: p?.sizes,
      variants: p?.variants,
      variantMatrix: p?.variantMatrix,
      colorImages: p?.colorImages,
    };
  });
}

function deterministicReply(message: string, products: ProductCard[]): { text: string; needYou?: boolean; link?: { href: string; label: string } } {
  const m = message.toLowerCase();
  if (/prime\s*skill|skill kya|skills?/.test(m)) {
    return { text: 'Ji, Prime Skill se practical skills start kar sakte hain. Main aapko seedha wahan le jata hoon.', link: { href: '/prime-skill', label: 'Open Prime Skill' } };
  }
  if (/reseller|wholesale|resale/.test(m) && !products.length) {
    return { text: 'Ji, Reseller Club wholesale/reselling ke liye hai. Aap wahan join/details dekh sakte hain.', link: { href: '/reseller-club', label: 'Open Reseller Club' } };
  }
  if (/payment.*(stuck|masla|issue)|samajh nahi|ghussa|angry|complain|problem/.test(m)) {
    return { text: `Ji, is case mein team ko involve karte hain. WhatsApp ${WHATSAPP_NUMBER} par message kar dein.`, needYou: true };
  }
  if (/ready|order lock|advance|300/.test(m)) {
    return { text: 'Ji. Order lock ke liye Rs 300 advance hota hai. Ready video WhatsApp par share hoti hai, phir remaining payment aur dispatch.' };
  }
  if (/shipping|delivery|dispatch/.test(m)) {
    return { text: 'Ji, Pakistan delivery available hai. Final delivery/dispatch detail order aur city ke mutabiq confirm hoti hai.' };
  }
  if (/return|exchange|refund/.test(m)) {
    return { text: `Ji, return/exchange case item aur order condition dekh kar team confirm karti hai. Zarurat ho to ${WHATSAPP_NUMBER} par help mil jayegi.` };
  }
  if (products.length) {
    return { text: products.length > 1 ? 'Ji, ye options dekhain. Pasand aye to yahin cart mein add kar dein.' : 'Ji, ye option dekhain. Pasand aye to cart mein add kar dein.' };
  }
  if (/^(hi|hello|hey|salam|assalam|aoa)/i.test(message.trim())) {
    return { text: 'Wa Alaikum Assalam ji 👋 Main Salaar hoon. Bangles, jewellery, watches ya order help — jo chahiye batayein.' };
  }
  return { text: `Ji, main help karta hoon. Product, order, Prime Skill ya Reseller Club — jo masla hai short mein batayein. Zarurat par ${WHATSAPP_NUMBER} bhi available hai.` };
}

async function callOpenAiCompatible(baseUrl: string, apiKey: string, model: string, user: string, products: ProductCard[], history: ChatMessage[]): Promise<string> {
  const productContext = products.length ? `\nProducts available now:\n${products.map((p) => `- ${p.name} | Rs ${p.price} | id ${p.id}`).join('\n')}` : '';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 180,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}${productContext}` },
        ...history.slice(-8).map((m) => ({ role: m.role === 'customer' ? 'user' : 'assistant', content: m.text })),
        { role: 'user', content: user },
      ],
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`provider ${response.status}`);
  const data = await response.json();
  const text = cleanText(data?.choices?.[0]?.message?.content, 700);
  if (!text) throw new Error('empty provider reply');
  return text;
}

async function callGemini(apiKey: string, model: string, user: string, products: ProductCard[], history: ChatMessage[]): Promise<string> {
  const productContext = products.length ? `\nProducts available now:\n${products.map((p) => `- ${p.name} | Rs ${p.price} | id ${p.id}`).join('\n')}` : '';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}${productContext}` }] },
      contents: [
        ...history.slice(-8).map((m) => ({ role: m.role === 'customer' ? 'user' : 'model', parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: user }] },
      ],
      generationConfig: { temperature: 0.35, maxOutputTokens: 180 },
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`gemini ${response.status}`);
  const data = await response.json();
  const text = cleanText(data?.candidates?.[0]?.content?.parts?.[0]?.text, 700);
  if (!text) throw new Error('empty Gemini reply');
  return text;
}

async function llmReply(user: string, products: ProductCard[], history: ChatMessage[]): Promise<{ text: string; provider?: Provider }> {
  const providers: Provider[] = ['groq', 'openrouter', 'gemini'];
  const start = rotationCursor++;
  for (const provider of rotated(providers, start)) {
    const keys = rotated(providerKeys(provider), start);
    for (const key of keys) {
      try {
        if (provider === 'groq') {
          const text = await callOpenAiCompatible('https://api.groq.com/openai/v1', key, process.env.SALAAR_GROQ_MODEL || 'llama-3.3-70b-versatile', user, products, history);
          return { text, provider };
        }
        if (provider === 'openrouter') {
          const text = await callOpenAiCompatible('https://openrouter.ai/api/v1', key, process.env.SALAAR_OPENROUTER_MODEL || 'google/gemini-2.0-flash-001', user, products, history);
          return { text, provider };
        }
        const text = await callGemini(key, process.env.SALAAR_GEMINI_MODEL || 'gemini-2.5-flash', user, products, history);
        return { text, provider };
      } catch (error) {
        console.warn(`Salaar ${provider} key failed; rotating`, error);
      }
    }
  }
  throw new Error('No working Salaar LLM provider key');
}

async function saveMessage(sessionId: string, role: 'customer' | 'salaar', text: string, extra: Record<string, unknown> = {}) {
  try {
    const db = getAdminDb();
    const conversationRef = db.collection('salaar_conversations').doc(sessionId);
    const now = new Date();
    await Promise.all([
      conversationRef.set({ sessionId, lastMessage: text.slice(0, 160), lastRole: role, updatedAt: now, status: 'AUTO' }, { merge: true }),
      conversationRef.collection('messages').add({ role, text, createdAt: now, ...extra }),
    ]);
  } catch (error) {
    console.warn('Salaar Firestore persistence unavailable', error);
  }
}

async function loadHistory(sessionId: string): Promise<ChatMessage[]> {
  try {
    const db = getAdminDb();
    const snap = await db.collection('salaar_conversations').doc(sessionId).collection('messages').orderBy('createdAt', 'desc').limit(30).get();
    return snap.docs.reverse().map((doc) => {
      const data = doc.data();
      return { role: data.role === 'customer' ? 'customer' : 'salaar', text: cleanText(data.text, 1000), createdAt: data.createdAt?.toDate?.()?.toISOString?.() } as ChatMessage;
    });
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = cleanText(url.searchParams.get('sessionId'), 100);
  if (!sessionId) return NextResponse.json({ messages: [] });
  return NextResponse.json({ messages: await loadHistory(sessionId) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = cleanText(body?.sessionId, 100) || crypto.randomUUID();
    const message = cleanText(body?.message, 600);
    const shownProductIds = Array.isArray(body?.shownProductIds) ? body.shownProductIds.map((id: unknown) => String(id)).slice(-100) : [];
    if (!message) return NextResponse.json({ error: 'Message required.' }, { status: 400 });

    const [{ products }, history] = await Promise.all([getPublicCatalogSnapshot(), loadHistory(sessionId)]);
    const cards = pickProducts(Array.isArray(products) ? products : [], message, shownProductIds);
    await saveMessage(sessionId, 'customer', message);

    const deterministic = deterministicReply(message, cards);
    let reply = deterministic.text;
    let provider: Provider | undefined;

    // Keep critical store flows deterministic; use LLM for natural selling/help when configured.
    const shouldUseLlm = !deterministic.needYou && !(/prime\s*skill|reseller|payment.*(stuck|masla|issue)|ready|order lock|advance|shipping|delivery|return|exchange|refund/i.test(message));
    if (shouldUseLlm) {
      try {
        const ai = await llmReply(message, cards, history);
        reply = ai.text;
        provider = ai.provider;
      } catch {
        // The deterministic reply keeps Salaar useful even when no provider key is configured.
      }
    }

    const needYou = Boolean(deterministic.needYou || /not sure|confus|payment stuck|WhatsApp 03238878009/i.test(reply));
    await saveMessage(sessionId, 'salaar', reply, { provider: provider || 'fallback', productIds: cards.map((p) => p.id), needYou });

    return NextResponse.json({
      sessionId,
      reply,
      products: cards,
      provider: provider || 'fallback',
      needYou,
      whatsapp: needYou ? `https://wa.me/923238878009` : null,
      link: deterministic.link || null,
    });
  } catch (error) {
    console.error('Native Salaar chat failed', error);
    return NextResponse.json({ reply: `Ji, abhi short technical issue hai. WhatsApp ${WHATSAPP_NUMBER} par message kar dein.`, provider: 'fallback', needYou: true, whatsapp: 'https://wa.me/923238878009' }, { status: 200 });
  }
}
