import 'server-only';

import { getSupabasePrimaryPayload, mapDocumentToSupabase, supabasePrimaryUpsert } from '@/lib/dualWriteServer';

export type SalarStoredDisplayMode = 'none' | 'products' | 'categories' | 'product_images';

export type SalarStoredProduct = {
  id: string;
  title: string;
  path?: string;
  imageUrl?: string;
  imageUrls?: string[];
  variantColors?: Array<{ name: string; imageUrl?: string }>;
  price?: number;
  originalPrice?: number;
  stock?: number;
  category?: string;
};

export type SalarStoredCategory = {
  id: string;
  title: string;
  slug?: string;
  imageUrl?: string;
};

export type SalarStoredMention = {
  id: string;
  title: string;
  imageUrl?: string;
};

export type SalarStoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  actor: 'customer' | 'salar' | 'admin';
  content: string;
  createdAt: string;
  imageUrl?: string;
  imageAnalysis?: string;
  mention?: SalarStoredMention;
  products?: SalarStoredProduct[];
  categories?: SalarStoredCategory[];
  displayMode?: SalarStoredDisplayMode;
};

export type SalarStoredContext = {
  lastProductQuery?: string;
  shownProductIds?: string[];
  confirmedOrderProductIds?: string[];
};

export type SalarCustomerChat = {
  version: 1;
  id: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
  lastCustomerAt?: string;
  lastSalarAt?: string;
  lastAdminAt?: string;
  salarPaused: boolean;
  context: SalarStoredContext;
  messages: SalarStoredMessage[];
};

export type SalarChatSummary = {
  id: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  salarPaused: boolean;
  lastPreview: string;
  lastActor: SalarStoredMessage['actor'] | null;
  messageCount: number;
  imageUrl?: string;
};

type SalarStoredListSummary = Omit<SalarChatSummary, 'active'>;

const ROW_PREFIX = 'salar_chat_';
const MAX_MESSAGES = 100;
const MAX_PRODUCTS_PER_MESSAGE = 600;
const ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const CHAT_HOT_CACHE_TTL_MS = 15 * 1000;

type ChatCacheEntry = { expiresAt: number; chat: SalarCustomerChat };
type SalarGlobalCache = typeof globalThis & { __primehubSalarChatHotCache?: Map<string, ChatCacheEntry> };
const globalCache = globalThis as SalarGlobalCache;
const chatHotCache = globalCache.__primehubSalarChatHotCache || new Map<string, ChatCacheEntry>();
if (!globalCache.__primehubSalarChatHotCache) globalCache.__primehubSalarChatHotCache = chatHotCache;

function cloneChat(chat: SalarCustomerChat) {
  return JSON.parse(JSON.stringify(chat)) as SalarCustomerChat;
}

function readHotChat(chatId: string) {
  const entry = chatHotCache.get(chatId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    chatHotCache.delete(chatId);
    return null;
  }
  return cloneChat(entry.chat);
}

function rememberHotChat(chat: SalarCustomerChat) {
  chatHotCache.set(chat.id, {
    chat: cloneChat(chat),
    expiresAt: Date.now() + CHAT_HOT_CACHE_TTL_MS,
  });
  if (chatHotCache.size > 250) {
    const now = Date.now();
    for (const [id, entry] of chatHotCache) {
      if (entry.expiresAt <= now) chatHotCache.delete(id);
    }
  }
}

function cleanText(value: unknown, max = 2000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanMultiline(value: unknown, max?: number) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  return typeof max === 'number' ? text.slice(0, max) : text;
}

