import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getSalaarCatalogSnapshot, SALAAR_CATEGORY_BATCH_SIZE } from '@/lib/salaarCatalogCache';
import { getSalaarStoreKnowledgeSnapshot } from '@/lib/salaarStoreKnowledge';
import {
  directStoreKnowledgeReply,
  storeKnowledgePromptContext,
  type SalaarStoreKnowledge,
} from '@/lib/salaarStoreKnowledgeCore';
import {
  effectiveProductQuery,
  intentNeedsLlm,
  parseSalesIntent,
  rankProductsForIntent,
  type SalesIntent,
} from '@/lib/salaarSalesIntent';

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
const SYSTEM_PROMPT = `You are Salaar, a professional human-style salesman for PrimeHubMall Pakistan.
Reply in short, natural Roman Urdu/English matching the customer's language and length. Use pyar, adab and ehtram. Never sound like a menu-driven bot and never write long AI essays.
Think like a real salesman: understand what the customer is trying to buy or ask, use the supplied sales intent and grounded product/store context, ask one short clarification only when genuinely needed, and keep the conversation moving naturally.
You help with bangles, jewellery, watches, retail/wholesale shopping, Prime Skill, Reseller Club, cart/order questions and general store help.
Known operational flow that must stay grounded:
- Prime Skill is PrimeHubMall's practical skill area. Send customer to /prime-skill when relevant.
- Reseller Club is for wholesale/reseller customers. Send customer to /reseller-club when relevant.
- Ready/order lock flow: customer confirms cart/details, then Rs 300 advance locks the order. Complete ready video is shared on WhatsApp, remaining payment follows, then dispatch.
- Human support WhatsApp: ${WHATSAPP_NUMBER}.
Rules:
- Never invent a price, product, stock state, policy, deal, discount or store fact that is not supplied in grounded context.
- Treat the Store Knowledge block as current admin-managed website truth for this turn.
- If product cards are supplied below, refer to them naturally. Do not claim another product exists unless it is in grounded context.
- If a store/deal fact is not supplied, say briefly that you need the live store detail instead of guessing.
- If confused, payment is stuck, customer is angry, or you are not confident about a sensitive fact, involve human support at ${WHATSAPP_NUMBER} and keep it short.`;

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

