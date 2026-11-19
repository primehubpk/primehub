import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { answerWithModelDrivenSalar } from '@/lib/salar/modelDrivenEngine';
import { appendSalarMessage, createEmptySalarChat, getSalarChat, recentCustomerProductReferences, salarAiHistory, saveSalarChat } from '@/lib/salar/chatStore';
import { isSalarIdentityBlocked } from '@/lib/salar/blockStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Laptop adapter only. Disabled unless a separate private bridge token is set.
// Never expose this route through the WhatsApp tunnel: expose only the runner.
export async function POST(request: Request) {
  const key = process.env.SALAR_WHATSAPP_BRIDGE_TOKEN || '';
  if (key.length < 32) return NextResponse.json({ error: 'Bridge disabled' }, { status: 503 });
  const token = request.headers.get('authorization') || '';
  const expected = `Bearer ${key}`;
  if (token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 5 * 1024 * 1024) return NextResponse.json({ error: 'Too large' }, { status: 413 });
    const input = JSON.parse(raw);
    if (!/^\d{6,15}$/.test(input.sender || '') || !/^[A-Za-z0-9_.=:+/-]{8,250}$/.test(input.messageId || '')) {
      return NextResponse.json({ error: 'Invalid message identity' }, { status: 400 });
    }
    const message = String(input.message || '').trim().slice(0, 8000);
    const image = input.image;
    if (image && (!/^image\/(jpeg|png|webp)$/.test(image.mimeType || '') || typeof image.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.base64) || Buffer.from(image.base64, 'base64').length > 3 * 1024 * 1024)) {
      return NextResponse.json({ error: 'Invalid image' }, { status: 400 });
    }
    if (!message && !image) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    const hash = (value: string) => createHmac('sha256', key).update(value).digest('hex');
    const chatId = `wa-${hash(input.sender)}`;
    const messageId = `wa-${hash(input.messageId)}`;
    let chat = await getSalarChat(chatId) || createEmptySalarChat(chatId, { customerName: String(input.name || '').slice(0, 120) });
    if (chat.salarPaused || await isSalarIdentityBlocked(chatId, chat.customerId)) {
      return NextResponse.json({ paused: true });
    }
    const previous = chat.messages.find(m => m.id === `reply-${messageId}`);
    if (previous) return NextResponse.json({ reply: previous.content, products: previous.products || [], replay: true });
    const history = salarAiHistory({ ...chat, messages: chat.messages.filter(m => m.id !== messageId) }, 30);
    const refs: string[] = Array.isArray(input.productIds) ? input.productIds.filter((id: unknown) => typeof id === 'string' && id.length <= 200).slice(0, 30) : [];
    const knownProducts = new Map(chat.messages.flatMap(m => m.products || []).map(p => [p.id, p]));
    if (!chat.messages.some(m => m.id === messageId)) {
      chat = await saveSalarChat(appendSalarMessage(chat, { id: messageId, role: 'user', actor: 'customer', content: message || '[Customer image]',
        products: refs.map(id => knownProducts.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)) }));
    }
    const exactProductIds = [...new Set([...refs, ...recentCustomerProductReferences(chat, 30).map(p => p.id)])];
    const result = await answerWithModelDrivenSalar({ message, image, history, context: chat.context,
      customerName: chat.customerName, exactProductIds, channel: 'whatsapp', productLimit: Number(input.productLimit) || 3 });
    if (!result.provider) return NextResponse.json({ paused: true });
    // A pause set while the model was running wins. Never overwrite admin work.
    const latest = await getSalarChat(chatId);
    if (latest?.salarPaused) return NextResponse.json({ paused: true });
    chat = appendSalarMessage({ ...(latest || chat), context: result.context }, { id: `reply-${messageId}`, role: 'assistant', actor: 'salar', content: result.reply,
      products: result.products, displayMode: result.displayMode });
    await saveSalarChat(chat);
    return NextResponse.json({ reply: result.reply, products: result.products, matchingProductCount: result.matchingProductCount });
  } catch {
    // No prompt, customer data, credentials or provider error text in logs.
    return NextResponse.json({ error: 'Reply unavailable' }, { status: 503 });
  }
}
