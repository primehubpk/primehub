import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Provider = 'groq' | 'openrouter' | 'openai' | 'gemini';

type SearchIntent = {
  query: string;
  maxPrice?: number | null;
  minPrice?: number | null;
  category?: string | null;
  color?: string | null;
  material?: string | null;
};

const SYSTEM_PROMPT = `You convert customer ecommerce searches into compact structured search intent for PrimeHub, a Pakistan shopping site.
Customers may speak/write English, Roman Urdu, Urdu, misspellings, plural/singular variants, or mixed language.
Return JSON only with keys: query, maxPrice, minPrice, category, color, material.
Rules:
- query should contain only useful product search terms, normalized to common English/Roman-Urdu ecommerce words.
- Preserve actual product words such as bangles, kara, karray, jewellery, set, ring, bracelet, necklace, gajra, kashmiri, pearl, gold, silver, maroon.
- Understand phrases like: under 500, 500 se kam, 500 tak => maxPrice 500. above 1000, 1000 se zyada => minPrice 1000.
- Do not invent attributes the customer did not request.
- Use null for unknown filters.
- Never include explanation or markdown.`;

function providerConfig(): { provider: Provider; apiKey: string; model: string; baseUrl?: string } | null {
  const requested = (process.env.SMART_SEARCH_PROVIDER || '').trim().toLowerCase() as Provider;
  const provider: Provider | null = requested ||
    (process.env.GROQ_API_KEY ? 'groq' : process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.OPENAI_API_KEY ? 'openai' : process.env.GEMINI_API_KEY ? 'gemini' : null);
  if (!provider) return null;

  if (provider === 'groq' && process.env.GROQ_API_KEY) return { provider, apiKey: process.env.GROQ_API_KEY, model: process.env.SMART_SEARCH_MODEL || 'openai/gpt-oss-20b', baseUrl: 'https://api.groq.com/openai/v1' };
  if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) return { provider, apiKey: process.env.OPENROUTER_API_KEY, model: process.env.SMART_SEARCH_MODEL || 'openai/gpt-4o-mini', baseUrl: 'https://openrouter.ai/api/v1' };
  if (provider === 'openai' && process.env.OPENAI_API_KEY) return { provider, apiKey: process.env.OPENAI_API_KEY, model: process.env.SMART_SEARCH_MODEL || 'gpt-4.1-mini', baseUrl: 'https://api.openai.com/v1' };
  if (provider === 'gemini' && process.env.GEMINI_API_KEY) return { provider, apiKey: process.env.GEMINI_API_KEY, model: process.env.SMART_SEARCH_MODEL || 'gemini-2.5-flash' };
  return null;
}

function safeIntent(value: unknown, fallback: string): SearchIntent {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const numberOrNull = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const stringOrNull = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
  return {
    query: typeof data.query === 'string' && data.query.trim() ? data.query.trim() : fallback,
    maxPrice: numberOrNull(data.maxPrice),
    minPrice: numberOrNull(data.minPrice),
    category: stringOrNull(data.category),
    color: stringOrNull(data.color),
    material: stringOrNull(data.material),
  };
}

function parseJsonText(text: string, fallback: string): SearchIntent {
  const clean = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try { return safeIntent(JSON.parse(clean), fallback); } catch { return { query: fallback }; }
}

async function callOpenAiCompatible(baseUrl: string, apiKey: string, model: string, query: string): Promise<SearchIntent> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 180,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ],
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
  const data = await response.json();
  return parseJsonText(data?.choices?.[0]?.message?.content || '', query);
}

async function callGemini(apiKey: string, model: string, query: string): Promise<SearchIntent> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: query }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 180 },
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const data = await response.json();
  return parseJsonText(data?.candidates?.[0]?.content?.parts?.[0]?.text || '', query);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 300) : '';
    if (!query) return NextResponse.json({ query: '', aiUsed: false });

    const config = providerConfig();
    if (!config) return NextResponse.json({ query, aiUsed: false, reason: 'AI search provider is not configured.' });

    const intent = config.provider === 'gemini'
      ? await callGemini(config.apiKey, config.model, query)
      : await callOpenAiCompatible(config.baseUrl!, config.apiKey, config.model, query);

    return NextResponse.json({ ...intent, aiUsed: true, provider: config.provider });
  } catch (error) {
    console.error('AI search interpretation failed', error);
    return NextResponse.json({ error: 'AI search is temporarily unavailable.' }, { status: 500 });
  }
}
