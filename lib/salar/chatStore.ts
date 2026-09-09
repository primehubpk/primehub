import 'server-only';

import { createHash, randomUUID } from 'crypto';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const SALAR_SID_COOKIE = 'salar_sid';
export const SALAR_UNBLOCK_EMAIL = 'primehubpk1@gmail.com';
const SID_MAX_AGE = 60 * 60 * 24 * 365;
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

type RateBucket = { startedAt: number; count: number };
const rateBuckets = new Map<string, RateBucket>();

function cookieValue(request: Request, name: string): string {
  const cookie = request.headers.get('cookie') || '';
  for (const chunk of cookie.split(';')) {
    const [rawName, ...rest] = chunk.trim().split('=');
    if (rawName === name) return decodeURIComponent(rest.join('=').trim());
  }
  return '';
}

export function readSalarSid(request: Request): string | null {
  const value = cookieValue(request, SALAR_SID_COOKIE);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

export function newSalarSid() { return randomUUID(); }
export function salarSidCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: SID_MAX_AGE };
}

export function conversationIdForSid(sid: string) {
  return createHash('sha256').update(`primehub:salar:${sid}`).digest('hex');
}

export async function verifiedCustomerUid(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    const claims = await getAdminAuth().verifyIdToken(header.slice(7), false);
    return claims.uid || null;
  } catch {
    return null;
  }
}

export async function ensureSalarConversation(sid: string, customerUid?: string | null) {
  const db = getAdminDb();
  const id = conversationIdForSid(sid);
  const ref = db.collection('salar_conversations').doc(id);
  const snapshot = await ref.get();
  const now = new Date().toISOString();
  if (!snapshot.exists) {
    await ref.set({
      id,
      session_key: sid,
      visitor_label: `Guest-${sid.replace(/-/g, '').slice(-4).toUpperCase()}`,
      customer_uid: customerUid || null,
      blocked: false,
      created_at: now,
      updated_at: now,
      last_message_at: null,
      last_message_preview: '',
    });
  } else if (customerUid && snapshot.data()?.customer_uid !== customerUid) {
    await ref.set({ customer_uid: customerUid, updated_at: now }, { merge: true });
  }
  return { id, ref };
}

export function normalizeMessageText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 2000) : '';
}

export function consumeSalarRateLimit(conversationId: string): boolean {
  const now = Date.now();
  const current = rateBuckets.get(conversationId);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(conversationId, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= RATE_LIMIT_MAX) return false;
  current.count += 1;
  return true;
}

export async function listConversationMessages(conversationId: string) {
  const snapshot = await getAdminDb().collection('salar_messages').where('conversation_id', '==', conversationId).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a: any, b: any) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

export async function deleteConversationAndMessages(conversationId: string) {
  const db = getAdminDb();
  while (true) {
    const snapshot = await db.collection('salar_messages').where('conversation_id', '==', conversationId).limit(400).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  await db.collection('salar_conversations').doc(conversationId).delete();
}
