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

let rotationCursor = 0;

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

function rotated<T>(items: T[], offset: number): T[] {
  if (!items.length) return items;
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
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
  });
  if (!response.ok) throw new Error(`provider ${response.status}`);
  const data = await response.json();
  const text = cleanText(data?.choices?.[0]?.message?.content, 900);
  if (!text) throw new Error('empty provider reply');
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
  });
  if (!response.ok) throw new Error(`gemini ${response.status}`);
  const data = await response.json();
  const text = cleanText(data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('\n'), 900);
  if (!text) throw new Error('empty Gemini reply');
  return text;
}

export function sanitizeSalaarImageUrls(value: unknown) {
  return validImageUrls(value);
}

export async function runSalaarAi(request: SalaarAiRequest): Promise<{ text: string; provider: SalaarProvider; vision: boolean }> {
  const images = validImageUrls(request.imageUrls);
  const vision = images.length > 0;
  const start = rotationCursor++;

  const providers: SalaarProvider[] = vision
    ? ['openrouter', 'gemini', ...(process.env.SALAAR_GROQ_VISION_MODEL ? ['groq' as const] : [])]
    : rotated<SalaarProvider>(['groq', 'openrouter', 'gemini'], start);

  for (const provider of providers) {
    const keys = rotated(providerKeys(provider), start);
    for (const key of keys) {
      try {
        if (provider === 'groq') {
          const model = vision
            ? process.env.SALAAR_GROQ_VISION_MODEL?.trim()
            : process.env.SALAAR_GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
          if (!model) continue;
          const text = await callOpenAiCompatible('https://api.groq.com/openai/v1', key, model, request, images);
          return { text, provider, vision };
        }
        if (provider === 'openrouter') {
          const model = vision
            ? process.env.SALAAR_OPENROUTER_VISION_MODEL?.trim() || process.env.SALAAR_OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash'
            : process.env.SALAAR_OPENROUTER_MODEL?.trim() || 'google/gemini-2.5-flash';
          const text = await callOpenAiCompatible('https://openrouter.ai/api/v1', key, model, request, images);
          return { text, provider, vision };
        }
        const model = vision
          ? process.env.SALAAR_GEMINI_VISION_MODEL?.trim() || process.env.SALAAR_GEMINI_MODEL?.trim() || 'gemini-2.5-flash'
          : process.env.SALAAR_GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
        const text = await callGemini(key, model, request, images);
        return { text, provider, vision };
      } catch (error) {
        console.warn(`Salaar ${provider}${vision ? ' vision' : ''} key failed; rotating`, error);
      }
    }
  }

  throw new Error(vision ? 'No working Salaar vision provider key' : 'No working Salaar LLM provider key');
}
