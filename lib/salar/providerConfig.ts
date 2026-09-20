export type ProviderName = 'cloudflare' | 'groq' | 'gemini' | 'openrouter';
export const PROVIDER_ORDER: ProviderName[] = ['cloudflare', 'groq', 'gemini', 'openrouter'];
export const CLOUDFLARE_DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export type ProviderSelection = { preferredProvider: ProviderName; models: Partial<Record<ProviderName, string>> };

export function normalizeProviderSelection(value: unknown): ProviderSelection {
  const source = value && typeof value === 'object' ? value as Record<string, any> : {};
  const models: ProviderSelection['models'] = {};
  for (const provider of PROVIDER_ORDER) {
    const model = typeof source.models?.[provider] === 'string' ? source.models[provider].trim() : '';
    if (model && model.length <= 200 && /^[a-zA-Z0-9@_./:\-]+$/.test(model)) models[provider] = model;
  }
  return { preferredProvider: PROVIDER_ORDER.includes(source.preferredProvider) ? source.preferredProvider : 'cloudflare', models };
}

export function envValue(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function keys(...bases: string[]) {
  const values: string[] = [];
  for (const base of bases) {
    for (const name of [base, `${base}S`, ...Array.from({ length: 9 }, (_, i) => [`${base}_${i + 1}`, `${base}${i + 1}`]).flat()]) {
      values.push(...String(process.env[name] || '').split(/[\n,;]+/).map(value => value.trim()).filter(Boolean));
    }
  }
  return [...new Set(values)].slice(0, 9);
}

export function cloudflareAccountId() {
  return envValue('CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID');
}

export function providerDefinitions(selection?: unknown) {
  const config = normalizeProviderSelection(selection);
  const definitions = [
    { provider: 'cloudflare' as const, keys: keys('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_WORKERS_AI_API_TOKEN', 'CLOUDFLARE_AUTH_TOKEN', 'CLOUDFLARE_API_KEY', 'CF_API_TOKEN'), model: envValue('CLOUDFLARE_MODEL', 'CLOUDFLARE_AI_MODEL') || CLOUDFLARE_DEFAULT_MODEL, visionModel: envValue('CLOUDFLARE_VISION_MODEL') || CLOUDFLARE_DEFAULT_MODEL, accountReady: /^[a-f0-9]{32}$/i.test(cloudflareAccountId()) },
    { provider: 'groq' as const, keys: keys('GROQ_API_KEY', 'SALAAR_GROQ_API_KEY'), model: envValue('GROQ_MODEL', 'SALAAR_GROQ_MODEL'), visionModel: envValue('GROQ_VISION_MODEL', 'SALAAR_GROQ_VISION_MODEL'), accountReady: true },
    { provider: 'gemini' as const, keys: keys('GEMINI_API_KEY', 'GOOGLE_GEMINI_API_KEY', 'SALAAR_GEMINI_API_KEY'), model: envValue('GEMINI_MODEL', 'SALAAR_GEMINI_MODEL'), visionModel: envValue('GEMINI_VISION_MODEL', 'SALAAR_GEMINI_VISION_MODEL'), accountReady: true },
    { provider: 'openrouter' as const, keys: keys('OPENROUTER_API_KEY', 'OPEN_ROUTER_API_KEY', 'SALAAR_OPENROUTER_API_KEY'), model: envValue('OPENROUTER_MODEL', 'OPEN_ROUTER_MODEL', 'SALAAR_OPENROUTER_MODEL'), visionModel: envValue('OPENROUTER_VISION_MODEL', 'OPEN_ROUTER_VISION_MODEL', 'SALAAR_OPENROUTER_VISION_MODEL'), accountReady: true },
  ];
  return definitions.map(item => ({ ...item, model: config.models[item.provider] || item.model }))
    .sort((a, b) => Number(b.provider === config.preferredProvider) - Number(a.provider === config.preferredProvider));
}

export type ProviderTarget = { provider: ProviderName; apiKey: string; keyIndex: number; model: string; visionModel: string };
export function providerTargets(useVision: boolean, selection?: unknown): ProviderTarget[] {
  return providerDefinitions(selection).filter(item => item.accountReady).flatMap(item => item.keys.map((apiKey, index) => ({ provider: item.provider, apiKey, keyIndex: index + 1, model: item.model, visionModel: item.visionModel })))
    .filter(item => Boolean(useVision ? item.visionModel : item.model));
}
