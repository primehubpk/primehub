import 'server-only';

import { revalidateTag, unstable_cache } from 'next/cache';
import { getFreshPublicCatalogSnapshot, getFreshStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import { getSupabasePrimaryPayload, mapDocumentToSupabase, supabasePrimaryUpsert } from '@/lib/dualWriteServer';

export type SalarChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type SalarProductCard = {
  id: string;
  title: string;
  path: string;
  imageUrl?: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
  category?: string;
};

export type SalarCategoryCard = {
  id: string;
  title: string;
  slug?: string;
  imageUrl?: string;
};

export type SalarChatContext = {
  lastProductQuery?: string;
  shownProductIds?: string[];
};

export type SalarImageInput = {
  mimeType: string;
  base64: string;
};

export type SalarCatalogue = {
  updatedAt: string;
  source: string;
  products: Array<Record<string, any>>;
  categories: Array<Record<string, any>>;
  pages: Array<{ path: string; title: string; text: string }>;
  storefront: Record<string, unknown>;
};

export type SalarState = {
  version: 1;
  enabled: boolean;
  instructions: string;
  orderInstructions: string;
  updatedAt: string | null;
  catalogue: SalarCatalogue | null;
};

const SALAR_SETTINGS_ID = 'salar';
const SALAR_STATE_TAG = 'salar-state';
const MAX_PAGE_COUNT = 24;
const MAX_PAGE_TEXT = 7000;
const MAX_KEYS_PER_PROVIDER = 12;
export const MAX_SALAR_INSTRUCTION_SECTION_CHARS = 20000;

const DEFAULT_STATE: SalarState = {
  version: 1,
  enabled: true,
  instructions: '',
  orderInstructions: '',
  updatedAt: null,
  catalogue: null,
};

function cleanText(value: unknown, max = 2000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanInstructions(value: unknown) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_SALAR_INSTRUCTION_SECTION_CHARS);
}

function finiteNumber(value: unknown) {
  if (value === '' || value == null) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function safeArray(value: unknown, max = 60) {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function safePublicImageUrl(value: unknown) {
  const url = cleanText(value, 1200);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function productImageUrls(product: any) {
  const values: unknown[] = [
    ...safeArray(product?.images, 8),
    product?.imageUrl,
    product?.image,
  ];
  const urls = values
    .map((item: any) => safePublicImageUrl(typeof item === 'string' ? item : item?.url || item?.imageUrl))
    .filter(Boolean);
  return [...new Set(urls)].slice(0, 8);
}

function compactProduct(product: any): Record<string, any> {
  const id = cleanText(product?.id, 200);
  const images = productImageUrls(product);
  const record: Record<string, unknown> = {
    id,
    path: id ? `/product/${encodeURIComponent(id)}` : '',
    title: cleanText(product?.title ?? product?.name, 300),
    name: cleanText(product?.name ?? product?.title, 300),
    slug: cleanText(product?.slug, 300),
    description: cleanText(product?.description, 1800),
    category: cleanText(product?.category, 300),
    categoryId: cleanText(product?.categoryId, 200),
    price: finiteNumber(product?.price),
    originalPrice: finiteNumber(product?.originalPrice),
    stock: finiteNumber(product?.stock ?? product?.quantity),
    imageUrl: images[0] || '',
    images,
    published: product?.published !== false,
    active: product?.active !== false,
    featured: product?.featured === true,
    isWholesale: product?.isWholesale === true,
    priceBucketIds: safeArray(product?.priceBucketIds, 20).map((item) => cleanText(item, 120)),
    tags: safeArray(product?.tags, 30).map((item) => cleanText(item, 120)),
    keywords: safeArray(product?.keywords, 30).map((item) => cleanText(item, 120)),
    material: cleanText(product?.material, 160),
    color: cleanText(product?.color, 160),
    size: cleanText(product?.size, 160),
    variantColors: safeArray(product?.variantColors, 30).map((item: any) => ({
      name: cleanText(item?.name ?? item, 120),
      imageUrl: safePublicImageUrl(item?.imageUrl),
    })),
    variantOptions: safeArray(product?.variantOptions, 20).map((item: any) => ({
      id: cleanText(item?.id, 80),
      name: cleanText(item?.name, 100),
      values: safeArray(item?.values, 40).map((value) => cleanText(value, 100)),
    })),
    variantMatrix: safeArray(product?.variantMatrix ?? product?.variants, 120).map((row: any) => ({
      label: cleanText(row?.label || row?.name || row?.variant || row?.option, 180),
      color: cleanText(row?.color, 100),
      size: cleanText(row?.size, 100),
      stock: finiteNumber(row?.stock ?? row?.quantity ?? row?.qty),
      price: finiteNumber(row?.price),
      salePrice: finiteNumber(row?.salePrice ?? row?.sale_price),
      active: row?.active !== false && row?.enabled !== false,
    })),
  };

  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)),
  );
}

