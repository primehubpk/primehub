import { NextResponse } from 'next/server';
import {
  appendSalarMessage,
  cleanChatId,
  getSalarChat,
  listSalarChats,
  saveSalarChat,
} from '@/lib/salar/chatStore';
import {
  blockSalarChatIdentity,
  deleteSalarChatRecord,
  isSalarChatBlocked,
  listBlockedSalarChatIds,
  unblockSalarChatIdentity,
} from '@/lib/salar/blockStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === 'primehub_admin_auth=true');
}

function cleanText(value: unknown, max = 6000) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
}

const BLOCK_MESSAGE = 'Aapka chat access filhaal block hai. Unblock request ke liye primehubpk1@gmail.com par contact karein.';

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  try {
    const url = new URL(request.url);
    const chatId = cleanChatId(url.searchParams.get('chatId'));
    if (chatId) {
      const chat = await getSalarChat(chatId);
      if (!chat) return NextResponse.json({ success: false, error: 'Chat not found.' }, { status: 404 });
      const blocked = await isSalarChatBlocked(chat.id).catch(() => false);
      return NextResponse.json({ success: true, chat: { ...chat, blocked } }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }
    const [chats, blockedIds] = await Promise.all([
      listSalarChats(150),
      listBlockedSalarChatIds().catch(() => new Set<string>()),
    ]);
    return NextResponse.json({
      success: true,
      chats: chats.map((chat) => ({ ...chat, blocked: blockedIds.has(chat.id) })),
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Salar admin chats read failed', error);
    return NextResponse.json({ success: false, error: 'Customer chats could not load.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'bulk-delete') {
      const chatIds = Array.isArray(body?.chatIds)
        ? [...new Set(body.chatIds.map((value: unknown) => cleanChatId(value)).filter(Boolean))].slice(0, 150)
        : [];
      if (!chatIds.length) {
        return NextResponse.json({ success: false, error: 'Select at least one chat.' }, { status: 400 });
      }
      await Promise.all(chatIds.map((id) => deleteSalarChatRecord(id)));
      return NextResponse.json(
        { success: true, deleted: true, deletedIds: chatIds },
        { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }

    const chatId = cleanChatId(body?.chatId);
    if (!chatId) return NextResponse.json({ success: false, error: 'Invalid chat.' }, { status: 400 });
    let chat = await getSalarChat(chatId);
    if (!chat) return NextResponse.json({ success: false, error: 'Chat not found.' }, { status: 404 });
    if (action === 'delete') {
      await deleteSalarChatRecord(chatId);
      return NextResponse.json({ success: true, deleted: true, chatId }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }

    if (action === 'block') {
      await blockSalarChatIdentity(chat);
      chat = appendSalarMessage({ ...chat, salarPaused: true }, {
        role: 'assistant',
        actor: 'admin',
        content: BLOCK_MESSAGE,
      });
    } else if (action === 'unblock') {
      await unblockSalarChatIdentity(chat);
      chat = { ...chat, salarPaused: false };
    } else if (action === 'reply') {
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
    const blocked = action === 'block'
      ? true
      : action === 'unblock'
        ? false
        : await isSalarChatBlocked(chat.id).catch(() => false);
    return NextResponse.json({ success: true, chat: { ...chat, blocked }, blocked }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Salar admin chat action failed', error);
    return NextResponse.json({ success: false, error: 'Chat action could not be completed.' }, { status: 500 });
  }
}
