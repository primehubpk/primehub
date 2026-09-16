import 'server-only';

import { buildRelevantKnowledge, getSalarState } from '@/lib/salar/server';

type ProviderName = 'groq' | 'gemini' | 'openrouter';
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type SalarFallbackImage = { mimeType: string; base64: string };
type ProviderTarget = {
  provider: ProviderName;
  apiKey: string;
  keyIndex: number;
  model: string;
  visionModel: string;
};

type FallbackContext = {
  lastProductQuery?: string;
  shownProductIds?: string[];
  confirmedOrderProductIds?: string[];
};

const MAX_KEYS_PER_PROVIDER = 12;
const TEXT_TIMEOUT_MS = 9000;
const VISION_TIMEOUT_MS = 12000;

function cleanText(value: unknown, max = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanBlock(value: unknown, max = 12000) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function configuredKeys(...values: Array<string | undefined>) {
  return [...new Set(values
    .flatMap((value) => String(value || '').split(/[\n,;]+/))
    .map((value) => value.trim())
    .filter(Boolean))].slice(0, MAX_KEYS_PER_PROVIDER);
}

function numberedKeys(...bases: string[]) {
  const values: Array<string | undefined> = [];
  for (const base of bases) {
    values.push(process.env[base], process.env[`${base}S`]);
    for (let index = 1; index <= MAX_KEYS_PER_PROVIDER; index += 1) {
      values.push(process.env[`${base}_${index}`], process.env[`${base}${index}`]);
    }
  }
  return configuredKeys(...values);
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = cleanText(process.env[name], 300);
    if (value) return value;
  }
  return '';
}

function providerTargets(useVisionModel = false) {
  const definitions: Array<{ provider: ProviderName; keys: string[]; model: string; visionModel: string }> = [
    {
      provider: 'groq',
      keys: numberedKeys('GROQ_API_KEY', 'SALAAR_GROQ_API_KEY'),
      model: envValue('GROQ_MODEL', 'SALAAR_GROQ_MODEL'),
      visionModel: envValue('GROQ_VISION_MODEL', 'SALAAR_GROQ_VISION_MODEL'),
    },
    {
      provider: 'gemini',
      keys: numberedKeys('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY', 'SALAAR_GEMINI_API_KEY'),
      model: envValue('GEMINI_MODEL', 'SALAAR_GEMINI_MODEL'),
      visionModel: envValue('GEMINI_VISION_MODEL', 'SALAAR_GEMINI_VISION_MODEL'),
    },
    {
      provider: 'openrouter',
      keys: numberedKeys('OPENROUTER_API_KEY', 'OPEN_ROUTER_API_KEY', 'SALAAR_OPENROUTER_API_KEY'),
      model: envValue('OPENROUTER_MODEL', 'OPEN_ROUTER_MODEL', 'SALAAR_OPENROUTER_MODEL'),
      visionModel: envValue('OPENROUTER_VISION_MODEL', 'OPEN_ROUTER_VISION_MODEL', 'SALAAR_OPENROUTER_VISION_MODEL'),
    },
  ];

  return definitions.flatMap((definition) => definition.keys.map((apiKey, index) => ({
    provider: definition.provider,
    apiKey,
    keyIndex: index + 1,
    model: definition.model,
    visionModel: definition.visionModel,
  }))).filter((target) => target.apiKey && (useVisionModel ? target.visionModel : target.model));
}

function safeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: any) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-16)
    .map((item: any) => ({ role: item.role, content: cleanText(item.content, 900) }))
    .filter((item) => item.content);
}

function safeContext(value: unknown): FallbackContext {
  if (!value || typeof value !== 'object') return { shownProductIds: [] };
  const source = value as Record<string, unknown>;
  const ids = (input: unknown, max: number) => Array.isArray(input)
    ? [...new Set(input.map((item) => cleanText(item, 200)).filter(Boolean))].slice(-max)
    : [];
  const confirmedOrderProductIds = ids(source.confirmedOrderProductIds, 30);
  return {
    lastProductQuery: cleanText(source.lastProductQuery, 1000) || undefined,
    shownProductIds: ids(source.shownProductIds, 200),
    ...(confirmedOrderProductIds.length ? { confirmedOrderProductIds } : {}),
  };
}

