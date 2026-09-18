'use client';

export const SALAR_PRODUCT_HELP_EVENT = 'primehub:salar-product-help';
const STORAGE_KEY = 'primehub-salar-active-product-v1';

export type SalarProductHelpContext = {
  productId: string;
  title: string;
  path: string;
  imageUrl?: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
  category?: string;
  color?: string;
  size?: string;
  source?: 'product-page' | 'variant-selector';
};

function cleanText(value: unknown, max = 800) {
  return String(value ?? '').trim().slice(0, max);
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function normalizeSalarProductHelpContext(value: unknown): SalarProductHelpContext | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const productId = cleanText(input.productId, 200);
  const title = cleanText(input.title, 300);
  const path = cleanText(input.path, 1200);
  if (!productId || !title || !path) return null;

  const imageUrl = cleanText(input.imageUrl, 1600);
  const category = cleanText(input.category, 220);
  const color = cleanText(input.color, 160);
  const size = cleanText(input.size, 160);
  const source = input.source === 'variant-selector' ? 'variant-selector' : 'product-page';

  return {
    productId,
    title,
    path,
    ...(imageUrl ? { imageUrl } : {}),
    ...(finiteNumber(input.price) != null ? { price: finiteNumber(input.price) } : {}),
    ...(finiteNumber(input.originalPrice) != null ? { originalPrice: finiteNumber(input.originalPrice) } : {}),
    ...(finiteNumber(input.stock) != null ? { stock: finiteNumber(input.stock) } : {}),
    ...(category ? { category } : {}),
    ...(color ? { color } : {}),
    ...(size ? { size } : {}),
    source,
  };
}

export function rememberSalarProductHelpContext(value: SalarProductHelpContext) {
  if (typeof window === 'undefined') return;
  const context = normalizeSalarProductHelpContext(value);
  if (!context) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {}
}

export function readSalarProductHelpContext() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const context = normalizeSalarProductHelpContext(JSON.parse(raw));
    if (!context) return null;

    const currentPath = window.location.pathname;
    let storedPath = context.path;
    try {
      storedPath = new URL(context.path, window.location.origin).pathname;
    } catch {}
    return storedPath === currentPath ? context : null;
  } catch {
    return null;
  }
}

export function requestSalarProductHelp(value: SalarProductHelpContext) {
  if (typeof window === 'undefined') return;
  const context = normalizeSalarProductHelpContext(value);
  if (!context) return;
  rememberSalarProductHelpContext(context);
  window.dispatchEvent(new CustomEvent<SalarProductHelpContext>(SALAR_PRODUCT_HELP_EVENT, { detail: context }));
}
