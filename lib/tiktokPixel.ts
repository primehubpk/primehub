'use client';

export type TikTokContent = {
  content_id: string;
  content_type: 'product' | 'product_group';
  content_name?: string;
  content_category?: string;
  price?: number;
  num_items?: number;
};

export type TikTokEventPayload = {
  contents?: TikTokContent[];
  value?: number;
  currency?: string;
  search_string?: string;
};

declare global {
  interface Window {
    ttq?: {
      track?: (
        eventName: string,
        payload?: TikTokEventPayload,
        options?: { event_id?: string },
      ) => void;
    };
  }
}

function finiteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function makeTikTokContent(input: {
  id: unknown;
  name?: unknown;
  category?: unknown;
  price?: unknown;
  quantity?: unknown;
}): TikTokContent {
  const price = finiteNumber(input.price);
  const quantity = finiteNumber(input.quantity);

  return {
    content_id: String(input.id ?? '').trim(),
    content_type: 'product',
    ...(input.name ? { content_name: String(input.name).trim() } : {}),
    ...(input.category ? { content_category: String(input.category).trim() } : {}),
    ...(price != null ? { price } : {}),
    ...(quantity != null ? { num_items: Math.max(1, quantity) } : {}),
  };
}

function makeEventId(eventName: string) {
  const prefix = eventName.replace(/[^A-Za-z0-9]/g, '').slice(0, 24) || 'event';
  try {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
  } catch {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function sendTikTokEvent(
  eventName: string,
  payload: TikTokEventPayload | undefined,
  eventId: string,
  retriesLeft: number,
) {
  if (typeof window === 'undefined') return;
  const tracker = window.ttq?.track;

  if (typeof tracker !== 'function') {
    if (retriesLeft > 0) {
      window.setTimeout(
        () => sendTikTokEvent(eventName, payload, eventId, retriesLeft - 1),
        250,
      );
    }
    return;
  }

  try {
    tracker(eventName, payload, { event_id: eventId });
  } catch (error) {
    console.warn('[tiktok-pixel] event tracking failed', eventName, error);
  }
}

function sendServerCopy(eventName: string, payload: TikTokEventPayload | undefined, eventId: string) {
  if (typeof window === 'undefined') return;

  void fetch('/api/tiktok/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify({
      event: eventName,
      eventId,
      payload,
      pageUrl: window.location.href,
      referrer: document.referrer || '',
    }),
  }).catch(() => undefined);
}

export function trackTikTokEvent(
  eventName: string,
  payload?: TikTokEventPayload,
  options: { eventId?: string; server?: boolean } = {},
) {
  const eventId = String(options.eventId || '').trim() || makeEventId(eventName);
  sendTikTokEvent(eventName, payload, eventId, 6);
  if (options.server !== false) sendServerCopy(eventName, payload, eventId);
  return eventId;
}
