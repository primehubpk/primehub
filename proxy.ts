import { NextResponse, type NextRequest } from 'next/server';

const BLOCK_MESSAGE = 'Aapka chat access filhaal block hai. Unblock request ke liye primehubpk1@gmail.com par contact karein.';
const BLOCK_CHAT_PREFIX = 'salar_block_chat_';
const BLOCK_CUSTOMER_PREFIX = 'salar_block_customer_';

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

async function requestIdentity(request: NextRequest) {
  const type = request.headers.get('content-type') || '';
  if (type.toLowerCase().includes('multipart/form-data')) {
    const form = await request.clone().formData().catch(() => null);
    return {
      chatId: clean(form?.get('chatId'), 80),
      customerId: clean(form?.get('customerId'), 200),
    };
  }
  const body = await request.clone().json().catch(() => ({}));
  return {
    chatId: clean(body?.chatId, 80),
    customerId: clean(body?.customerId, 200),
  };
}

async function blockedRow(id: string) {
  if (!id) return false;
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!url || !key) return false;
  const params = new URLSearchParams();
  params.set('select', 'payload');
  params.set('id', `eq.${id}`);
  params.set('limit', '1');
  const response = await fetch(`${url}/rest/v1/settings?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!response.ok) return false;
  const rows = await response.json().catch(() => []);
  return rows?.[0]?.payload?.blocked === true;
}

export async function proxy(request: NextRequest) {
  if (request.method !== 'POST') return NextResponse.next();
  try {
    const { chatId, customerId } = await requestIdentity(request);
    if (!chatId && !customerId) return NextResponse.next();
    const checks = [
      chatId ? blockedRow(`${BLOCK_CHAT_PREFIX}${chatId}`) : Promise.resolve(false),
      customerId ? blockedRow(`${BLOCK_CUSTOMER_PREFIX}${customerId}`) : Promise.resolve(false),
    ];
    const blocked = (await Promise.all(checks)).some(Boolean);
    if (!blocked) return NextResponse.next();
    return NextResponse.json({ success: false, blocked: true, error: BLOCK_MESSAGE }, {
      status: 403,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/api/salar/chat'],
};
