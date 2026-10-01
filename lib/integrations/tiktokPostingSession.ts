import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const POSTING_SESSION_COOKIE = 'primehub_tiktok_posting_session';
export const POSTING_SESSION_MAX_AGE = 24 * 60 * 60;

export function createPostingSession(pin: string, now = Math.floor(Date.now() / 1000)) {
  const payload = `${randomBytes(24).toString('base64url')}.${now}`;
  const signature = createHmac('sha256', pin).update(`tiktok-posting-session:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
}

export function validPostingSession(token: string, pin: string, now = Math.floor(Date.now() / 1000)) {
  const [nonce, time, signature, extra] = token.split('.');
  if (!pin || extra || !/^[A-Za-z0-9_-]{32}$/.test(nonce || '') || !/^\d+$/.test(time || '') || !signature) return false;
  const age = now - Number(time);
  if (age < 0 || age >= POSTING_SESSION_MAX_AGE) return false;
  const expected = createHmac('sha256', pin).update(`tiktok-posting-session:${nonce}.${time}`).digest('base64url');
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function postingSessionFromRequest(request: Request) {
  return (request.headers.get('cookie') || '').split(';')
    .map(part => part.trim()).find(part => part.startsWith(`${POSTING_SESSION_COOKIE}=`))
    ?.slice(POSTING_SESSION_COOKIE.length + 1) || '';
}

export function postingSessionCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: POSTING_SESSION_MAX_AGE };
}