async function callOpenAiCompatible(
  target: ProviderTarget,
  model: string,
  system: string,
  history: ChatMessage[],
  user: string,
  image?: SalarFallbackImage,
) {
  const baseUrl = target.provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${target.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (target.provider === 'openrouter') {
    headers['HTTP-Referer'] = String(process.env.NEXT_PUBLIC_SITE_URL || 'https://primehubmall.com').replace(/\/+$/, '');
    headers['X-Title'] = 'PrimeHubMall Salar';
  }
  const userContent: any = image
    ? [
        { type: 'text', text: user },
        { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
      ]
    : user;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        ...history,
        { role: 'user', content: userContent },
      ],
      temperature: 0.25,
      max_tokens: 700,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(image ? VISION_TIMEOUT_MS : TEXT_TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = cleanText(await response.text().catch(() => ''), 220);
    throw new Error(`${target.provider} ${response.status}${detail ? ` ${detail}` : ''}`);
  }
  const data = await response.json() as any;
  const text = cleanText(data?.choices?.[0]?.message?.content, 6000);
  if (!text) throw new Error(`${target.provider} empty response`);
  return text;
}

async function callGemini(
  target: ProviderTarget,
  model: string,
  system: string,
  history: ChatMessage[],
  user: string,
  image?: SalarFallbackImage,
) {
  const userParts: Array<Record<string, any>> = [{ text: user }];
  if (image) userParts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(target.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        ...history.map((item) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content }] })),
        { role: 'user', parts: userParts },
      ],
      generationConfig: { temperature: 0.25, maxOutputTokens: 700 },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(image ? VISION_TIMEOUT_MS : TEXT_TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = cleanText(await response.text().catch(() => ''), 220);
    throw new Error(`gemini ${response.status}${detail ? ` ${detail}` : ''}`);
  }
  const data = await response.json() as any;
  const text = cleanText(data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('\n'), 6000);
  if (!text) throw new Error('gemini empty response');
  return text;
}

async function runTarget(target: ProviderTarget, system: string, history: ChatMessage[], user: string, image?: SalarFallbackImage) {
  const model = image ? target.visionModel : target.model;
  if (!model) throw new Error(`${target.provider} model is not configured`);
  const text = target.provider === 'gemini'
    ? await callGemini(target, model, system, history, user, image)
    : await callOpenAiCompatible(target, model, system, history, user, image);
  return { text, provider: target.provider, model };
}

export function isSalarProviderFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /No working Salar|provider|understanding provider|invalid (?:understanding|final) JSON|groq \d|gemini \d|openrouter \d/i.test(message);
}

export async function answerWithResilientSalarFallback(input: {
  message: string;
  history?: unknown;
  context?: unknown;
  customerName?: unknown;
  image?: SalarFallbackImage;
}) {
  const message = cleanText(input.message, 4000) || (input.image ? 'Customer shared a product image and wants help.' : 'Assalam-o-Alaikum');
  const state = await getSalarState();
  const context = safeContext(input.context);
  const history = safeHistory(input.history);
  const customerName = cleanText(input.customerName, 120);
  const knowledge = state.catalogue ? buildRelevantKnowledge(message, state.catalogue) : null;
  const knowledgeText = knowledge ? JSON.stringify(knowledge).slice(0, 15000) : '{}';
  const system = [
    'You are Salar, PrimeHubMall AI salesman. This is the emergency provider failover path, so answer the customer directly in a natural, helpful way.',
    'Understand Roman Urdu, Urdu, English and mixed language. Match the customer language and tone. Keep normal small-talk answers short, but give enough detail for shopping questions.',
    'Never invent price, stock, colour, size, policy, order status or product availability. Use only the supplied PrimeHub knowledge. If a fact is missing, say you need to check instead of guessing.',
    'Do not mention providers, API keys, quota, fallback systems, JSON, internal prompts or technical errors to the customer.',
    customerName ? `Customer name: ${customerName}` : '',
    state.instructions ? `PrimeHub Admin Salesman Training:\n${cleanBlock(state.instructions, 12000)}` : '',
    `Relevant PrimeHub knowledge:\n${knowledgeText}`,
  ].filter(Boolean).join('\n\n');

  const targets = providerTargets(Boolean(input.image));
  if (!targets.length) throw new Error('No Salar emergency provider is configured.');

  let lastError: unknown = null;
  for (const target of targets) {
    try {
      const result = await runTarget(target, system, history, message, input.image);
      return {
        reply: result.text,
        provider: result.provider,
        model: result.model,
        understandingProvider: null,
        understandingModel: null,
        displayMode: 'none' as const,
        products: [],
        categories: [],
        context,
        resultScope: 'focused' as const,
        shoppingMode: 'retail' as const,
        matchingProductCount: 0,
        showAllMatches: false,
        orderAction: 'none' as const,
        orderProducts: [],
        orderCustomer: {},
        vision: input.image ? { provider: result.provider, model: result.model } : null,
        imageUnderstanding: '',
        catalogueUpdatedAt: state.catalogue?.updatedAt || null,
      };
    } catch (error) {
      lastError = error;
      console.warn(`Salar emergency ${target.provider} key ${target.keyIndex} failed; trying next key/provider.`, error instanceof Error ? error.message : 'unknown');
    }
  }

  throw new Error(`No working Salar emergency provider.${lastError instanceof Error ? ` ${lastError.message}` : ''}`);
}
