import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Provider = 'groq' | 'openrouter' | 'gemini';
type Result = {
  provider: Provider;
  configured: boolean;
  keyCount: number;
  workingKey: number | null;
  ok: boolean;
  latencyMs: number | null;
  error: string | null;
};

const TIMEOUT_MS = 8000;

function splitKeys(value?: string): string[] {
  if (!value) return [];
  return value.split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean);
}

function keysFor(provider: Provider): string[] {
  if (provider === 'groq') return [...splitKeys(process.env.GROQ_API_KEYS), ...splitKeys(process.env.GROQ_API_KEY)];
  if (provider === 'openrouter') return [...splitKeys(process.env.OPENROUTER_API_KEYS), ...splitKeys(process.env.OPENROUTER_API_KEY)];
  return [...splitKeys(process.env.GEMINI_API_KEYS), ...splitKeys(process.env.GEMINI_API_KEY)];
}

function shortError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || /timeout/i.test(error.message)) return 'timeout';
    return error.message.slice(0, 120);
  }
  return String(error || 'unknown error').slice(0, 120);
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

async function testGroq(key: string): Promise<void> {
  const response = await timedFetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.SALAAR_GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply only: OK' }],
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function testOpenRouter(key: string): Promise<void> {
  const response = await timedFetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.SALAAR_OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
      temperature: 0,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply only: OK' }],
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function testGemini(key: string): Promise<void> {
  const model = process.env.SALAAR_GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await timedFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Reply only: OK' }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 8 },
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function checkProvider(provider: Provider): Promise<Result> {
  const keys = keysFor(provider);
  if (!keys.length) {
    return { provider, configured: false, keyCount: 0, workingKey: null, ok: false, latencyMs: null, error: 'not configured' };
  }

  let lastError = 'no working key';
  for (let i = 0; i < keys.length; i += 1) {
    const started = Date.now();
    try {
      if (provider === 'groq') await testGroq(keys[i]);
      else if (provider === 'openrouter') await testOpenRouter(keys[i]);
      else await testGemini(keys[i]);
      return {
        provider,
        configured: true,
        keyCount: keys.length,
        workingKey: i + 1,
        ok: true,
        latencyMs: Date.now() - started,
        error: null,
      };
    } catch (error) {
      lastError = `key ${i + 1}: ${shortError(error)}`;
    }
  }

  return {
    provider,
    configured: true,
    keyCount: keys.length,
    workingKey: null,
    ok: false,
    latencyMs: null,
    error: lastError,
  };
}

export async function GET() {
  const providers: Provider[] = ['groq', 'openrouter', 'gemini'];
  const results = await Promise.all(providers.map(checkProvider));
  const working = results.filter((item) => item.ok).map((item) => item.provider);

  return NextResponse.json({
    ok: working.length > 0,
    timeoutMs: TIMEOUT_MS,
    workingProviders: working,
    results,
    checkedAt: new Date().toISOString(),
  });
}
