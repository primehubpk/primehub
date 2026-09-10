import 'server-only';
import { createHash, randomBytes } from 'crypto';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const SALAR_UNBLOCK_EMAIL = 'primehubpk1@gmail.com';
const MESSAGE_LIMIT = 30;
const UPLOAD_LIMIT = 10;
const WINDOW_MS = 60_000;

type Bucket = { count: number; resetAt: number };
const messageBuckets = new Map<string, Bucket>();
const uploadBuckets = new Map<string, Bucket>();

function consume(map: Map<string, Bucket>, key: string, limit: number) {
  const now = Date.now();
  const current = map.get(key);
  if (!current || current.resetAt <= now) { map.set(key, { count: 1, resetAt: now + WINDOW_MS }); return true; }
  if (current.count >= limit) return false;
  current.count += 1; return true;
}

export function consumeSalarRateLimit(conversationId: string) { return consume(messageBuckets, conversationId, MESSAGE_LIMIT); }
export function consumeSalarUploadRateLimit(conversationId: string) { return consume(uploadBuckets, conversationId, UPLOAD_LIMIT); }

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  for (const chunk of cookie.split(';')) { const [rawName, ...rest] = chunk.trim().split('='); if (rawName === name) return rest.join('=').trim(); }
  return '';
}

export function readSalarSid(request: Request) { return cookieValue(request, 'salar_sid'); }
export function newSalarSid() { return randomBytes(32).toString('base64url'); }
export function salarSidCookieOptions() { return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 30 * 24 * 60 * 60 }; }
function conversationIdForSid(sid: string) { return `salar_${createHash('sha256').update(sid).digest('hex').slice(0, 40)}`; }

export async function verifiedCustomerUid(request: Request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try { const decoded = await getAdminAuth().verifyIdToken(auth.slice(7)); return decoded.uid || null; } catch { return null; }
}

export async function ensureSalarConversation(sid: string, customerUid: string | null) {
  const db = getAdminDb();
  const id = conversationIdForSid(sid);
  const ref = db.collection('salar_conversations').doc(id);
  const now = new Date().toISOString();
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) {
      transaction.set(ref, { id, customer_uid: customerUid || null, blocked: false, created_at: now, updated_at: now, last_message_at: now, last_message_preview: '' });
      return;
    }
    const data = snap.data() || {};
    const patch: Record<string, unknown> = { updated_at: now };
    if (!data.customer_uid && customerUid) patch.customer_uid = customerUid;
    transaction.set(ref, patch, { merge: true });
  });
  return { id, ref };
}

export function normalizeMessageText(value: unknown) { return String(value || '').replace(/\0/g, '').trim().slice(0, 2000); }

export async function listConversationMessages(conversationId: string) {
  const snap = await getAdminDb().collection('salar_messages').where('conversation_id', '==', conversationId).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => String(a.created_at || '').localeCompare(String(b.created_at || ''))).slice(-200);
}
