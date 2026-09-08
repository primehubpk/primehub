import 'server-only';
import { isR2PublicUrl } from '@/lib/r2';

export type SalaarProvider = 'groq' | 'openrouter' | 'gemini';
export type SalaarAiHistory = { role: 'customer' | 'salaar'; text: string };

export type SalaarAiRequest = {
  system: string;
  user: string;
  history: SalaarAiHistory[];
  imageUrls?: string[];
};

type KeyHealth = {
  failures: number;
  cooldownUntil: number;
  lastFailureAt: number;
};

class SalaarProviderError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SalaarProviderError';
    this.status = status;
  }
}

let rotationCursor = 0;
const keyHealth = new Map<string, KeyHealth>();

const TEXT_TIMEOUT_MS = Math.max(3000, Number(process.env.SALAAR_AI_TIMEOUT_MS || 9000));
const VISION_TIMEOUT_MS = Math.max(TEXT_TIMEOUT_MS, Number(process.env.SALAAR_VISION_TIMEOUT_MS || 14000));
const FAILURE_THRESHOLD = Math.max(1, Number(process.env.SALAAR_AI_FAILURE_THRESHOLD || 2));
const DEFAULT_COOLDOWN_MS = Math.max(15000, Number(process.env.SALAAR_AI_COOLDOWN_MS || 90_000));
const LONG_COOLDOWN_MS = Math.max(DEFAULT_COOLDOWN_MS, Number(process.env.SALAAR_AI_LONG_COOLDOWN_MS || 5 * 60_000));

function cleanText(value: unknown, max = 900): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function splitKeys(value?: string): string[] {
  if (!value) return [];
  return value.split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean);
}

function providerKeys(provider: SalaarProvider): string[] {
  if (provider === 'groq') return [...splitKeys(process.env.GROQ_API_KEYS), ...splitKeys(process.env.GROQ_API_KEY)];
  if (provider === 'openrouter') return [...splitKeys(process.env.OPENROUTER_API_KEYS), ...splitKeys(process.env.OPENROUTER_API_KEY)];
  return [...splitKeys(process.env.GEMINI_API_KEYS), ...splitKeys(process.env.GEMINI_API_KEY)];
}

function keyId(provider: SalaarProvider, key: string) {
  // The full key is used only as an in-memory map key and is never logged or returned.
  return `${provider}:${key}`;
}

function healthFor(provider: SalaarProvider, key: string): KeyHealth {
  return keyHealth.get(keyId(provider, key)) || { failures: 0, cooldownUntil: 0, lastFailureAt: 0 };
}

function isCooling(provider: SalaarProvider, key: string, now = Date.now()) {
  return healthFor(provider, key).cooldownUntil > now;
}

function recordFailure(provider: SalaarProvider, key: string, error: unknown) {
  const id = keyId(provider, key);
  const previous = healthFor(provider, key);
  const failures = previous.failures + 1;
  const status = error instanceof SalaarProviderError ? error.status : undefined;
  const hardFailure = status === 401 || status === 403 || status === 429;
  const shouldCool = hardFailure || failures >= FAILURE_THRESHOLD;
  keyHealth.set(id, {
    failures,
    lastFailureAt: Date.now(),
    cooldownUntil: shouldCool ? Date.now() + (hardFailure ? LONG_COOLDOWN_MS : DEFAULT_COOLDOWN_MS) : 0,
  });
}

function recordSuccess(provider: SalaarProvider, key: string) {
  keyHealth.delete(keyId(provider, key));
}

function rotated<T>(items: T[], offset: number): T[] {
  if (!items.length) return items;
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function usableKeys(provider: SalaarProvider, offset: number) {
  const all = rotated(providerKeys(provider), offset);
  const active = all.filter((key) => !isCooling(provider, key));
  // If every key is cooling, keep the request fast and move to another provider.
  return active;
}

function validImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item && isR2PublicUrl(item))
    .slice(0, 2);
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  request: SalaarAiRequest,
  images: string[],
): Promise<string> {
  const userContent: any = images.length
    ? [
        { type: 'text', text: request.user },
        ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
      ]
    : request.user;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: images.length ? 260 : 180,
      messages: [
        { role: 'system', content: request.system },
        ...request.history.slice(-8).map((m) => ({ role: m.role === 'customer' ? 'user' : 'assistant', content: m.text })),
        { role: 'user', content: userContent },
      ],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(images.length ? VISION_TIMEOUT_MS : TEXT_TIMEOUT_MS),
  });
  if (!response.ok) throw new SalaarProviderError(`provider ${response.status}`, response.status);
  const data = await response.json();
  const text = cleanText(data?.choices?.[0]?.message?.content, 900);
  if (!text) throw new SalaarProviderError('empty provider reply');
  return text;
}

