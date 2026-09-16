'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'primehub-salar-chat-v5';

type ProductRef = { id: string; title?: string };
type Customization = {
  productId: string;
  title?: string;
  selectedColor?: string;
  markedImageUrl?: string;
};

function normalized(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function readState(): any {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function cleanColourCandidate(value: string) {
  const stop = new Set(['is', 'iss', 'isme', 'isey', 'ye', 'this', 'that', 'ka', 'ki', 'ke', 'mein', 'me', 'mai', 'mujhe', 'muje', 'chahiye', 'chahye']);
  const words = normalized(value).toLowerCase().split(/\s+/).filter(Boolean).filter((word) => !stop.has(word));
  return words.slice(-2).join(' ').replace(/^./, (letter) => letter.toUpperCase());
}

function extractSelectedColour(textInput: unknown) {
  const text = normalized(textInput).toLowerCase();
  if (!text) return '';
  const before = text.match(/\b([a-z]+(?:\s+[a-z]+){0,2})\s+(?:colour|color)\b/i);
  if (before?.[1]) return cleanColourCandidate(before[1]);
  const after = text.match(/\b(?:colour|color)\s*(?:is|=|:|-|ka|ki|mein|me)?\s*([a-z]+(?:\s+[a-z]+)?)/i);
  if (after?.[1]) return cleanColourCandidate(after[1]);
  return '';
}

function productRefs(message: any): ProductRef[] {
  const refs: ProductRef[] = [];
  if (Array.isArray(message?.products)) {
    for (const product of message.products) {
      const id = normalized(product?.id);
      if (id) refs.push({ id, title: normalized(product?.title) || undefined });
    }
  }
  const mentionId = normalized(message?.mention?.id);
  if (mentionId) refs.push({ id: mentionId, title: normalized(message?.mention?.title) || undefined });
  return [...new Map(refs.map((ref) => [ref.id, ref])).values()];
}

function collectCustomizations(): Customization[] {
  const state = readState();
  const messages = Array.isArray(state?.messages) ? state.messages : [];
  const map = new Map<string, Customization>();
  let lastRefs: ProductRef[] = [];

  for (const message of messages) {
    const refs = productRefs(message);
    if (refs.length) lastRefs = refs;
    if (message?.role !== 'user') continue;

    const selectedColor = extractSelectedColour(message?.content);
    const markedImage = normalized(message?.imageUrl) && /(marked|nishan|colour reference|color reference|exact colour|exact color)/i.test(normalized(message?.content))
      ? normalized(message.imageUrl)
      : '';
    if (!selectedColor && !markedImage) continue;

    const targets = refs.length ? refs : lastRefs.slice(0, 1);
    for (const target of targets) {
      const current = map.get(target.id) || { productId: target.id, title: target.title };
      map.set(target.id, {
        ...current,
        title: target.title || current.title,
        ...(selectedColor ? { selectedColor } : {}),
        ...(markedImage ? { markedImageUrl: markedImage } : {}),
      });
    }
  }

  return [...map.values()];
}

function currentOrderCustomizations(itemIds?: string[]) {
  const state = readState();
  const orderIds = itemIds?.length
    ? itemIds
    : Array.isArray(state?.orderItems)
      ? state.orderItems.map((item: any) => normalized(item?.id)).filter(Boolean)
      : [];
  const allowed = new Set(orderIds);
  return collectCustomizations().filter((item) => !allowed.size || allowed.has(item.productId));
}

function customizationLines(items: Customization[]) {
  return items.flatMap((item, index) => {
    const label = item.title || `Product ${index + 1}`;
    return [
      item.selectedColor ? `Customer selected colour for ${label}: ${item.selectedColor}` : '',
      item.markedImageUrl ? `Marked colour/design image for ${label}: ${item.markedImageUrl}` : '',
    ].filter(Boolean);
  });
}

function mergeNotes(existing: unknown, additions: string[]) {
  const base = String(existing || '').trim();
  const unique = additions.filter((line) => line && !base.toLowerCase().includes(line.toLowerCase()));
  return [base, ...unique].filter(Boolean).join('\n');
}

function enhanceOrderDraft() {
  const shell = document.getElementById('salar-viewport-shell');
  if (!shell) return;
  const state = readState();
  const orderItems = Array.isArray(state?.orderItems) ? state.orderItems : [];
  if (!orderItems.length) return;
  const custom = new Map(currentOrderCustomizations(orderItems.map((item: any) => normalized(item?.id))).map((item) => [item.productId, item]));
  if (!custom.size) return;

  for (const item of orderItems) {
    const id = normalized(item?.id);
    const title = normalized(item?.title);
    const selection = custom.get(id);
    if (!id || !title || !selection) continue;
    const nodes = Array.from(shell.querySelectorAll<HTMLElement>('p,span,div')).filter((node) => normalized(node.textContent) === title);
    for (const node of nodes) {
      let orderArea: HTMLElement | null = node;
      let valid = false;
      for (let depth = 0; orderArea && depth < 7; depth += 1, orderArea = orderArea.parentElement) {
        const text = normalized(orderArea.textContent).toLowerCase();
        if (text.includes('order draft') && text.includes('subtotal')) { valid = true; break; }
      }
      if (!valid) continue;
      const host = node.parentElement;
      if (!host || host.querySelector(`[data-salar-customization="${CSS.escape(id)}"]`)) continue;
      const badge = document.createElement('div');
      badge.dataset.salarCustomization = id;
      badge.style.marginTop = '4px';
      badge.style.fontSize = '8px';
      badge.style.fontWeight = '900';
      badge.style.color = '#0F6A5F';
      badge.textContent = [
        selection.selectedColor ? `Selected colour: ${selection.selectedColor}` : '',
        selection.markedImageUrl ? 'Marked image attached' : '',
      ].filter(Boolean).join(' · ');
      host.appendChild(badge);
      break;
    }
  }
}

export default function SalarOrderCustomizationBridge() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    const nativeOpen = window.open.bind(window);

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/orders') && String(init?.method || 'GET').toUpperCase() === 'POST' && typeof init?.body === 'string') {
        try {
          const body = JSON.parse(init.body);
          if (body?.mode !== 'quote' && Array.isArray(body?.items)) {
            const itemIds = body.items.map((item: any) => normalized(item?.productId || item?.id)).filter(Boolean);
            const customizations = currentOrderCustomizations(itemIds);
            const lines = customizationLines(customizations);
            if (lines.length) {
              body.customer = { ...(body.customer || {}), notes: mergeNotes(body?.customer?.notes, lines) };
              body.orderContext = { ...(body.orderContext || {}), customizations };
              init = { ...init, body: JSON.stringify(body) };
            }
          }
        } catch {}
      }
      return nativeFetch(input, init);
    }) as typeof window.fetch;

    window.open = ((url?: string | URL, target?: string, features?: string) => {
      try {
        const raw = String(url || '');
        if (/https:\/\/wa\.me\//i.test(raw)) {
          const parsed = new URL(raw);
          const existing = parsed.searchParams.get('text') || '';
          const lines = customizationLines(currentOrderCustomizations());
          if (lines.length) parsed.searchParams.set('text', mergeNotes(existing, ['', '*Customer custom selection:*', ...lines]));
          return nativeOpen(parsed.toString(), target, features);
        }
      } catch {}
      return nativeOpen(url as any, target, features);
    }) as typeof window.open;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        enhanceOrderDraft();
      });
    };
    const shell = document.getElementById('salar-viewport-shell');
    const observer = shell ? new MutationObserver(schedule) : null;
    observer?.observe(shell!, { childList: true, subtree: true });
    window.addEventListener('storage', schedule);
    schedule();

    return () => {
      window.fetch = nativeFetch;
      window.open = nativeOpen as typeof window.open;
      observer?.disconnect();
      window.removeEventListener('storage', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
