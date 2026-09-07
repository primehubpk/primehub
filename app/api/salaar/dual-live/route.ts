import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { GET as liveGet, POST as livePost } from '../live/route';
import { loadSupabaseSalaarHistory, loadSupabaseSalaarState, mirrorSalaarConversation, mirrorSalaarMessage } from '@/lib/salaarDualServer';
import { sanitizeSalaarSalesMemory } from '@/lib/salaarSalesMemoryCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 100) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function syncSession(sessionId: string) {
  if (!sessionId) return;
  try {
    await mirrorSalaarConversation(sessionId);
    const snap = await getAdminDb().collection('salaar_conversations').doc(sessionId).collection('messages').orderBy('createdAt', 'desc').limit(20).get();
    for (const doc of snap.docs) await mirrorSalaarMessage(sessionId, doc.id);
  } catch (error) {
    console.warn('Salaar dual mirror sync skipped', error);
  }
}

export async function GET(request: Request) {
  const sessionId = clean(new URL(request.url).searchParams.get('sessionId'));
  const response = await liveGet(request);
  const data = await response.clone().json().catch(() => null);
  await syncSession(sessionId);

  if (!sessionId) return response;
  const needsHistoryFallback = !Array.isArray(data?.messages) || data.messages.length === 0;
  const needsMemoryFallback = !data?.salesMemory?.updatedAt;
  if (!needsHistoryFallback && !needsMemoryFallback) return response;

  try {
    const [fallbackHistory, fallbackState] = await Promise.all([
      needsHistoryFallback ? loadSupabaseSalaarHistory(sessionId) : Promise.resolve([]),
      needsMemoryFallback ? loadSupabaseSalaarState(sessionId) : Promise.resolve({}),
    ]);
    const fallbackMemory = sanitizeSalaarSalesMemory((fallbackState as any)?.salesMemory);
    const payload = {
      ...data,
      ...(needsHistoryFallback && fallbackHistory.length ? { messages: fallbackHistory } : {}),
      ...(needsMemoryFallback && fallbackMemory.updatedAt ? { salesMemory: fallbackMemory } : {}),
      backendFallback: (fallbackHistory.length || fallbackMemory.updatedAt) ? 'supabase' : data?.backendFallback,
    };
    if (fallbackHistory.length || fallbackMemory.updatedAt) return NextResponse.json(payload);
  } catch (error) {
    console.warn('Salaar Supabase history/memory fallback unavailable', error);
  }
  return response;
}

export async function POST(request: Request) {
  const clone = request.clone();
  const body = await clone.json().catch(() => ({}));
  const sessionId = clean(body?.sessionId) || '';
  const response = await livePost(request);
  await syncSession(sessionId);
  return response;
}