function safeHttpsUrl(value: unknown) {
  const text = cleanText(value, 1600);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function finiteNumber(value: unknown) {
  if (value === '' || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function iso(value: unknown, fallback = new Date().toISOString()) {
  const text = cleanText(value, 80);
  if (!text) return fallback;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function cleanChatId(value: unknown) {
  const id = String(value ?? '').trim();
  return /^[A-Za-z0-9_-]{12,80}$/.test(id) ? id : '';
}

function rowId(chatId: string) {
  return `${ROW_PREFIX}${chatId}`;
}

function safeDisplayMode(value: unknown): SalarStoredDisplayMode {
  return value === 'products' || value === 'categories' || value === 'product_images' ? value : 'none';
}

function normalizeMention(value: any): SalarStoredMention | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const id = cleanText(value.id, 200);
  const title = cleanText(value.title, 300);
  if (!id || !title) return undefined;
  const imageUrl = safeHttpsUrl(value.imageUrl);
  return { id, title, ...(imageUrl ? { imageUrl } : {}) };
}

function normalizeProducts(value: unknown): SalarStoredProduct[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_PRODUCTS_PER_MESSAGE).map((item: any) => {
    const imageUrl = safeHttpsUrl(item?.imageUrl);
    const imageUrls = Array.isArray(item?.imageUrls)
      ? [...new Set(item.imageUrls.map((url: unknown) => safeHttpsUrl(url)).filter(Boolean))].slice(0, 8)
      : [];
    const variantColors = Array.isArray(item?.variantColors)
      ? item.variantColors.slice(0, 30).map((variant: any) => {
          const name = cleanText(variant?.name ?? variant, 120);
          const variantImage = safeHttpsUrl(variant?.imageUrl);
          return name ? { name, ...(variantImage ? { imageUrl: variantImage } : {}) } : null;
        }).filter(Boolean)
      : [];
    return Object.fromEntries(Object.entries({
      id: cleanText(item?.id, 200),
      title: cleanText(item?.title, 300),
      path: cleanText(item?.path, 500),
      imageUrl: imageUrl || undefined,
      imageUrls: imageUrls.length ? imageUrls : undefined,
      variantColors: variantColors.length ? variantColors : undefined,
      price: finiteNumber(item?.price),
      originalPrice: finiteNumber(item?.originalPrice),
      stock: finiteNumber(item?.stock),
      category: cleanText(item?.category, 220),
    }).filter(([, field]) => field !== undefined && field !== '')) as SalarStoredProduct;
  }).filter((item) => item.id && item.title);
}

function normalizeCategories(value: unknown): SalarStoredCategory[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((item: any) => {
    const imageUrl = safeHttpsUrl(item?.imageUrl);
    return Object.fromEntries(Object.entries({
      id: cleanText(item?.id, 200),
      title: cleanText(item?.title, 300),
      slug: cleanText(item?.slug, 240),
      imageUrl: imageUrl || undefined,
    }).filter(([, field]) => field !== undefined && field !== '')) as SalarStoredCategory;
  }).filter((item) => item.id && item.title);
}

function normalizeMessage(value: any): SalarStoredMessage | null {
  if (!value || typeof value !== 'object') return null;
  const role: SalarStoredMessage['role'] = value.role === 'user' ? 'user' : 'assistant';
  const actor: SalarStoredMessage['actor'] = value.actor === 'admin'
    ? 'admin'
    : value.actor === 'customer' || role === 'user'
      ? 'customer'
      : 'salar';
  const id = cleanText(value.id, 100) || crypto.randomUUID();
  const content = cleanMultiline(value.content);
  const imageUrl = safeHttpsUrl(value.imageUrl);
  const imageAnalysis = cleanMultiline(value.imageAnalysis, 1600);
  const mention = normalizeMention(value.mention);
  const products = normalizeProducts(value.products);
  const categories = normalizeCategories(value.categories);
  const displayMode = safeDisplayMode(value.displayMode);
  if (!content && !imageUrl && !mention && !products.length && !categories.length) return null;
  return {
    id,
    role,
    actor,
    content,
    createdAt: iso(value.createdAt),
    ...(imageUrl ? { imageUrl } : {}),
    ...(imageAnalysis ? { imageAnalysis } : {}),
    ...(mention ? { mention } : {}),
    ...(products.length ? { products } : {}),
    ...(categories.length ? { categories } : {}),
    ...(displayMode !== 'none' ? { displayMode } : {}),
  };
}

function uniqueIds(value: unknown, max = 40) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    const id = cleanText(item, 200);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}

function normalizeContext(value: any): SalarStoredContext {
  if (!value || typeof value !== 'object') return { shownProductIds: [] };
  const confirmedOrderProductIds = uniqueIds(value.confirmedOrderProductIds, 30);
  return {
    lastProductQuery: cleanText(value.lastProductQuery, 500) || undefined,
    shownProductIds: uniqueIds(value.shownProductIds, 200),
    ...(confirmedOrderProductIds.length ? { confirmedOrderProductIds } : {}),
  };
}

function buildSalarChatListSummary(chat: SalarCustomerChat): SalarStoredListSummary {
  const last = [...chat.messages].reverse().find((message) => message.content || message.imageUrl || message.products?.length);
  const firstImage = [...chat.messages].reverse().map((message) => {
    if (message.imageUrl) return message.imageUrl;
    return message.products?.find((product) => product.imageUrl)?.imageUrl || '';
  }).find(Boolean);
  return {
    id: chat.id,
    customerId: chat.customerId,
    customerName: chat.customerName,
    customerEmail: chat.customerEmail,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    salarPaused: chat.salarPaused,
    lastPreview: last?.content || (last?.imageUrl ? 'Customer image' : last?.products?.length ? 'Product results' : ''),
    lastActor: last?.actor || null,
    messageCount: chat.messages.length,
    ...(firstImage ? { imageUrl: firstImage } : {}),
  };
}

function activeSummary(summary: SalarStoredListSummary, now = Date.now()): SalarChatSummary {
  const updated = new Date(summary.updatedAt).getTime();
  return {
    ...summary,
    active: Number.isFinite(updated) ? now - updated <= ACTIVE_WINDOW_MS : false,
  };
}

function normalizeStoredListSummary(value: unknown, requestedId: string, fallbackUpdatedAt = ''): SalarStoredListSummary | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const id = cleanChatId(source.id) || requestedId;
  if (!id) return null;
  const now = new Date().toISOString();
  const imageUrl = safeHttpsUrl(source.imageUrl);
  const actor = source.lastActor === 'customer' || source.lastActor === 'admin' || source.lastActor === 'salar'
    ? source.lastActor
    : null;
  return {
    id,
    customerId: cleanText(source.customerId, 200) || undefined,
    customerName: cleanText(source.customerName, 120) || undefined,
    customerEmail: cleanText(source.customerEmail, 240) || undefined,
    createdAt: iso(source.createdAt, now),
    updatedAt: iso(source.updatedAt || fallbackUpdatedAt, now),
    salarPaused: source.salarPaused === true,
    lastPreview: cleanText(source.lastPreview, 500),
    lastActor: actor,
    messageCount: Math.max(0, Math.min(MAX_MESSAGES, Number(source.messageCount) || 0)),
    ...(imageUrl ? { imageUrl } : {}),
  };
}

