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
      track?: (eventName: string, payload?: TikTokEventPayload) => void;
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

function sendTikTokEvent(eventName: string, payload: TikTokEventPayload | undefined, retriesLeft: number) {
  if (typeof window === 'undefined') return;
  const tracker = window.ttq?.track;

  if (typeof tracker !== 'function') {
    if (retriesLeft > 0) {
      window.setTimeout(() => sendTikTokEvent(eventName, payload, retriesLeft - 1), 250);
    }
    return;
  }

  try {
    tracker(eventName, payload);
  } catch (error) {
    console.warn('[tiktok-pixel] event tracking failed', eventName, error);
  }
}

export function trackTikTokEvent(eventName: string, payload?: TikTokEventPayload) {
  sendTikTokEvent(eventName, payload, 6);
}
