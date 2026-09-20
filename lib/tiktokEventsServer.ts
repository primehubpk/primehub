import 'server-only';

import { getTikTokEventsSettings } from '@/lib/integrations/tiktokStore';
import { TIKTOK_EVENTS_ENDPOINT } from '@/lib/tiktokConfig';

export type TikTokServerContent = {
  content_id: string;
  content_type?: string;
  content_name?: string;
  content_category?: string;
  price?: number;
  num_items?: number;
};

export type TikTokServerPayload = {
  contents?: TikTokServerContent[];
  value?: number;
  currency?: string;
  search_string?: string;
};

const ALLOWED_EVENTS = new Set([
  'ViewContent',
  'AddToWishlist',
  'Search',
  'AddPaymentInfo',
  'AddToCart',
  'InitiateCheckout',
  'PlaceAnOrder',
  'CompleteRegistration',
  'Purchase',
]);

function clean(value: unknown, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rest.join('=') || '');
  }
  return '';
}

function requestIp(request: Request) {
  return clean(
    request.headers.get('x-forwarded-for')?.split(',')[0]
      || request.headers.get('x-real-ip')
      || '',
    100,
  );
}

export async function sendTikTokServerEvent(request: Request, input: {
  event: unknown;
  eventId: unknown;
  payload?: TikTokServerPayload;
  pageUrl?: unknown;
  referrer?: unknown;
  forceTestCode?: unknown;
}) {
  const event = clean(input.event, 80);
  const eventId = clean(input.eventId, 160);
  if (!ALLOWED_EVENTS.has(event)) throw new Error('Unsupported TikTok event.');
  if (!eventId) throw new Error('TikTok event ID is required.');

  const settings = await getTikTokEventsSettings();
  if (!settings.enabled || !settings.accessToken) {
    return { sent: false, skipped: true, event, eventId };
  }

  const payload = input.payload || {};
  const contents = Array.isArray(payload.contents)
    ? payload.contents
        .slice(0, 100)
        .map((item) => ({
          content_id: clean(item?.content_id, 200),
          ...(clean(item?.content_type, 50) ? { content_type: clean(item?.content_type, 50) } : {}),
          ...(clean(item?.content_name, 300) ? { content_name: clean(item?.content_name, 300) } : {}),
          ...(clean(item?.content_category, 300) ? { content_category: clean(item?.content_category, 300) } : {}),
          ...(finite(item?.price) != null ? { price: finite(item?.price) } : {}),
          ...(finite(item?.num_items) != null ? { quantity: Math.max(1, Number(item?.num_items)) } : {}),
        }))
        .filter((item) => item.content_id)
    : [];

  const properties: Record<string, unknown> = {
    ...(contents.length ? { contents, content_type: 'product' } : {}),
    ...(finite(payload.value) != null ? { value: finite(payload.value) } : {}),
    ...(clean(payload.currency, 10) ? { currency: clean(payload.currency, 10).toUpperCase() } : {}),
    ...(clean(payload.search_string, 500) ? { search_string: clean(payload.search_string, 500) } : {}),
  };

  const user: Record<string, string> = {};
  const ip = requestIp(request);
  const userAgent = clean(request.headers.get('user-agent'), 1000);
  const ttp = clean(cookieValue(request, '_ttp'), 300);
  if (ip) user.ip = ip;
  if (userAgent) user.user_agent = userAgent;
  if (ttp) user.ttp = ttp;

  const pageUrl = clean(input.pageUrl, 2000);
  const referrer = clean(input.referrer, 2000);
  const testEventCode = clean(input.forceTestCode || settings.testEventCode, 120);

  const eventData: Record<string, unknown> = {
    event,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    ...(Object.keys(user).length ? { user } : {}),
    ...(Object.keys(properties).length ? { properties } : {}),
    ...((pageUrl || referrer)
      ? { page: { ...(pageUrl ? { url: pageUrl } : {}), ...(referrer ? { referrer } : {}) } }
      : {}),
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  const body: Record<string, unknown> = {
    event_source: 'web',
    event_source_id: settings.pixelId,
    data: [eventData],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  const response = await fetch(TIKTOK_EVENTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Access-Token': settings.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });

  const result = await response.json().catch(() => null) as any;
  const apiCode = Number(result?.code ?? result?.data?.code ?? 0);
  if (!response.ok || (Number.isFinite(apiCode) && apiCode !== 0)) {
    const detail = clean(result?.message || result?.msg || '', 240);
    throw new Error(`TikTok Events API ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  return { sent: true, skipped: false, event, eventId };
}