function normalizeChat(payload: Record<string, any> | null, requestedId: string): SalarCustomerChat | null {
  if (!payload) return null;
  const id = cleanChatId(payload.id) || requestedId;
  if (!id) return null;
  const now = new Date().toISOString();
  const messages = Array.isArray(payload.messages)
    ? payload.messages.map(normalizeMessage).filter(Boolean).slice(-MAX_MESSAGES) as SalarStoredMessage[]
    : [];
  return {
    version: 1,
    id,
    customerId: cleanText(payload.customerId, 200) || undefined,
    customerName: cleanText(payload.customerName, 120) || undefined,
    customerEmail: cleanText(payload.customerEmail, 240) || undefined,
    createdAt: iso(payload.createdAt, now),
    updatedAt: iso(payload.updatedAt, now),
    lastCustomerAt: payload.lastCustomerAt ? iso(payload.lastCustomerAt) : undefined,
    lastSalarAt: payload.lastSalarAt ? iso(payload.lastSalarAt) : undefined,
    lastAdminAt: payload.lastAdminAt ? iso(payload.lastAdminAt) : undefined,
    salarPaused: payload.salarPaused === true,
    context: normalizeContext(payload.context),
    messages,
  };
}

export function createEmptySalarChat(chatId: string, input?: {
  customerId?: unknown;
  customerName?: unknown;
  customerEmail?: unknown;
  context?: unknown;
}) {
  const id = cleanChatId(chatId);
  if (!id) throw new Error('Invalid Salar chat id.');
  const now = new Date().toISOString();
  return {
    version: 1,
    id,
    customerId: cleanText(input?.customerId, 200) || undefined,
    customerName: cleanText(input?.customerName, 120) || undefined,
    customerEmail: cleanText(input?.customerEmail, 240) || undefined,
    createdAt: now,
    updatedAt: now,
    salarPaused: false,
    context: normalizeContext(input?.context),
    messages: [],
  } satisfies SalarCustomerChat;
}

