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
import {
  runSalaarAi,
  sanitizeSalaarImageUrls,
  type SalaarProvider,
} from '@/lib/salaarAiRouter';
import {
  parseSalaarVisionAnalysis,
  SALAAR_VISION_ANALYSIS_SYSTEM,
  visionCatalogQuery,
  type SalaarVisionAnalysis,
} from '@/lib/salaarVisionCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

type ChatMessage = { role: 'customer' | 'salaar'; text: string; createdAt?: string; imageUrls?: string[] };

const WHATSAPP_NUMBER = '03238878009';
const DEFAULT_IMAGE_MESSAGE = 'Is image ko dekh kar design, color aur matching PrimeHub products ke bare mein help karein.';
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
- If an image is supplied, inspect it carefully and answer only what can actually be inferred from the image. Never claim an exact product match unless a grounded product card supports it.
- If a store/deal fact is not supplied, say briefly that you need the live store detail instead of guessing.
- If confused, payment is stuck, customer is angry, or you are not confident about a sensitive fact, involve human support at ${WHATSAPP_NUMBER} and keep it short.`;

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
    const price = safePrice(p?.salePrice || p?.price || p?.retailPrice);
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

function imageMatchRequest(message: string, wasImageOnly: boolean) {
  if (wasImageOnly) return true;
  return /(jaisa|jaisi|same|similar|matching|match|milta|milti|available|product|option|dikha|show|chahi|find|search)/i.test(message);
}

function deterministicReply(
  message: string,
  intent: SalesIntent,
  products: ProductCard[],
  knowledge: SalaarStoreKnowledge | null,
  hasImage: boolean,
): { text: string; needYou?: boolean; link?: { href: string; label: string } } {
  const m = message.toLowerCase();

  if (intent.kind === 'greeting') {
    return { text: 'Wa Alaikum Assalam ji 👋 Main Salaar hoon. Jo chahiye batayein — main aapko suitable option dhoond deta hoon.' };
  }
  if (intent.requiresVision && !hasImage) {
    return { text: 'Ji, image bhej dein. Main design/color/style dekh kar aapko relevant PrimeHub options guide karunga.' };
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
    const category = intent.filters.category || intent.filters.subcategory || intent.filters.priceBucketLabel || '';
    const smart = intent.sortBy === 'latest' ? 'latest' : intent.sortBy === 'cheapest' ? 'sab se budget-friendly' : intent.sortBy === 'premium' ? 'premium' : intent.sortBy === 'discount' ? 'discounted' : '';
    const detail = [category, budget, smart].filter(Boolean).join(' · ');
    const moreText = intent.followUp.more ? 'Ji, ye next options dekhain.' : products.length > 1 ? 'Ji, ye suitable options dekhain.' : 'Ji, ye matching option dekhain.';
    return { text: `${moreText}${detail ? ` ${detail}.` : ''} Pasand aye to yahin cart mein add kar dein.` };
  }
  if (intent.wantsProducts) {
    const budget = priceSummary(intent);
    const detail = [intent.filters.category, intent.filters.color, intent.filters.material, intent.filters.priceBucketLabel, budget].filter(Boolean).join(' · ');
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

async function llmReply(
  user: string,
  products: ProductCard[],
  history: ChatMessage[],
  intent: SalesIntent,
  knowledge: SalaarStoreKnowledge | null,
  imageUrls: string[],
): Promise<{ text: string; provider: SalaarProvider; vision: boolean }> {
  const grounding = llmGrounding(intent, products, knowledge);
  return runSalaarAi({
    system: `${SYSTEM_PROMPT}${grounding}`,
    user,
    history,
    imageUrls,
  });
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
      return {
        role: data.role === 'customer' ? 'customer' : 'salaar',
        text: cleanText(data.text, 1000),
        createdAt: data.createdAt?.toDate?.()?.toISOString?.(),
        imageUrls: sanitizeSalaarImageUrls(data.imageUrls),
      } as ChatMessage;
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
    const imageUrls = sanitizeSalaarImageUrls(
      Array.isArray(body?.imageUrls) ? body.imageUrls : body?.imageUrl ? [body.imageUrl] : [],
    );
    const customerMessage = cleanText(body?.message, 600);
    const message = customerMessage || (imageUrls.length ? DEFAULT_IMAGE_MESSAGE : '');
    const shownProductIds = Array.isArray(body?.shownProductIds) ? body.shownProductIds.map((id: unknown) => String(id)).slice(-400) : [];
    if (!message) return NextResponse.json({ error: 'Message or image required.' }, { status: 400 });

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
      priceBuckets: knowledge?.priceBuckets || [],
    };

    const rawIntent = parseSalesIntent(message, catalogContext);
    const queryMessage = effectiveProductQuery(message, history, catalogContext);
    let intent = parseSalesIntent(queryMessage, catalogContext);
    let visionAnalysis: SalaarVisionAnalysis | null = null;
    let provider: SalaarProvider | undefined;
    let visionUsed = false;

    if (imageUrls.length > 0) {
      try {
        const visual = await runSalaarAi({
          system: SALAAR_VISION_ANALYSIS_SYSTEM,
          user: message,
          history,
          imageUrls,
        });
        provider = visual.provider;
        visionUsed = visual.vision;
        visionAnalysis = parseSalaarVisionAnalysis(visual.text);

        const visualQuery = `${customerMessage} ${visionCatalogQuery(message, visionAnalysis)}`.trim();
        if (visualQuery) intent = parseSalesIntent(visualQuery, catalogContext);
        const wantsMatches = imageMatchRequest(customerMessage, !customerMessage);
        intent.wantsProducts = wantsMatches;
        if (!wantsMatches && intent.kind === 'product_search') intent.kind = rawIntent.kind === 'product_search' ? 'general' : rawIntent.kind;
      } catch (error) {
        console.warn('Salaar structured vision analysis unavailable; falling back to normal vision reply', error);
      }
    }

    intent.followUp.more = rawIntent.followUp.more;
    intent.followUp.cheaper = rawIntent.followUp.cheaper || intent.followUp.cheaper;
    intent.followUp.pricier = rawIntent.followUp.pricier || intent.followUp.pricier;
    intent.followUp.compare = rawIntent.followUp.compare || intent.followUp.compare;
    if (rawIntent.followUp.referencedPosition != null) intent.followUp.referencedPosition = rawIntent.followUp.referencedPosition;
    intent.requiresVision = Boolean(imageUrls.length || rawIntent.requiresVision || intent.requiresVision);
    intent.needsReasoning = Boolean(intent.requiresVision || rawIntent.needsReasoning || intent.needsReasoning);

    const cards = pickProducts(catalogContext.products, intent, shownProductIds);
    await saveMessage(sessionId, 'customer', message, {
      imageUrls,
      visionAnalysis: visionAnalysis ? {
        searchQuery: visionAnalysis.searchQuery,
        category: visionAnalysis.category || null,
        color: visionAnalysis.color || null,
        material: visionAnalysis.material || null,
        styleTerms: visionAnalysis.styleTerms,
      } : null,
      salesIntent: {
        kind: rawIntent.kind,
        confidence: rawIntent.confidence,
        filters: rawIntent.filters,
        followUp: rawIntent.followUp,
        sortBy: rawIntent.sortBy,
        requiresVision: rawIntent.requiresVision,
        summary: rawIntent.summary,
      },
      knowledgeRefreshedAt: knowledge?.refreshedAt || null,
    });

    const deterministic = deterministicReply(message, intent, cards, knowledge, imageUrls.length > 0);
    let reply = deterministic.text;

    if (visionAnalysis) {
      const suffix = cards.length
        ? ` ${cards.length === 1 ? 'Ye matching PrimeHub option dekhain.' : 'Ye matching PrimeHub options dekhain.'}`
        : intent.wantsProducts ? ' Current catalog mein close matching option nahi mila; main exact match invent nahi karunga.' : '';
      reply = `${visionAnalysis.reply}${suffix}`.trim();
    } else if (!deterministic.needYou && (imageUrls.length > 0 || intentNeedsLlm(intent))) {
      try {
        const ai = await llmReply(message, cards, history, intent, knowledge, imageUrls);
        reply = ai.text;
        provider = ai.provider;
        visionUsed = ai.vision;
      } catch {
        // Grounded deterministic reply keeps Salaar useful when providers are unavailable.
      }
    }

    const needYou = Boolean(deterministic.needYou || /not sure|confus|payment stuck|WhatsApp 03238878009/i.test(reply));
    await saveMessage(sessionId, 'salaar', reply, {
      provider: provider || 'deterministic',
      visionUsed,
      productIds: cards.map((p) => p.id),
      needYou,
      knowledgeSources: knowledge?.sources || null,
      knowledgeRefreshedAt: knowledge?.refreshedAt || null,
      visionAnalysis: visionAnalysis ? {
        searchQuery: visionAnalysis.searchQuery,
        category: visionAnalysis.category || null,
        color: visionAnalysis.color || null,
        material: visionAnalysis.material || null,
        styleTerms: visionAnalysis.styleTerms,
      } : null,
      salesIntent: {
        kind: intent.kind,
        confidence: intent.confidence,
        filters: intent.filters,
        followUp: intent.followUp,
        sortBy: intent.sortBy,
        requiresVision: intent.requiresVision,
        summary: intent.summary,
      },
    });

    return NextResponse.json({
      sessionId,
      reply,
      products: cards,
      provider: provider || 'deterministic',
      visionUsed,
      needYou,
      whatsapp: needYou ? `https://wa.me/923238878009` : null,
      link: deterministic.link || null,
      salesIntent: {
        kind: intent.kind,
        confidence: intent.confidence,
        filters: intent.filters,
        followUp: intent.followUp,
        sortBy: intent.sortBy,
        requiresVision: intent.requiresVision,
      },
      vision: visionAnalysis ? {
        searchQuery: visionAnalysis.searchQuery,
        category: visionAnalysis.category || null,
        color: visionAnalysis.color || null,
        material: visionAnalysis.material || null,
        styleTerms: visionAnalysis.styleTerms,
      } : null,
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
