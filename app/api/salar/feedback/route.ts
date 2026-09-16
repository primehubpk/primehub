import { NextResponse } from 'next/server';
import { appendSalarMessage, cleanChatId, getSalarChat, saveSalarChat } from '@/lib/salar/chatStore';
import { mapDocumentToSupabase, supabasePrimaryUpsert } from '@/lib/dualWriteServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanText(value: unknown, max: number) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

function cleanOrderId(value: unknown) {
  const orderId = cleanText(value, 200);
  return /^[A-Za-z0-9_-]{4,200}$/.test(orderId) ? orderId : '';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const chatId = cleanChatId(body?.chatId);
    const orderId = cleanOrderId(body?.orderId);
    const rating = Number(body?.rating);
    const comment = cleanText(body?.comment, 700);

    if (!chatId) return NextResponse.json({ success: false, error: 'Invalid Salar chat.' }, { status: 400 });
    if (!orderId) return NextResponse.json({ success: false, error: 'Invalid order ID.' }, { status: 400 });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'Rating 1 se 5 tak honi chahiye.' }, { status: 400 });
    }

    const chat = await getSalarChat(chatId);
    if (!chat) return NextResponse.json({ success: false, error: 'Salar chat nahi mili.' }, { status: 404 });

    const now = new Date().toISOString();
    const feedbackId = `salar_feedback_${orderId}_${chatId}`;
    const payload = {
      version: 1,
      type: 'salar_order_feedback',
      orderId,
      chatId,
      rating,
      comment,
      customerId: chat.customerId || '',
      customerName: chat.customerName || '',
      source: 'salar_order',
      createdAt: now,
      updatedAt: now,
    };
    const row = mapDocumentToSupabase('settings', feedbackId, payload, 'supabase');
    if (!row) throw new Error('Could not build Salar feedback row.');
    await supabasePrimaryUpsert({ table: 'settings', row });

    const marker = `Salar experience review - Order ${orderId}`;
    const alreadyInChat = chat.messages.some((message) => message.actor === 'customer' && message.content.includes(marker));
    if (!alreadyInChat) {
      const content = [
        marker,
        `Rating: ${rating}/5`,
        comment || 'Customer ne written comment nahi diya.',
      ].join('\n');
      try {
        await saveSalarChat(appendSalarMessage(chat, {
          role: 'user',
          actor: 'customer',
          content,
        }));
      } catch (error) {
        console.warn('Salar feedback chat mirror failed', error instanceof Error ? error.message : 'unknown');
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Salar feedback save failed', error);
    return NextResponse.json({ success: false, error: 'Feedback save nahi ho saka. Dobara try karein.' }, { status: 500 });
  }
}
