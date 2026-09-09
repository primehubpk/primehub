import { NextResponse } from 'next/server';
import { consumeSalarRateLimit, ensureSalarConversation, listConversationMessages, normalizeMessageText, readSalarSid, SALAR_UNBLOCK_EMAIL, verifiedCustomerUid } from '@/lib/salar/chatStore';
import { buildSalarBrainPrompt } from '@/lib/salar/brainStore';
import { chatCompletionWithTools, SALAR_SAFE_ERROR_MESSAGE, type SalarLlmMessage, type SalarToolDefinition } from '@/lib/salar/keyRotator';
import { runWorker } from '@/lib/salar/worker';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHONE = '03238878009';
const TOOLS: SalarToolDefinition[] = [
  {
    name: 'catalogue',
    description: 'Search ONLY the indexed PrimeHub catalogue. For a broad shopping need such as bangles, call with q only so you can list all matching collections first. Never guess a collection. Only set collection or collectionId after the visitor chooses one.',
    parameters: { type: 'object', properties: { q: { type: 'string' }, collection: { type: 'string' }, collectionId: { type: 'string' }, limit: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'knowledge',
    description: 'Read indexed PrimeHub website knowledge such as reseller_club, prime_skill, shopping, delivery, payment, about, contact, policies, or another website topic. Never invent missing facts.',
    parameters: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'], additionalProperties: false },
  },
];

type StoredMessage = { id?: string; role?: string; text?: string; attachments?: any; created_at?: string };
type WorkerProduct = { id: string; name: string; price: number; image_url?: string | null; url?: string; size?: string | null; material?: string | null };

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
  const text = normalizeMessageText(body?.text);
  if (!text) return NextResponse.json({ error: 'Message text is required.' }, { status: 400 });

  try {
    const customerUid = await verifiedCustomerUid(request);
    const conversation = await ensureSalarConversation(sid, customerUid);
    const beforeWrite = await conversation.ref.get();
    if (beforeWrite.data()?.blocked === true) return NextResponse.json({ error: 'blocked', unblockEmail: SALAR_UNBLOCK_EMAIL }, { status: 403 });
    if (!consumeSalarRateLimit(conversation.id)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

    const db = getAdminDb();
    const userRef = db.collection('salar_messages').doc();
    const now = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(conversation.ref);
      if (!snapshot.exists || snapshot.data()?.blocked === true) throw new Error('SALAR_BLOCKED');
      transaction.set(userRef, { id: userRef.id, conversation_id: conversation.id, role: 'user', text, attachments: [], created_at: now });
      transaction.set(conversation.ref, { updated_at: now, last_message_at: now, last_message_preview: text.slice(0, 160) }, { merge: true });
    });
    const userMessage = { id: userRef.id, conversation_id: conversation.id, role: 'user' as const, text, attachments: [], created_at: now };

    let assistantText = '';
    let products: WorkerProduct[] = [];
    let lastCollections: any[] | null = null;
    let usedTool = false;
    let successfulTool = false;
    let failedTool = false;

    try {
      const brain = await buildSalarBrainPrompt();
      const stored = await listConversationMessages(conversation.id) as StoredMessage[];
      const isCollectionFollowUp = collectionFollowUp(stored);
      const systemPrompt = `${brain}\n\n# Live tool rules\nYou may call tools. Never invent catalogue, stock, prices, collections, delivery, payment, or website facts. Phone ${PHONE} if tools fail or return nothing. There is ONE Worker only: catalogue and knowledge.\nFor a broad shopping need such as bangles: call catalogue with q only, then list EVERY collection returned and ask which collection to show. Do not request products until the visitor chooses a collection.\nWhen the visitor chooses a collection, call catalogue with collection (and q when useful). Product photos/cards come from the Worker result; do not fabricate products.\nFor website facts use knowledge. Keep replies short, warm, Roman Urdu/Urdu/English to match the visitor. Do not place orders, use WhatsApp, or use vision in this phase.`;
      const llmMessages: SalarLlmMessage[] = [{ role: 'system', content: systemPrompt }, ...historyForModel(stored)];
      let toolRounds = 0;

      while (true) {
        const completion = await chatCompletionWithTools({ messages: llmMessages, tools: toolRounds < 4 ? TOOLS : [] });
        if (!completion.toolCalls.length) { assistantText = completion.text.trim(); break; }
        toolRounds += 1; usedTool = true;
        llmMessages.push({
          role: 'assistant', content: completion.text || '',
          tool_calls: completion.toolCalls.map((call) => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.rawArguments || JSON.stringify(call.arguments) } })),
        });

        for (const call of completion.toolCalls) {
          const args = safeArgs(call.arguments);
          const result = call.name === 'catalogue'
            ? await runWorker({ job: 'catalogue', payload: args, conversationId: conversation.id })
            : call.name === 'knowledge'
              ? await runWorker({ job: 'knowledge', payload: args, conversationId: conversation.id })
              : { found: false, reason: `Unsupported tool ${call.name}` };
          if ((result as any)?.found === false) failedTool = true; else successfulTool = true;
          if ((result as any)?.type === 'collections') lastCollections = Array.isArray((result as any).collections) ? (result as any).collections : [];
          if ((result as any)?.type === 'products' && Array.isArray((result as any).products)) {
            products = (result as any).products.map((product:any) => ({ id: String(product.id), name: String(product.name), price: Number(product.price) || 0, image_url: product.image_url || null, url: product.url || '', size: product.size || null, material: product.material || null }));
          }
          llmMessages.push({ role: 'tool', name: call.name, tool_call_id: call.id, content: JSON.stringify(result) });
        }
      }

      if (!usedTool && (shoppingLike(text) || isCollectionFollowUp)) {
        const fallback = await runWorker({ job: 'catalogue', payload: isCollectionFollowUp ? { collection: text } : { q: text }, conversationId: conversation.id });
        usedTool = true;
        if ((fallback as any)?.found === false) failedTool = true; else successfulTool = true;
        if ((fallback as any)?.type === 'collections') lastCollections = Array.isArray((fallback as any).collections) ? (fallback as any).collections : [];
        if ((fallback as any)?.type === 'products' && Array.isArray((fallback as any).products)) products = (fallback as any).products.map((product:any) => ({ id: String(product.id), name: String(product.name), price: Number(product.price) || 0, image_url: product.image_url || null, url: product.url || '', size: product.size || null, material: product.material || null }));
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
