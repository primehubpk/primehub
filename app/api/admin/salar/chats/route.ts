import { NextResponse } from 'next/server';
import {
  appendSalarMessage,
  cleanChatId,
  getSalarChat,
  listSalarChats,
  saveSalarChat,
} from '@/lib/salar/chatStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === 'primehub_admin_auth=true');
}

function cleanText(value: unknown, max = 6000) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  try {
    const url = new URL(request.url);
    const chatId = cleanChatId(url.searchParams.get('chatId'));
    if (chatId) {
      const chat = await getSalarChat(chatId);
      if (!chat) return NextResponse.json({ success: false, error: 'Chat not found.' }, { status: 404 });
      return NextResponse.json({ success: true, chat }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }
    const chats = await listSalarChats(150);
    return NextResponse.json({ success: true, chats }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Salar admin chats read failed', error);
    return NextResponse.json({ success: false, error: 'Customer chats could not load.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const chatId = cleanChatId(body?.chatId);
    if (!chatId) return NextResponse.json({ success: false, error: 'Invalid chat.' }, { status: 400 });
    let chat = await getSalarChat(chatId);
    if (!chat) return NextResponse.json({ success: false, error: 'Chat not found.' }, { status: 404 });

    const action = String(body?.action || '').trim();
    if (action === 'reply') {
      const message = cleanText(body?.message, 6000);
      if (!message) return NextResponse.json({ success: false, error: 'Reply cannot be empty.' }, { status: 400 });
      chat = appendSalarMessage(chat, {
        role: 'assistant',
        actor: 'admin',
        content: message,
      });
      if (body?.pauseSalar === true) chat = { ...chat, salarPaused: true };
    } else if (action === 'pause') {
      chat = { ...chat, salarPaused: true };
    } else if (action === 'resume') {
      chat = { ...chat, salarPaused: false };
    } else {
      return NextResponse.json({ success: false, error: 'Unknown chat action.' }, { status: 400 });
    }

    chat = await saveSalarChat(chat);
    return NextResponse.json({ success: true, chat }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Salar admin chat action failed', error);
    return NextResponse.json({ success: false, error: 'Chat action could not be completed.' }, { status: 500 });
  }
}
