export type KnowledgeSource = 'firebase' | 'supabase' | 'empty';

export type SalaarPriceBucket = {
  id: string;
  label: string;
  maxPrice?: number;
  type?: string;
  sortOrder?: number;
};

export type SalaarDeal = {
  id: string;
  title: string;
  label?: string;
  day?: string;
  dealPrice?: number;
  originalPrice?: number;
  productId?: string;
  href?: string;
  buttonText?: string;
};

export type SalaarStoreKnowledge = {
  refreshedAt: string;
  sources: {
    settings: KnowledgeSource;
    categories: KnowledgeSource;
    skills: KnowledgeSource;
  };
  store: {
    name: string;
    announcement?: string;
    whatsapp?: string;
    email?: string;
    address?: string;
  };
  delivery: {
    freeDeliveryEnabled?: boolean;
    itemThreshold?: number;
    freeDeliveryMessage?: string;
    unlockedMessage?: string;
  };
  priceBuckets: SalaarPriceBucket[];
  bigDeal?: SalaarDeal;
  weeklyDeals: SalaarDeal[];
  policies: {
    returnPolicy?: string;
    privacyPolicy?: string;
    storePolicyInfo?: string;
  };
  categories: Array<{ id: string; name: string; slug?: string }>;
  skills: Array<{ id: string; title: string; description?: string; price?: number; href: string }>;
  publicFacts: Array<{ path: string; value: string | number | boolean }>;
};

type BuildInput = {
  documents: Record<string, any>;
  categories: any[];
  skills: any[];
  sources: SalaarStoreKnowledge['sources'];
  refreshedAt?: string;
};

const BLOCKED_KEY_PARTS = new Set([
  'api',
  'key',
  'secret',
  'token',
  'password',
  'credential',
  'credentials',
  'private',
  'service',
  'role',
  'firebase',
  'supabase',
  'admin',
  'auth',
  'bearer',
]);
const PRESENTATION_ONLY_KEY = /(?:image|icon|accent|colour|color|created.?at|updated.?at|timestamp)/i;

function keyParts(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .split('_')
    .filter(Boolean);
}

function isBlockedKey(key: string): boolean {
  const parts = keyParts(key);
  if (parts.some((part) => BLOCKED_KEY_PARTS.has(part))) return true;
  const compact = parts.join('');
  return /(?:apikey|secretkey|accesstoken|refreshtoken|servicerole|privatekey|clientsecret|clienttoken)/i.test(compact);
}

function cleanString(value: unknown, max = 800): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function safeDocumentValue(value: unknown, path: string, out: SalaarStoreKnowledge['publicFacts'], depth = 0) {
  if (out.length >= 120 || depth > 4 || value == null) return;

  const parsed = parseMaybeJson(value);
  if (parsed !== value) {
    safeDocumentValue(parsed, path, out, depth + 1);
    return;
  }

  if (typeof value === 'string') {
    const text = cleanString(value, 500);
    if (text) out.push({ path, value: text });
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    out.push({ path, value });
    return;
  }
  if (typeof value === 'boolean') {
    out.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.slice(0, 24).forEach((item, index) => safeDocumentValue(item, `${path}[${index}]`, out, depth + 1));
    return;
  }
  if (typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isBlockedKey(key) || PRESENTATION_ONLY_KEY.test(key)) continue;
    safeDocumentValue(child, path ? `${path}.${key}` : key, out, depth + 1);
    if (out.length >= 120) break;
  }
}

function publicFacts(documents: Record<string, any>) {
  const facts: SalaarStoreKnowledge['publicFacts'] = [];
  for (const [documentId, document] of Object.entries(documents || {})) {
    if (isBlockedKey(documentId)) continue;
    safeDocumentValue(document, `settings.${documentId}`, facts);
    if (facts.length >= 120) break;
  }
  return facts;
}

function dealFrom(value: any, fallbackId: string): SalaarDeal | undefined {
  if (!value || value.active === false) return undefined;
  const title = cleanString(value.title || value.label, 220);
  if (!title) return undefined;
  return {
    id: cleanString(value.id || fallbackId, 120) || fallbackId,
    title,
    label: cleanString(value.label, 120) || undefined,
    day: cleanString(value.day, 40) || undefined,
    dealPrice: cleanNumber(value.dealPrice),
    originalPrice: cleanNumber(value.originalPrice),
    productId: cleanString(value.productId, 160) || undefined,
    href: cleanString(value.buttonLink || value.href, 300) || undefined,
    buttonText: cleanString(value.buttonText, 100) || undefined,
  };
}

