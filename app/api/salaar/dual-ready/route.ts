import { getAdminDb } from '@/lib/firebaseAdmin';
import { POST as readyPost } from '../ready/route';
import { mirrorSalaarConversation, mirrorSalaarMessage } from '@/lib/salaarDualServer';

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
    console.warn('Salaar READY dual mirror skipped', error);
  }
}

export async function POST(request: Request) {
  const clone = request.clone();
  const body = await clone.json().catch(() => ({}));
  const sessionId = clean(body?.sessionId) || '';
  const response = await readyPost(request);
  const data = await response.clone().json().catch(() => null);
  if (data?.orderIntentSaved) await syncSession(sessionId);
  return response;
}
