import 'server-only';

type SalarPurpose = 'text' | 'vision';
type Provider = 'groq' | 'gemini' | 'openrouter';
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: unknown };
type LastGood = { provider: Provider; index: number; at: number };
type CompletionResult = { text: string; provider: Provider; keyIndex: number };

const LAST_GOOD_TTL_MS = 15 * 60 * 1000;
export const SALAR_SAFE_ERROR_MESSAGE = 'Sorry, Salar is temporarily unavailable. Please contact PrimeHub at 03238878009.';

declare global {
  // eslint-disable-next-line no-var
  var __salarLastGood: LastGood | undefined;
}

class RotatableProviderError extends Error {}
class SalarServiceError extends Error {}

export function parseKeys(value?: string | null): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function currentLastGood(): LastGood | undefined {
  const value = globalThis.__salarLastGood;
  if (!value || Date.now() - value.at > LAST_GOOD_TTL_MS) return undefined;
  return value;
}

function remember(provider: Provider, index: number) {
  globalThis.__salarLastGood = { provider, index, at: Date.now() };
}

function keyOrder(provider: Provider, length: number): number[] {
  if (length <= 0) return [];
  const last = currentLastGood();
  const start = last?.provider === provider && last.index >= 0 && last.index < length ? last.index : 0;
  return Array.from({ length }, (_, offset) => (start + offset) % length);
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return content == null ? '' : String(content);
}

function geminiParts(content: unknown): Array<Record<string, unknown>> {
  if (typeof content === 'string') return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: textFromContent(content) }];

  const parts: Array<Record<string, unknown>> = [];
  for (const item of content) {
    if (!item || typeof item !== 'object') continue;
    const part = item as Record<string, any>;
    if (part.type === 'text' && typeof part.text === 'string') {
      parts.push({ text: part.text });
      continue;
    }
    if (part.type === 'image_url') {
      const url = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
      if (typeof url === 'string') {
        const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
      }
    }
  }
  return parts.length ? parts : [{ text: textFromContent(content) }];
}

function shouldRotate(status: number, payload: string): boolean {
  if ([401, 403, 429].includes(status)) return true;
  return /quota|billing|resource[_\s-]?exhausted|rate[_\s-]?limit|too many requests|api.?key|unauthorized|forbidden|authentication/i.test(payload);
}

async function requestJson(url: string, init: RequestInit): Promise<{ response: Response; text: string; json: any }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { response, text, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGroq(key: string, model: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
  const { response, text, json } = await requestJson('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0, max_tokens: maxTokens }),
  });
  if (!response.ok) {
    if (shouldRotate(response.status, text)) throw new RotatableProviderError('provider rejected key');
    if (response.status === 400 && /vision|image|multimodal|unsupported/i.test(text)) throw new RotatableProviderError('provider cannot serve request');
    throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  }
  const value = json?.choices?.[0]?.message?.content;
  if (typeof value !== 'string' || !value.trim()) throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  return value.trim();
}

async function callOpenRouter(key: string, model: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
  const { response, text, json } = await requestJson('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0, max_tokens: maxTokens }),
  });
  if (!response.ok) {
    if (shouldRotate(response.status, text)) throw new RotatableProviderError('provider rejected key');
    throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  }
  const value = json?.choices?.[0]?.message?.content;
  if (typeof value !== 'string' || !value.trim()) throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  return value.trim();
}

async function callGemini(key: string, model: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
  const systemText = messages.filter((item) => item.role === 'system').map((item) => textFromContent(item.content)).filter(Boolean).join('\n');
  const contents = messages
    .filter((item) => item.role !== 'system')
    .map((item) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: geminiParts(item.content) }));

  const body: Record<string, unknown> = {
    contents: contents.length ? contents : [{ role: 'user', parts: [{ text: 'ping' }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0 },
  };
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const { response, text, json } = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (shouldRotate(response.status, text)) throw new RotatableProviderError('provider rejected key');
    throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  }
  const parts = json?.candidates?.[0]?.content?.parts;
  const value = Array.isArray(parts) ? parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('') : '';
  if (!value.trim()) throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  return value.trim();
}

async function attemptProvider(provider: Provider, keys: string[], model: string, messages: ChatMessage[], purpose: SalarPurpose, maxTokens: number): Promise<CompletionResult | null> {
  if (!keys.length || !model.trim()) return null;
  for (const index of keyOrder(provider, keys.length)) {
    try {
      const text = provider === 'groq'
        ? await callGroq(keys[index], model, messages, maxTokens)
        : provider === 'gemini'
          ? await callGemini(keys[index], model, messages, maxTokens)
          : await callOpenRouter(keys[index], model, messages, maxTokens);
      remember(provider, index);
      return { text, provider, keyIndex: index };
    } catch (error) {
      if (error instanceof RotatableProviderError) continue;
      if (purpose === 'vision' && error instanceof SalarServiceError) continue;
      throw error;
    }
  }
  return null;
}

async function runCompletion(messages: ChatMessage[], purpose: SalarPurpose, maxTokens: number): Promise<CompletionResult> {
  const providers: Array<{ provider: Provider; keys: string[]; model: string }> = [
    { provider: 'groq', keys: parseKeys(process.env.GROQ_API_KEYS), model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile' },
    { provider: 'gemini', keys: parseKeys(process.env.GEMINI_API_KEYS), model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash' },
    { provider: 'openrouter', keys: parseKeys(process.env.OPENROUTER_API_KEYS), model: process.env.OPENROUTER_MODEL?.trim() || '' },
  ];

  for (const item of providers) {
    const result = await attemptProvider(item.provider, item.keys, item.model, messages, purpose, maxTokens);
    if (result) return result;
  }
  throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
}

export async function chatCompletion({ messages, purpose }: { messages: ChatMessage[]; purpose: SalarPurpose }): Promise<string> {
  try {
    const result = await runCompletion(messages, purpose, 96);
    return result.text;
  } catch {
    throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  }
}

export async function ping(): Promise<{ ok: true; provider: Provider; keyIndex: number }> {
  try {
    const result = await runCompletion([{ role: 'user', content: 'ping' }], 'text', 1);
    return { ok: true, provider: result.provider, keyIndex: result.keyIndex };
  } catch {
    throw new SalarServiceError(SALAR_SAFE_ERROR_MESSAGE);
  }
}