function activePriceBuckets(main: any): SalaarPriceBucket[] {
  const buckets = Array.isArray(main?.priceBuckets) ? main.priceBuckets : [];
  return buckets
    .filter((bucket: any) => bucket && bucket.active !== false)
    .map((bucket: any, index: number) => ({
      id: cleanString(bucket.id || bucket.title || `bucket-${index + 1}`, 120) || `bucket-${index + 1}`,
      label: cleanString(bucket.title || bucket.label || `Budget ${index + 1}`, 160),
      ...(cleanNumber(bucket.amount) != null && Number(bucket.amount) > 0 ? { maxPrice: Number(bucket.amount) } : {}),
      ...(cleanString(bucket.type, 80) ? { type: cleanString(bucket.type, 80) } : {}),
      ...(cleanNumber(bucket.sortOrder) != null ? { sortOrder: cleanNumber(bucket.sortOrder) } : {}),
    }))
    .filter((bucket: SalaarPriceBucket) => Boolean(bucket.label))
    .sort((a: SalaarPriceBucket, b: SalaarPriceBucket) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999));
}

function deliveryInfo(main: any, general: any): SalaarStoreKnowledge['delivery'] {
  const parsed = parseMaybeJson(main?.freeDelivery);
  const object = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  const threshold = cleanNumber(object.itemThreshold ?? main?.freeShippingCount ?? general?.freeDeliveryThreshold);
  const enabledValue = object.enabled ?? (typeof main?.freeDelivery === 'boolean' ? main.freeDelivery : undefined);
  return {
    ...(typeof enabledValue === 'boolean' ? { freeDeliveryEnabled: enabledValue } : {}),
    ...(threshold != null && threshold >= 0 ? { itemThreshold: threshold } : {}),
    ...(cleanString(object.message, 300) ? { freeDeliveryMessage: cleanString(object.message, 300) } : {}),
    ...(cleanString(object.unlockedMessage, 300) ? { unlockedMessage: cleanString(object.unlockedMessage, 300) } : {}),
  };
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const text = cleanString(value, 1200);
    if (text) return text;
  }
  return '';
}

export function buildSalaarStoreKnowledge(input: BuildInput): SalaarStoreKnowledge {
  const documents = input.documents || {};
  const main = documents.main || {};
  const general = documents.general || {};
  const contact = documents.contact || {};
  const policy = documents.policy || {};

  const bigDeal = dealFrom(main.dailyDeal, 'big-deal');
  const weeklyDeals = (Array.isArray(main.weeklyDeals) ? main.weeklyDeals : [])
    .map((deal: any, index: number) => dealFrom(deal, `weekly-${index + 1}`))
    .filter((deal: SalaarDeal | undefined): deal is SalaarDeal => Boolean(deal));

  const categories = (Array.isArray(input.categories) ? input.categories : [])
    .filter((category) => category && category.active !== false)
    .map((category) => ({
      id: String(category.id ?? ''),
      name: cleanString(category.name || category.title, 180),
      slug: cleanString(category.slug, 180) || undefined,
    }))
    .filter((category) => category.id && category.name);

  const skills = (Array.isArray(input.skills) ? input.skills : [])
    .filter((skill) => skill && skill.active !== false)
    .map((skill) => ({
      id: String(skill.id ?? ''),
      title: cleanString(skill.title || skill.name, 180),
      description: cleanString(skill.description, 420) || undefined,
      price: cleanNumber(skill.price),
      href: `/skills/${encodeURIComponent(String(skill.id ?? ''))}`,
    }))
    .filter((skill) => skill.id && skill.title);

  return {
    refreshedAt: input.refreshedAt || new Date().toISOString(),
    sources: input.sources,
    store: {
      name: firstNonEmpty(main.storeName, general.storeName, 'PrimeHub'),
      announcement: firstNonEmpty(main.announcementText, general.announcementText) || undefined,
      whatsapp: firstNonEmpty(contact.whatsappNumber, general.whatsappNumber, main.whatsappNumber) || undefined,
      email: firstNonEmpty(contact.email) || undefined,
      address: firstNonEmpty(contact.physicalAddress, contact.address) || undefined,
    },
    delivery: deliveryInfo(main, general),
    priceBuckets: activePriceBuckets(main),
    bigDeal,
    weeklyDeals,
    policies: {
      returnPolicy: firstNonEmpty(policy.returnPolicy) || undefined,
      privacyPolicy: firstNonEmpty(policy.privacyPolicy) || undefined,
      storePolicyInfo: firstNonEmpty(general.storePolicyInfo, main.storePolicyInfo) || undefined,
    },
    categories,
    skills,
    publicFacts: publicFacts(documents),
  };
}

function money(value?: number) {
  return value != null && Number.isFinite(value) ? `Rs ${Math.round(value).toLocaleString('en-PK')}` : '';
}

function shortPolicy(value?: string) {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 420);
}