function compactCategory(category: any): Record<string, any> {
  const imageUrl = safePublicImageUrl(category?.imageUrl || category?.iconUrl);
  return Object.fromEntries(Object.entries({
    id: cleanText(category?.id, 200),
    title: cleanText(category?.title ?? category?.name, 300),
    name: cleanText(category?.name ?? category?.title, 300),
    slug: cleanText(category?.slug, 300),
    imageUrl,
    active: category?.active !== false,
    sortOrder: finiteNumber(category?.sortOrder ?? category?.order),
  }).filter(([, value]) => value !== undefined && value !== ''));
}

function publicStorefrontValue(value: unknown, depth = 0): unknown {
  if (depth > 5 || value == null) return value == null ? value : undefined;
  if (typeof value === 'string') return value.slice(0, 4000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => publicStorefrontValue(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/(password|secret|token|api[_-]?key|credential|private[_-]?key)/i.test(key)) continue;
      const safe = publicStorefrontValue(item, depth + 1);
      if (safe !== undefined) output[key] = safe;
    }
    return output;
  }
  return undefined;
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/');
}

function htmlToText(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--([\s\S]*?)-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

function titleFromHtml(html: string, path: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanText(match ? htmlToText(match[1]) : path === '/' ? 'Home' : path, 300);
}

function canonicalOrigin() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || 'https://primehubmall.com').replace(/\/+$/, '');
}

function routePath(value: string) {
  try {
    const url = new URL(value, canonicalOrigin());
    return `${url.pathname}${url.search}`;
  } catch {
    return '';
  }
}

async function fetchText(url: string, timeoutMs = 8000) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': 'PrimeHub-Salar-Catalogue/1.0' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Website read failed ${response.status} for ${url}`);
  return response.text();
}

async function discoverPagePaths(origin: string) {
  const origins = [...new Set([origin.replace(/\/+$/, ''), canonicalOrigin()])];
  for (const base of origins) {
    try {
      const xml = await fetchText(`${base}/sitemap.xml`);
      const paths = Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi))
        .map((match) => routePath(decodeHtml(match[1].trim())))
        .filter(Boolean)
        .filter((path) => !path.startsWith('/product/'));
      if (paths.length) return [...new Set(paths)].slice(0, MAX_PAGE_COUNT);
    } catch (error) {
      console.warn('Salar sitemap discovery failed', error);
    }
  }
  return ['/'];
}

async function readPage(origin: string, path: string) {
  const bases = [...new Set([origin.replace(/\/+$/, ''), canonicalOrigin()])];
  for (const base of bases) {
    try {
      const html = await fetchText(`${base}${path}`);
      const text = htmlToText(html).slice(0, MAX_PAGE_TEXT);
      if (text) return { path, title: titleFromHtml(html, path), text };
    } catch (error) {
      console.warn(`Salar page read failed for ${path}`, error);
    }
  }
  return null;
}

async function crawlWebsite(origin: string) {
  const paths = await discoverPagePaths(origin);
  const pages: SalarCatalogue['pages'] = [];
  const queue = [...paths];

  const worker = async () => {
    while (queue.length) {
      const path = queue.shift();
      if (!path) continue;
      const page = await readPage(origin, path);
      if (page) pages.push(page);
    }
  };

  await Promise.all(Array.from({ length: Math.min(4, Math.max(1, queue.length)) }, () => worker()));
  const order = new Map(paths.map((path, index) => [path, index]));
  return pages.sort((a, b) => (order.get(a.path) ?? 999) - (order.get(b.path) ?? 999));
}

function normalizeState(payload: Record<string, any> | null): SalarState {
  if (!payload) return { ...DEFAULT_STATE };
  return {
    version: 1,
    enabled: payload.enabled !== false,
    instructions: cleanInstructions(payload.instructions),
    orderInstructions: cleanInstructions(payload.orderInstructions),
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
    catalogue: payload.catalogue && typeof payload.catalogue === 'object'
      ? payload.catalogue as SalarCatalogue
      : null,
  };
}

async function readSalarStateFromDatabase() {
  const payload = await getSupabasePrimaryPayload('settings', SALAR_SETTINGS_ID);
  return normalizeState(payload);
}

const readCachedSalarState = unstable_cache(
  readSalarStateFromDatabase,
  ['primehub-salar-state-v1'],
  { revalidate: 3600, tags: [SALAR_STATE_TAG] },
);