async function r2ImageInlinePart(url: string) {
  if (!isR2PublicUrl(url)) throw new Error('Untrusted image URL');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`image fetch ${response.status}`);
  const contentType = String(response.headers.get('content-type') || 'image/webp').split(';')[0].trim();
  if (!contentType.startsWith('image/')) throw new Error('Vision input is not an image');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('Vision image is too large');
  return { inlineData: { mimeType: contentType, data: bytes.toString('base64') } };
}

async function callGemini(
  apiKey: string,
  model: string,
  request: SalaarAiRequest,
  images: string[],
): Promise<string> {
  const imageParts = images.length ? await Promise.all(images.map(r2ImageInlinePart)) : [];
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [
        ...request.history.slice(-8).map((m) => ({ role: m.role === 'customer' ? 'user' : 'model', parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: request.user }, ...imageParts] },
      ],
      generationConfig: { temperature: 0.3, maxOutputTokens: images.length ? 260 : 180 },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(images.length ? VISION_TIMEOUT_MS : TEXT_TIMEOUT_MS),
  });
  if (!response.ok) throw new SalaarProviderError(`gemini ${response.status}`, response.status);
  const data = await response.json();
  const text = cleanText(data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('\n'), 900);
  if (!text) throw new SalaarProviderError('empty Gemini reply');
  return text;
}

export function sanitizeSalaarImageUrls(value: unknown) {
  return validImageUrls(value);
}

export function getSalaarAiHealthSnapshot() {
  const now = Date.now();
  const providers = (['groq', 'openrouter', 'gemini'] as SalaarProvider[]).map((provider) => {
    const keys = providerKeys(provider);
    const cooling = keys.filter((key) => isCooling(provider, key, now)).length;
    return {
      provider,
      configuredKeys: keys.length,
      availableKeys: Math.max(0, keys.length - cooling),
      coolingKeys: cooling,
    };
  });
  return {
    providers,
    totalConfiguredKeys: providers.reduce((sum, item) => sum + item.configuredKeys, 0),
    totalAvailableKeys: providers.reduce((sum, item) => sum + item.availableKeys, 0),
    timeoutMs: TEXT_TIMEOUT_MS,
    visionTimeoutMs: VISION_TIMEOUT_MS,
    failureThreshold: FAILURE_THRESHOLD,
    cooldownMs: DEFAULT_COOLDOWN_MS,
  };
}

export async function runSalaarAi(request: SalaarAiRequest): Promise<{ text: string; provider: SalaarProvider; vision: boolean }> {
  const images = validImageUrls(request.imageUrls);
  const vision = images.length > 0;
  const start = rotationCursor++;

  const providers: SalaarProvider[] = vision
    ? ['openrouter', 'gemini', ...(process.env.SALAAR_GROQ_VISION_MODEL ? ['groq' as const] : [])]
    : rotated<SalaarProvider>(['groq', 'openrouter', 'gemini'], start);

  for (const provider of providers) {
    const keys = usableKeys(provider, start);
    for (const key of keys) {
      try {
        let text = '';
        if (provider === 'groq') {
          const model = vision
            ? process.env.SALAAR_GROQ_VISION_MODEL?.trim()
            : process.env.SALAAR_GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
          if (!model) continue;
          text = await callOpenAiCompatible('https://api.groq.com/openai/v1', key, model, request, images);
        } else if (provider === 'openrouter') {
          const model = vision
            ? process.env.SALAAR_OPENROUTER_VISION_MODEL?.trim() || process.env.SALAAR_OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash'
            : process.env.SALAAR_OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash';
          text = await callOpenAiCompatible('https://openrouter.ai/api/v1', key, model, request, images);
        } else {
          const model = vision
            ? process.env.SALAAR_GEMINI_VISION_MODEL?.trim() || process.env.SALAAR_GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
            : process.env.SALAAR_GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
          text = await callGemini(key, model, request, images);
        }
        recordSuccess(provider, key);
        return { text, provider, vision };
      } catch (error) {
        recordFailure(provider, key, error);
        const status = error instanceof SalaarProviderError && error.status ? ` status=${error.status}` : '';
        console.warn(`Salaar ${provider}${vision ? ' vision' : ''} key failed; rotating.${status}`);
      }
    }
  }

  throw new Error(vision ? 'No working Salaar vision provider key' : 'No working Salaar LLM provider key');
}