export async function getSalarChat(chatIdInput: unknown) {
  const chatId = cleanChatId(chatIdInput);
  if (!chatId) return null;
  const cached = readHotChat(chatId);
  if (cached) return cached;
  const payload = await getSupabasePrimaryPayload('settings', rowId(chatId));
  const chat = normalizeChat(payload, chatId);
  if (chat) rememberHotChat(chat);
  return chat;
}

export async function saveSalarChat(chatInput: SalarCustomerChat) {
  const chatId = cleanChatId(chatInput.id);
  if (!chatId) throw new Error('Invalid Salar chat id.');
  const chat = normalizeChat({ ...chatInput, id: chatId }, chatId);
  if (!chat) throw new Error('Invalid Salar chat payload.');
  const next: SalarCustomerChat = {
    ...chat,
    updatedAt: new Date().toISOString(),
    messages: chat.messages.slice(-MAX_MESSAGES),
  };
  const row = mapDocumentToSupabase(
    'settings',
    rowId(chatId),
    { ...next, _listSummary: buildSalarChatListSummary(next) },
    'supabase',
  );
  if (!row) throw new Error('Could not build Salar chat row.');
  await supabasePrimaryUpsert({ table: 'settings', row });
  rememberHotChat(next);
  return next;
}

export function appendSalarMessage(chat: SalarCustomerChat, messageInput: Omit<SalarStoredMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) {
  const message = normalizeMessage({
    ...messageInput,
    id: messageInput.id || crypto.randomUUID(),
    createdAt: messageInput.createdAt || new Date().toISOString(),
  });
  if (!message) return chat;
  const next: SalarCustomerChat = {
    ...chat,
    messages: [...chat.messages, message].slice(-MAX_MESSAGES),
  };
  if (message.actor === 'customer') next.lastCustomerAt = message.createdAt;
  if (message.actor === 'salar') next.lastSalarAt = message.createdAt;
  if (message.actor === 'admin') next.lastAdminAt = message.createdAt;
  return next;
}

export function bootstrapSalarHistory(chat: SalarCustomerChat, history: unknown) {
  if (chat.messages.length || !Array.isArray(history)) return chat;
  const now = Date.now();
  const imported = history.slice(-10).map((item: any, index: number) => normalizeMessage({
    id: `history-${index}-${now}`,
    role: item?.role === 'user' ? 'user' : 'assistant',
    actor: item?.role === 'user' ? 'customer' : 'salar',
    content: cleanMultiline(item?.content),
    createdAt: new Date(now - (history.length - index) * 1000).toISOString(),
  })).filter(Boolean) as SalarStoredMessage[];
  return { ...chat, messages: imported.slice(-MAX_MESSAGES) };
}

export function recentCustomerProductReferences(chat: SalarCustomerChat, max = 12) {
  const output: Array<{ id: string; title: string; imageUrl?: string }> = [];
  const seen = new Set<string>();
  for (const message of [...chat.messages].reverse()) {
    const references = [
      ...(message.products || []).map((product) => ({ id: product.id, title: product.title, imageUrl: product.imageUrl })),
      ...(message.mention ? [{ id: message.mention.id, title: message.mention.title, imageUrl: message.mention.imageUrl }] : []),
    ];
    for (const reference of references) {
      if (!reference.id || seen.has(reference.id)) continue;
      seen.add(reference.id);
      output.push(reference);
      if (output.length >= max) return output;
    }
  }
  return output;
}