export function getSalarState() {
  return readCachedSalarState();
}

async function persistSalarState(state: SalarState) {
  const row = mapDocumentToSupabase('settings', SALAR_SETTINGS_ID, state, 'supabase');
  if (!row) throw new Error('Could not build Salar settings row.');
  await supabasePrimaryUpsert({ table: 'settings', row });
  revalidateTag(SALAR_STATE_TAG, 'max');
  return state;
}

export async function saveSalarSettings(input: { enabled?: unknown; instructions?: unknown; orderInstructions?: unknown }) {
  const current = await readSalarStateFromDatabase();
  const next: SalarState = {
    ...current,
    enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
    instructions: cleanInstructions(input.instructions ?? current.instructions),
    orderInstructions: cleanInstructions(input.orderInstructions ?? current.orderInstructions),
    updatedAt: new Date().toISOString(),
  };
  return persistSalarState(next);
}

export async function refreshSalarCatalogue(origin: string) {
  const [catalogueResult, storefront, pages] = await Promise.all([
    getFreshPublicCatalogSnapshot(),
    getFreshStorefrontSettingsSnapshot().catch((error) => {
      console.warn('Salar storefront settings refresh failed', error);
      return {} as Record<string, unknown>;
    }),
    crawlWebsite(origin),
  ]);

  const products = catalogueResult.products
    .filter((product: any) => product?.active !== false && product?.published !== false)
    .map(compactProduct);
  const categories = catalogueResult.categories
    .filter((category: any) => category?.active !== false)
    .map(compactCategory);
  const safeStorefront = publicStorefrontValue(storefront);

  const catalogue: SalarCatalogue = {
    updatedAt: new Date().toISOString(),
    source: catalogueResult.source,
    products,
    categories,
    pages,
    storefront: safeStorefront && typeof safeStorefront === 'object' && !Array.isArray(safeStorefront)
      ? safeStorefront as Record<string, unknown>
      : {},
  };

  const current = await readSalarStateFromDatabase();
  const next: SalarState = {
    ...current,
    updatedAt: catalogue.updatedAt,
    catalogue,
  };
  await persistSalarState(next);
  return next;
}

function configuredKeys(...bases: string[]) {
  const raw: Array<string | undefined> = [];
  for (const base of bases) {
    raw.push(process.env[base], process.env[`${base}S`]);
    for (let index = 1; index <= MAX_KEYS_PER_PROVIDER; index += 1) {
      raw.push(process.env[`${base}_${index}`], process.env[`${base}${index}`]);
    }
  }
  return [...new Set(raw
    .flatMap((value) => String(value || '').split(/[\n,;]+/))
    .map((value) => value.trim())
    .filter(Boolean))].slice(0, MAX_KEYS_PER_PROVIDER);
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = cleanText(process.env[name], 300);
    if (value) return value;
  }
  return '';
}

export function getSalarRuntimeStatus() {
  const providers = [
    {
      provider: 'groq',
      keys: configuredKeys('GROQ_API_KEY', 'SALAAR_GROQ_API_KEY'),
      model: envValue('GROQ_MODEL', 'SALAAR_GROQ_MODEL'),
      visionModel: envValue('GROQ_VISION_MODEL', 'SALAAR_GROQ_VISION_MODEL'),
    },
    {
      provider: 'gemini',
      keys: configuredKeys('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY', 'SALAAR_GEMINI_API_KEY'),
      model: envValue('GEMINI_MODEL', 'SALAAR_GEMINI_MODEL'),
      visionModel: envValue('GEMINI_VISION_MODEL', 'SALAAR_GEMINI_VISION_MODEL'),
    },
    {
      provider: 'openrouter',
      keys: configuredKeys('OPENROUTER_API_KEY', 'OPEN_ROUTER_API_KEY', 'SALAAR_OPENROUTER_API_KEY'),
      model: envValue('OPENROUTER_MODEL', 'OPEN_ROUTER_MODEL', 'SALAAR_OPENROUTER_MODEL'),
      visionModel: envValue('OPENROUTER_VISION_MODEL', 'OPEN_ROUTER_VISION_MODEL', 'SALAAR_OPENROUTER_VISION_MODEL'),
    },
  ].map((provider) => ({
    provider: provider.provider,
    configured: Boolean(provider.keys.length && provider.model),
    keyCount: provider.keys.length,
    model: provider.model,
    visionConfigured: Boolean(provider.keys.length && provider.visionModel),
    visionModel: provider.visionModel,
  }));

  return {
    providers,
    ready: providers.some((provider) => provider.configured),
  };
}
