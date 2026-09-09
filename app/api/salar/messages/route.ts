import { NextResponse } from 'next/server';
import { consumeSalarRateLimit, ensureSalarConversation, listConversationMessages, normalizeMessageText, readSalarSid, SALAR_UNBLOCK_EMAIL, verifiedCustomerUid } from '@/lib/salar/chatStore';
import { buildSalarBrainPrompt } from '@/lib/salar/brainStore';
import { chatCompletionWithTools, SALAR_SAFE_ERROR_MESSAGE, type SalarLlmMessage, type SalarToolDefinition } from '@/lib/salar/keyRotator';
import { runWorker } from '@/lib/salar/worker';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { isR2PublicUrl } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHONE = '03238878009';
const ALLOWED_TOPICS = new Set(['reseller_club', 'prime_skill', 'shopping']);
const TOOLS: SalarToolDefinition[] = [
  {
    name: 'catalogue',
    description: 'Search ONLY the indexed PrimeHub catalogue. For a broad shopping need such as bangles, call with q only so you can list all matching collections first. Never guess a collection. Only set collection or collectionId after the visitor chooses one.',
    parameters: { type: 'object', properties: { q: { type: 'string' }, collection: { type: 'string' }, collectionId: { type: 'string' }, productId: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'knowledge',
    description: 'Read indexed PrimeHub website knowledge such as reseller_club, prime_skill, shopping, delivery, payment, about, contact, policies, or another website topic. Never invent missing facts.',
    parameters: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'], additionalProperties: false },
  },
];

type StoredMessage = { id?: string; role?: string; text?: string; attachments?: any; created_at?: string };
type WorkerProduct = { id: string; name: string; price: number; image_url?: string | null; url?: string; size?: string | null; material?: string | null; collection_names?: string[] };

function historyForModel(messages: StoredMessage[]): SalarLlmMessage[] {
  return messages.slice(-20).filter((message) => message.role === 'user' || message.role === 'assistant').map((message) => ({ role: message.role as 'user'|'assistant', content: String(message.text || '') }));
}
function safeArgs(value: unknown) { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
function shoppingLike(text: string) { return /bangle|churi|choori|kangan|jewel|watch|product|item|dikha|show|collection|shop|shopping/i.test(text); }
function collectionFollowUp(messages: StoredMessage[]) {
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
  return /which collection|kaunsi collection|collection dekh|collections mili/i.test(String(lastAssistant?.text || ''));
}
function collectionReply(collections: any[]) {
  const names = collections.map((item) => String(item?.name || '').trim()).filter(Boolean);
  return `Assalamualaikum, I am Salar from PrimeHub Mall.\n\nAap ke liye ye collections mili hain:\n${names.map((name) => `• ${name}`).join('\n')}\n\nAap kaunsi collection dekhna chahenge?`;
}
function noVerifiedResult() { return `Mujhe website index mein iski verified information nahi mili. PrimeHub se rabta karein: ${PHONE}`; }
function productsFromAttachments(attachments: any): WorkerProduct[] {
  return attachments && !Array.isArray(attachments) && Array.isArray(attachments.products) ? attachments.products : [];
}
function recentProducts(messages: StoredMessage[]): WorkerProduct[] {
  const assistant = [...messages].reverse().find((message) => message.role === 'assistant' && productsFromAttachments(message.attachments).length);
  return assistant ? productsFromAttachments(assistant.attachments).slice(0, 30) : [];
}
function normalizeHint(value: unknown) { return String(value || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function resolveReferencedProduct(question: string, messages: StoredMessage[]): WorkerProduct | null {
  const products = recentProducts(messages);
  if (!products.length) return null;
  const q = normalizeHint(question);
  const referenceLike = /(pic|photo|image|tasveer|picture|yeh?\b|\bis\s+(pic|photo|image)|\bthis\b|\bwali\b|size|material|3rd|2nd|1st|third|second|first)/i.test(q);
  if (!referenceLike) return null;
  const ordinal = q.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (ordinal) {
    const index = Number(ordinal[1]) - 1;
    if (index >= 0 && index < products.length) return products[index];
  }
  const words: Record<string, number> = { first: 0, pehli: 0, second: 1, doosri: 1, dusri: 1, third: 2, teesri: 2 };
  for (const [word, index] of Object.entries(words)) if (q.includes(word) && products[index]) return products[index];
  const hinted = products.find((product) => {
    const candidates = [product.name, product.material, ...(product.collection_names || [])].map(normalizeHint).filter((item) => item.length >= 3);
    return candidates.some((candidate) => q.includes(candidate) || candidate.split(' ').some((token) => token.length >= 4 && q.includes(token)));
  });
  if (hinted) return hinted;
  return products[products.length - 1] || null;
}
function productFactReply(product: WorkerProduct, question: string) {
  const q = normalizeHint(question);
  if (/size|measurement|napa|nap/.test(q)) return product.size ? `${product.name} ka website-listed size: ${product.size}.` : `${product.name} ka size website index mein listed nahi hai. Team confirm: ${PHONE}`;
  if (/material|metal|glass|sheesha|plastic/.test(q)) return product.material ? `${product.name} ka website-listed material: ${product.material}.` : `${product.name} ka material website index mein listed nahi hai. Team confirm: ${PHONE}`;
  return `${product.name}\nPrice: Rs ${Number(product.price || 0).toLocaleString()}${product.size ? `\nSize: ${product.size}` : ''}${product.material ? `\nMaterial: ${product.material}` : ''}`;
}
function cleanVisionText(value: unknown) {
  return String(value || '').replace(/(?:Rs\.?|PKR|₹|\$)\s*\d[\d,.]*/gi, 'price not verified').trim().slice(0, 1200);
}
function knowledgeReply(result: any) {
  if (!result || result.found === false || !String(result.text || '').trim()) return noVerifiedResult();
  const excerpt = String(result.text).trim().slice(0, 1800);
  return `${String(result.title || 'PrimeHub').trim()}\n\n${excerpt}${result.url ? `\n\nLink: ${result.url}` : ''}`;
}

async function saveAssistant(conversation: any, text: string, attachments: any) {
  const db = getAdminDb();
  const ref = db.collection('salar_messages').doc();
  const createdAt = new Date().toISOString();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(conversation.ref);
    if (!snapshot.exists || snapshot.data()?.blocked === true) throw new Error('SALAR_BLOCKED');
    transaction.set(ref, { id: ref.id, conversation_id: conversation.id, role: 'assistant', text, attachments, created_at: createdAt });
    transaction.set(conversation.ref, { updated_at: createdAt, last_message_at: createdAt, last_message_preview: text.slice(0, 160) }, { merge: true });
  });
  return { id: ref.id, conversation_id: conversation.id, role: 'assistant' as const, text, attachments, created_at: createdAt };
}

export async function GET(request: Request) {
  const sid = readSalarSid(request);
  if (!sid) return NextResponse.json({ error: 'session_required' }, { status: 401 });
  try {
    const customerUid = await verifiedCustomerUid(request);
    const conversation = await ensureSalarConversation(sid, customerUid);
    const snapshot = await conversation.ref.get();
    const blocked = snapshot.data()?.blocked === true;
    const messages = await listConversationMessages(conversation.id);
    return NextResponse.json({ conversationId: conversation.id, blocked, messages, unblockEmail: blocked ? SALAR_UNBLOCK_EMAIL : undefined }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load Salar messages.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sid = readSalarSid(request);
  if (!sid) return NextResponse.json({ error: 'session_required' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const imageUrl = typeof body?.imageUrl === 'string' && isR2PublicUrl(body.imageUrl) ? body.imageUrl.trim() : '';
  const topic = typeof body?.topic === 'string' && ALLOWED_TOPICS.has(body.topic) ? body.topic : '';
  const enteredText = normalizeMessageText(body?.text);
  if (body?.imageUrl && !imageUrl) return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 });
  if (body?.topic && !topic) return NextResponse.json({ error: 'Invalid quick area.' }, { status: 400 });
  if (!enteredText && !imageUrl && !topic) return NextResponse.json({ error: 'Message text, image, or quick area is required.' }, { status: 400 });
  const text = enteredText || (imageUrl ? 'Is image ke bare mein batayein.' : topic.replace('_', ' '));

  try {
    const customerUid = await verifiedCustomerUid(request);
    const conversation = await ensureSalarConversation(sid, customerUid);
    const beforeWrite = await conversation.ref.get();
    if (beforeWrite.data()?.blocked === true) return NextResponse.json({ error: 'blocked', unblockEmail: SALAR_UNBLOCK_EMAIL }, { status: 403 });
    if (!consumeSalarRateLimit(conversation.id)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

    const db = getAdminDb();
    const userRef = db.collection('salar_messages').doc();
    const now = new Date().toISOString();
    const userAttachments = imageUrl ? { images: [{ url: imageUrl }] } : [];
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(conversation.ref);
      if (!snapshot.exists || snapshot.data()?.blocked === true) throw new Error('SALAR_BLOCKED');
      transaction.set(userRef, { id: userRef.id, conversation_id: conversation.id, role: 'user', text, attachments: userAttachments, created_at: now });
      transaction.set(conversation.ref, { updated_at: now, last_message_at: now, last_message_preview: text.slice(0, 160) }, { merge: true });
    });
    const userMessage = { id: userRef.id, conversation_id: conversation.id, role: 'user' as const, text, attachments: userAttachments, created_at: now };
    const stored = await listConversationMessages(conversation.id) as StoredMessage[];

    if (topic) {
      const result: any = await runWorker({ job: 'knowledge', payload: { topic }, conversationId: conversation.id });
      const assistantText = knowledgeReply(result);
      const attachments = result?.found === false || !result?.url ? [] : { links: [{ title: String(result.title || topic), url: String(result.url) }] };
      const assistantMessage = await saveAssistant(conversation, assistantText, attachments);
      return NextResponse.json({ ok: true, messages: [userMessage, assistantMessage] }, { headers: { 'Cache-Control': 'no-store, private' } });
    }

    if (imageUrl) {
      const candidates = recentProducts(stored);
      const vision: any = await runWorker({ job: 'vision', payload: { imageUrl, question: text, productCandidates: candidates }, conversationId: conversation.id });
      let assistantText = '';
      let attachments: any = [];
      if (vision?.ok !== true) {
        assistantText = `Image verify nahi ho saki. Team confirm: ${PHONE}`;
      } else if (vision.matchProductId) {
        const exact: any = await runWorker({ job: 'catalogue', payload: { productId: vision.matchProductId }, conversationId: conversation.id });
        if (exact?.type === 'product' && exact.product) {
          assistantText = `${cleanVisionText(vision.answer || vision.description) || 'Yeh photo website ke is product se match karti hai.'}\n\n${productFactReply(exact.product, text)}`;
          attachments = { products: [exact.product] };
        } else {
          assistantText = `Image samajh aayi lekin website product verify nahi ho saka. Team confirm: ${PHONE}`;
        }
      } else {
        assistantText = cleanVisionText(vision.answer || vision.description) || `Image verify nahi ho saki. Team confirm: ${PHONE}`;
      }
      const assistantMessage = await saveAssistant(conversation, assistantText, attachments);
      return NextResponse.json({ ok: true, messages: [userMessage, assistantMessage] }, { headers: { 'Cache-Control': 'no-store, private' } });
    }

    const referenced = resolveReferencedProduct(text, stored);
    if (referenced) {
      const exact: any = await runWorker({ job: 'catalogue', payload: { productId: referenced.id }, conversationId: conversation.id });
      const assistantText = exact?.type === 'product' && exact.product ? productFactReply(exact.product, text) : noVerifiedResult();
      const attachments = exact?.type === 'product' && exact.product ? { products: [exact.product] } : [];
      const assistantMessage = await saveAssistant(conversation, assistantText, attachments);
      return NextResponse.json({ ok: true, messages: [userMessage, assistantMessage] }, { headers: { 'Cache-Control': 'no-store, private' } });
    }

    let assistantText = '';
    let products: WorkerProduct[] = [];
    let lastCollections: any[] | null = null;
    let usedTool = false;
    let successfulTool = false;
    let failedTool = false;

    try {
      const brain = await buildSalarBrainPrompt();
      const isCollectionFollowUp = collectionFollowUp(stored);
      const systemPrompt = `${brain}\n\n# Live tool rules\nYou may call tools. Never invent catalogue, stock, prices, collections, delivery, payment, or website facts. Phone ${PHONE} if tools fail or return nothing. There is ONE Worker only: catalogue, knowledge, and vision.\nFor a broad shopping need such as bangles: call catalogue with q only, then list EVERY collection returned and ask which collection to show. Do not request products until the visitor chooses a collection.\nWhen the visitor chooses a collection, call catalogue with collection. Product photos/cards come from the Worker result; do not fabricate products.\nFor website facts use knowledge. Uploaded images are handled by the vision Worker outside this tool loop. Keep replies short and warm. Do not place orders or use WhatsApp in this phase.`;
      const llmMessages: SalarLlmMessage[] = [{ role: 'system', content: systemPrompt }, ...historyForModel(stored)];
      let toolRounds = 0;

      while (true) {
        const completion = await chatCompletionWithTools({ messages: llmMessages, tools: toolRounds < 4 ? TOOLS : [] });
        if (!completion.toolCalls.length) { assistantText = completion.text.trim(); break; }
        toolRounds += 1; usedTool = true;
        llmMessages.push({ role: 'assistant', content: completion.text || '', tool_calls: completion.toolCalls.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.rawArguments || JSON.stringify(call.arguments) } })) });
        for (const call of completion.toolCalls) {
          const args = safeArgs(call.arguments);
          const result = call.name === 'catalogue'
            ? await runWorker({ job: 'catalogue', payload: args, conversationId: conversation.id })
            : call.name === 'knowledge'
              ? await runWorker({ job: 'knowledge', payload: args, conversationId: conversation.id })
              : { found: false, reason: `Unsupported tool ${call.name}` };
          if ((result as any)?.found === false) failedTool = true; else successfulTool = true;
          if ((result as any)?.type === 'collections') lastCollections = Array.isArray((result as any).collections) ? (result as any).collections : [];
          if ((result as any)?.type === 'products' && Array.isArray((result as any).products)) products = (result as any).products;
          llmMessages.push({ role: 'tool', name: call.name, tool_call_id: call.id, content: JSON.stringify(result) });
        }
      }

      if (!usedTool && (shoppingLike(text) || isCollectionFollowUp)) {
        const fallback: any = await runWorker({ job: 'catalogue', payload: isCollectionFollowUp ? { collection: text } : { q: text }, conversationId: conversation.id });
        usedTool = true;
        if (fallback?.found === false) failedTool = true; else successfulTool = true;
        if (fallback?.type === 'collections') lastCollections = Array.isArray(fallback.collections) ? fallback.collections : [];
        if (fallback?.type === 'products' && Array.isArray(fallback.products)) products = fallback.products;
      }

      if (failedTool && !successfulTool) assistantText = noVerifiedResult();
      else if (lastCollections) assistantText = collectionReply(lastCollections);
      else if (products.length && !assistantText) assistantText = 'Yeh is collection ke verified PrimeHub products hain.';
      else if (!assistantText) assistantText = noVerifiedResult();
    } catch {
      assistantText = SALAR_SAFE_ERROR_MESSAGE;
      products = [];
    }

    const attachments = products.length ? { products } : [];
    const assistantMessage = await saveAssistant(conversation, assistantText, attachments);
    return NextResponse.json({ ok: true, messages: [userMessage, assistantMessage] }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'SALAR_BLOCKED') return NextResponse.json({ error: 'blocked', unblockEmail: SALAR_UNBLOCK_EMAIL }, { status: 403 });
    return NextResponse.json({ error: 'Unable to save Salar message.' }, { status: 500 });
  }
}