function pickProducts(products: any[], intent: SalesIntent, shown: string[]): ProductCard[] {
  const ranked = rankProductsForIntent(products, intent, shown).slice(0, SALAAR_CATEGORY_BATCH_SIZE);
  return ranked.map((p) => {
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

function priceSummary(intent: SalesIntent): string {
  const { minPrice, maxPrice, targetPrice } = intent.filters;
  if (minPrice != null && maxPrice != null) return `Rs ${minPrice.toLocaleString()} se Rs ${maxPrice.toLocaleString()} tak`;
  if (maxPrice != null) return `Rs ${maxPrice.toLocaleString()} tak`;
  if (minPrice != null) return `Rs ${minPrice.toLocaleString()} se upar`;
  if (targetPrice != null) return `Rs ${targetPrice.toLocaleString()} ke qareeb`;
  return '';
}

function deterministicReply(
  message: string,
  intent: SalesIntent,
  products: ProductCard[],
  knowledge: SalaarStoreKnowledge | null,
): { text: string; needYou?: boolean; link?: { href: string; label: string } } {
  const m = message.toLowerCase();

  if (intent.kind === 'greeting') {
    return { text: 'Wa Alaikum Assalam ji 👋 Main Salaar hoon. Jo chahiye batayein — main aapko suitable option dhoond deta hoon.' };
  }
  if (/prime\s*skill|skill kya|skills?/.test(m)) {
    return { text: 'Ji, Prime Skill se practical skills start kar sakte hain. Main aapko seedha wahan le jata hoon.', link: { href: '/prime-skill', label: 'Open Prime Skill' } };
  }
  if (intent.kind === 'wholesale' && !products.length) {
    return { text: 'Ji, wholesale/reselling ke liye PrimeHub Reseller Club available hai. Aap details dekh sakte hain.', link: { href: '/reseller-club', label: 'Open Reseller Club' } };
  }
  if (intent.kind === 'support') {
    return { text: `Ji, is case mein team ko involve karte hain. WhatsApp ${WHATSAPP_NUMBER} par message kar dein.`, needYou: true };
  }
  if (intent.kind === 'order' && /ready|order lock|advance|300/i.test(m)) {
    return { text: 'Ji. Order lock ke liye Rs 300 advance hota hai. Ready video WhatsApp par share hoti hai, phir remaining payment aur dispatch.' };
  }

  if (knowledge) {
    const grounded = directStoreKnowledgeReply(message, knowledge);
    if (grounded) return grounded;
  }

  if (intent.kind === 'delivery') {
    return { text: 'Ji, Pakistan delivery available hai. Final delivery/dispatch detail order aur city ke mutabiq confirm hoti hai.' };
  }
  if (intent.kind === 'policy') {
    return { text: `Ji, return/exchange case item aur order condition dekh kar team confirm karti hai. Zarurat ho to ${WHATSAPP_NUMBER} par help mil jayegi.` };
  }
  if (products.length) {
    const budget = priceSummary(intent);
    const category = intent.filters.category || intent.filters.subcategory || '';
    const detail = [category, budget].filter(Boolean).join(' · ');
    const moreText = intent.followUp.more ? 'Ji, ye next options dekhain.' : products.length > 1 ? 'Ji, ye suitable options dekhain.' : 'Ji, ye matching option dekhain.';
    return { text: `${moreText}${detail ? ` ${detail}.` : ''} Pasand aye to yahin cart mein add kar dein.` };
  }
  if (intent.wantsProducts) {
    const budget = priceSummary(intent);
    const detail = [intent.filters.category, intent.filters.color, intent.filters.material, budget].filter(Boolean).join(' · ');
    return { text: detail ? `Ji, ${detail} ke mutabiq abhi matching product nahi mila. Aap budget ya choice thori change kar dein, main dobara dekh leta hoon.` : 'Ji, is request ka matching product current catalog mein nahi mila. Thora detail bata dein — category, budget, color ya style — main sahi options nikal deta hoon.' };
  }
  if (intent.kind === 'deal') {
    return { text: 'Ji, deal ka current detail live Store Knowledge se verify karke hi batana chahiye. Deal ka naam bata dein — jaise Big Deal — main exact current detail bata deta hoon.' };
  }
  return { text: 'Ji, batayein aap kya dhoond rahe hain ya kis cheez mein help chahiye. Main short mein guide karta hoon.' };
}

function llmProductContext(products: ProductCard[]) {
  return products.slice(0, 10);
}

function llmGrounding(intent: SalesIntent, products: ProductCard[], knowledge: SalaarStoreKnowledge | null) {
  const contextProducts = llmProductContext(products);
  const productContext = contextProducts.length
    ? `\nGrounded products available now:\n${contextProducts.map((p, index) => `${index + 1}. ${p.name} | Rs ${p.price} | id ${p.id}`).join('\n')}`
    : '\nNo grounded product cards are available for this turn.';
  const knowledgeContext = knowledge
    ? `\nStore Knowledge (safe, admin-managed, current snapshot):\n${storeKnowledgePromptContext(knowledge)}`
    : '\nStore Knowledge is temporarily unavailable for this turn. Do not guess store facts.';
  return `\nParsed sales intent: ${intent.summary || intent.kind}. Confidence=${intent.confidence}.${productContext}${knowledgeContext}`;
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  user: string,
  products: ProductCard[],
  history: ChatMessage[],
  intent: SalesIntent,
  knowledge: SalaarStoreKnowledge | null,
): Promise<string> {
  const grounding = llmGrounding(intent, products, knowledge);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 180,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}${grounding}` },
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

async function callGemini(
  apiKey: string,
  model: string,
  user: string,
  products: ProductCard[],
  history: ChatMessage[],
  intent: SalesIntent,
  knowledge: SalaarStoreKnowledge | null,
): Promise<string> {
  const grounding = llmGrounding(intent, products, knowledge);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}${grounding}` }] },
      contents: [
        ...history.slice(-8).map((m) => ({ role: m.role === 'customer' ? 'user' : 'model', parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: user }] },
      ],
      generationConfig: { temperature: 0.3, maxOutputTokens: 180 },
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`gemini ${response.status}`);
  const data = await response.json();
  const text = cleanText(data?.candidates?.[0]?.content?.parts?.[0]?.text, 700);
  if (!text) throw new Error('empty Gemini reply');
  return text;
}