export function salarAiHistory(chat: SalarCustomerChat, max = 10) {
  return chat.messages
    .filter((message) => message.content)
    .slice(-Math.max(1, Math.min(40, max)))
    .map((message) => {
      const base = message.actor === 'admin' ? `[PrimeHub Admin message] ${message.content}` : message.content;
      if (message.actor !== 'customer') return { role: message.role, content: base };
      const selected = (message.products || []).slice(0, 12).map((product) => product.title + ' [product id: ' + product.id + ']');
      const mentioned = message.mention ? message.mention.title + ' [product id: ' + message.mention.id + ']' : '';
      const metadata = [
        selected.length ? '[Customer selected exact products: ' + selected.join(' | ') + ']' : '',
        mentioned ? '[Customer referenced exact product: ' + mentioned + ']' : '',
        message.imageAnalysis ? '[Customer image understanding: ' + message.imageAnalysis + ']' : '',
      ].filter(Boolean).join('\n');
      return { role: message.role, content: [base, metadata].filter(Boolean).join('\n') };
    });
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  return { url, key, configured: Boolean(url && key) };
}

export async function listSalarChats(limit = 100): Promise<SalarChatSummary[]> {
  const { url, key, configured } = supabaseConfig();
  if (!configured) throw new Error('Supabase server credentials are not configured.');

  const safeLimit = Math.max(1, Math.min(200, limit));
  const params = new URLSearchParams();
  // New/updated chat rows keep a compact list summary inside the payload. This
  // avoids downloading full message histories and image/product arrays every
  // time the admin chat list refreshes.
  params.set('select', 'id,updated_at,list_summary:payload->_listSummary');
  params.set('id', `like.${ROW_PREFIX}*`);
  params.set('order', 'updated_at.desc');
  params.set('limit', String(safeLimit));

  const response = await fetch(`${url}/rest/v1/settings?${params.toString()}`, {
    method: 'GET',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Salar chat list failed ${response.status}: ${await response.text()}`);

  const rows = await response.json() as Array<{
    id?: string;
    updated_at?: string;
    list_summary?: SalarStoredListSummary | null;
  }>;
  const now = Date.now();
  const summaries = new Map<string, SalarChatSummary>();
  const legacyIds: string[] = [];

  for (const row of rows) {
    const requestedId = String(row.id || '').startsWith(ROW_PREFIX) ? String(row.id).slice(ROW_PREFIX.length) : '';
    if (!requestedId) continue;
    const summary = normalizeStoredListSummary(row.list_summary, requestedId, row.updated_at);
    if (summary) summaries.set(requestedId, activeSummary(summary, now));
    else legacyIds.push(String(row.id || ''));
  }

  // Compatibility path for old rows created before compact summaries existed.
  // Only those rows fetch the full payload; opening a chat still fetches the
  // complete history through getSalarChat as before.
  if (legacyIds.length) {
    const legacyParams = new URLSearchParams();
    legacyParams.set('select', 'id,payload,updated_at');
    legacyParams.set('id', `in.(${legacyIds.map((id) => `"${id.replace(/"/g, '')}"`).join(',')})`);
    legacyParams.set('order', 'updated_at.desc');
    const legacyResponse = await fetch(`${url}/rest/v1/settings?${legacyParams.toString()}`, {
      method: 'GET',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!legacyResponse.ok) throw new Error(`Salar legacy chat list failed ${legacyResponse.status}: ${await legacyResponse.text()}`);
    const legacyRows = await legacyResponse.json() as Array<{ id?: string; payload?: Record<string, any> }>;
    for (const row of legacyRows) {
      const requestedId = String(row.id || '').startsWith(ROW_PREFIX) ? String(row.id).slice(ROW_PREFIX.length) : '';
      const chat = normalizeChat(row.payload || null, requestedId);
      if (chat) summaries.set(chat.id, activeSummary(buildSalarChatListSummary(chat), now));
    }
  }

  return rows
    .map((row) => {
      const requestedId = String(row.id || '').startsWith(ROW_PREFIX) ? String(row.id).slice(ROW_PREFIX.length) : '';
      return requestedId ? summaries.get(requestedId) || null : null;
    })
    .filter(Boolean) as SalarChatSummary[];
}
