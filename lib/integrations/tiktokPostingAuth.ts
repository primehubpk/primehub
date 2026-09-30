import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { verifyPrimeHubAdminRequest } from '@/lib/adminSession';

export async function postingAdmin(request: Request) {
  if (!await verifyPrimeHubAdminRequest(request)) return false;
  const expected = process.env.TIKTOK_POSTING_ADMIN_PIN;
  const supplied = request.headers.get('x-tiktok-posting-pin') || '';
  if (!expected || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

export function signOAuthState(nonce: string) {
  const secret = process.env.TIKTOK_POSTING_ADMIN_PIN;
  if (!secret) throw new Error('TikTok posting admin PIN is not configured.');
  const payload = `${nonce}.${Math.floor(Date.now() / 1000)}`;
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function validOAuthState(state: string) {
  const [nonce, time, signature, extra] = state.split('.');
  if (extra || !nonce || !time || !signature || !/^\d+$/.test(time)) return false;
  const secret = process.env.TIKTOK_POSTING_ADMIN_PIN;
  if (!secret) return false;
  const age = Math.floor(Date.now() / 1000) - Number(time);
  if (age < 0 || age > 600) return false;
  const expected = createHmac('sha256', secret).update(`${nonce}.${time}`).digest('base64url');
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