export function directStoreKnowledgeReply(message: string, knowledge: SalaarStoreKnowledge): { text: string; link?: { href: string; label: string } } | null {
  const value = message.trim().toLowerCase();

  if (/\bbig\s*deal\b/i.test(value) && knowledge.bigDeal) {
    const deal = knowledge.bigDeal;
    const price = money(deal.dealPrice);
    const original = money(deal.originalPrice);
    const saving = price && original ? ` (${original} se)` : '';
    return {
      text: `Ji, abhi Big Deal “${deal.title}” hai${price ? ` — ${price}${saving}` : ''}.`,
      ...(deal.href ? { link: { href: deal.href, label: deal.buttonText || 'Open Big Deal' } } : {}),
    };
  }

  if (/(free\s*delivery|delivery\s*free|free\s*shipping)/i.test(value) && knowledge.delivery.itemThreshold != null) {
    const enabled = knowledge.delivery.freeDeliveryEnabled;
    if (enabled === false) return { text: 'Ji, free delivery is waqt active nahi hai.' };
    return { text: `Ji, ${knowledge.delivery.itemThreshold} items par free delivery unlock hoti hai.` };
  }

  if (/(address|location|shop\s*kahan|dukan\s*kahan|store\s*kahan)/i.test(value) && knowledge.store.address) {
    return { text: `Ji, hamara address: ${knowledge.store.address}` };
  }

  if (/(whatsapp|contact\s*number|phone\s*number|number\s*kya)/i.test(value) && knowledge.store.whatsapp) {
    return { text: `Ji, PrimeHub WhatsApp: ${knowledge.store.whatsapp}` };
  }

  if (/(return|exchange|refund)/i.test(value) && knowledge.policies.returnPolicy) {
    return { text: shortPolicy(knowledge.policies.returnPolicy) };
  }

  if (/privacy\s*policy/i.test(value) && knowledge.policies.privacyPolicy) {
    return { text: shortPolicy(knowledge.policies.privacyPolicy) };
  }

  return null;
}

export function storeKnowledgePromptContext(knowledge: SalaarStoreKnowledge): string {
  const lines: string[] = [];
  lines.push(`Store=${knowledge.store.name}`);
  if (knowledge.store.announcement) lines.push(`Announcement=${knowledge.store.announcement}`);
  if (knowledge.store.whatsapp) lines.push(`WhatsApp=${knowledge.store.whatsapp}`);
  if (knowledge.store.address) lines.push(`Address=${knowledge.store.address}`);
  if (knowledge.delivery.itemThreshold != null) lines.push(`Free delivery threshold=${knowledge.delivery.itemThreshold} items; enabled=${knowledge.delivery.freeDeliveryEnabled !== false}`);
  if (knowledge.bigDeal) {
    lines.push(`Big Deal=${knowledge.bigDeal.title}${knowledge.bigDeal.dealPrice != null ? ` | ${money(knowledge.bigDeal.dealPrice)}` : ''}${knowledge.bigDeal.originalPrice != null ? ` | original ${money(knowledge.bigDeal.originalPrice)}` : ''}${knowledge.bigDeal.href ? ` | ${knowledge.bigDeal.href}` : ''}`);
  }
  if (knowledge.priceBuckets.length) {
    lines.push(`Price buckets=${knowledge.priceBuckets.map((bucket) => `${bucket.label}${bucket.maxPrice != null ? `<=${bucket.maxPrice}` : ''}`).join(' | ')}`);
  }
  if (knowledge.weeklyDeals.length) {
    lines.push(`Weekly deals=${knowledge.weeklyDeals.slice(0, 7).map((deal) => `${deal.day || 'deal'}:${deal.title}${deal.dealPrice != null ? ` ${money(deal.dealPrice)}` : ''}`).join(' | ')}`);
  }
  if (knowledge.categories.length) lines.push(`Categories=${knowledge.categories.slice(0, 40).map((category) => category.name).join(', ')}`);
  if (knowledge.skills.length) lines.push(`Prime Skills=${knowledge.skills.slice(0, 12).map((skill) => skill.title).join(', ')}`);
  if (knowledge.policies.storePolicyInfo) lines.push(`Store policy=${shortPolicy(knowledge.policies.storePolicyInfo)}`);
  if (knowledge.policies.returnPolicy) lines.push(`Return policy=${shortPolicy(knowledge.policies.returnPolicy)}`);

  const knownPrefixes = [
    'settings.main.priceBuckets',
    'settings.main.dailyDeal',
    'settings.main.weeklyDeals',
    'settings.contact',
    'settings.policy',
  ];
  const futureFacts = knowledge.publicFacts
    .filter((fact) => !knownPrefixes.some((prefix) => fact.path.startsWith(prefix)))
    .slice(0, 40)
    .map((fact) => `${fact.path}=${String(fact.value).slice(0, 240)}`);
  if (futureFacts.length) lines.push(`Other safe admin-managed facts:\n${futureFacts.join('\n')}`);

  return lines.join('\n').slice(0, 6500);
}