async function llmReply(
  user: string,
  products: ProductCard[],
  history: ChatMessage[],
  intent: SalesIntent,
  knowledge: SalaarStoreKnowledge | null,
): Promise<{ text: string; provider?: Provider }> {
  const providers: Provider[] = ['groq', 'openrouter', 'gemini'];
  const start = rotationCursor++;
  for (const provider of rotated(providers, start)) {
    const keys = rotated(providerKeys(provider), start);
    for (const key of keys) {
      try {
        if (provider === 'groq') {
          const text = await callOpenAiCompatible('https://api.groq.com/openai/v1', key, process.env.SALAAR_GROQ_MODEL || 'llama-3.3-70b-versatile', user, products, history, intent, knowledge);
          return { text, provider };
        }
        if (provider === 'openrouter') {
          const text = await callOpenAiCompatible('https://openrouter.ai/api/v1', key, process.env.SALAAR_OPENROUTER_MODEL || 'google/gemini-2.0-flash-001', user, products, history, intent, knowledge);
          return { text, provider };
        }
        const text = await callGemini(key, process.env.SALAAR_GEMINI_MODEL || 'gemini-2.5-flash', user, products, history, intent, knowledge);
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
    const shownProductIds = Array.isArray(body?.shownProductIds) ? body.shownProductIds.map((id: unknown) => String(id)).slice(-400) : [];
    if (!message) return NextResponse.json({ error: 'Message required.' }, { status: 400 });

    const knowledgePromise = getSalaarStoreKnowledgeSnapshot().catch((error) => {
      console.warn('Salaar Store Knowledge unavailable for this turn', error);
      return null;
    });
    const [catalog, knowledge, history] = await Promise.all([
      getSalaarCatalogSnapshot(),
      knowledgePromise,
      loadHistory(sessionId),
    ]);
    const catalogContext = {
      products: Array.isArray(catalog.products) ? catalog.products : [],
      categories: Array.isArray(catalog.categories) ? catalog.categories : [],
    };
    const rawIntent = parseSalesIntent(message, catalogContext);
    const queryMessage = effectiveProductQuery(message, history, catalogContext);
    const intent = parseSalesIntent(queryMessage, catalogContext);
    intent.followUp.more = rawIntent.followUp.more;
    intent.followUp.cheaper = rawIntent.followUp.cheaper || intent.followUp.cheaper;
    intent.followUp.pricier = rawIntent.followUp.pricier || intent.followUp.pricier;
    intent.followUp.compare = rawIntent.followUp.compare || intent.followUp.compare;
    if (rawIntent.followUp.referencedPosition != null) intent.followUp.referencedPosition = rawIntent.followUp.referencedPosition;

    const cards = pickProducts(catalogContext.products, intent, shownProductIds);
    await saveMessage(sessionId, 'customer', message, {
      salesIntent: {
        kind: rawIntent.kind,
        confidence: rawIntent.confidence,
        filters: rawIntent.filters,
        followUp: rawIntent.followUp,
        summary: rawIntent.summary,
      },
      knowledgeRefreshedAt: knowledge?.refreshedAt || null,
    });

    const deterministic = deterministicReply(message, intent, cards, knowledge);
    let reply = deterministic.text;
    let provider: Provider | undefined;

    if (!deterministic.needYou && intentNeedsLlm(intent)) {
      try {
        const ai = await llmReply(message, cards, history, intent, knowledge);
        reply = ai.text;
        provider = ai.provider;
      } catch {
        // Grounded deterministic reply keeps Salaar useful when providers are unavailable.
      }
    }

    const needYou = Boolean(deterministic.needYou || /not sure|confus|payment stuck|WhatsApp 03238878009/i.test(reply));
    await saveMessage(sessionId, 'salaar', reply, {
      provider: provider || 'deterministic',
      productIds: cards.map((p) => p.id),
      needYou,
      knowledgeSources: knowledge?.sources || null,
      knowledgeRefreshedAt: knowledge?.refreshedAt || null,
      salesIntent: {
        kind: intent.kind,
        confidence: intent.confidence,
        filters: intent.filters,
        followUp: intent.followUp,
        summary: intent.summary,
      },
    });

    return NextResponse.json({
      sessionId,
      reply,
      products: cards,
      provider: provider || 'deterministic',
      needYou,
      whatsapp: needYou ? `https://wa.me/923238878009` : null,
      link: deterministic.link || null,
      salesIntent: {
        kind: intent.kind,
        confidence: intent.confidence,
        filters: intent.filters,
        followUp: intent.followUp,
      },
      catalog: {
        source: catalog.source,
        batchSize: SALAAR_CATEGORY_BATCH_SIZE,
        returned: cards.length,
        refreshedAt: catalog.refreshedAt,
      },
      storeKnowledge: knowledge ? {
        sources: knowledge.sources,
        refreshedAt: knowledge.refreshedAt,
        priceBuckets: knowledge.priceBuckets.length,
        weeklyDeals: knowledge.weeklyDeals.length,
        hasBigDeal: Boolean(knowledge.bigDeal),
      } : null,
    });
  } catch (error) {
    console.error('Native Salaar chat failed', error);
    return NextResponse.json({ reply: `Ji, abhi short technical issue hai. WhatsApp ${WHATSAPP_NUMBER} par message kar dein.`, provider: 'fallback', needYou: true, whatsapp: 'https://wa.me/923238878009' }, { status: 200 });
  }
}
