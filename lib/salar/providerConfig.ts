export type ProviderName = 'cloudflare' | 'groq' | 'gemini' | 'openrouter' | 'custom';
export const PROVIDER_ORDER: ProviderName[] = ['cloudflare', 'groq', 'gemini', 'openrouter', 'custom'];
export const CLOUDFLARE_DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export type ProviderSelection = { preferredProvider: ProviderName; models: Partial<Record<ProviderName, string>> };

export function normalizeProviderSelection(value: unknown): ProviderSelection {
  const source = value && typeof value === 'object' ? value as Record<string, any> : {};
  const models: ProviderSelection['models'] = {};
  for (const provider of PROVIDER_ORDER) {
    const model = typeof source.models?.[provider] === 'string' ? source.models[provider].trim() : '';
    if (model && model.length <= 200 && /^[a-zA-Z0-9@_./:\-]+$/.test(model)) models[provider] = model;
  }
  return {
    preferredProvider: PROVIDER_ORDER.includes(source.preferredProvider) ? source.preferredProvider : 'cloudflare',
    models,
  };
}

export function envValue(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

export function cloudflareAccountId() {
  return '';
}

export type ProviderCredentials = Partial<Record<ProviderName, {
  keys: string[];
  accountId?: string;
  disabled?: boolean;
  baseUrl?: string;
  label?: string;
}>>;

export function providerDefinitions(selection?: unknown, credentials: ProviderCredentials = {}) {
  const config = normalizeProviderSelection(selection);
  const definitions = [
    {
      provider: 'cloudflare' as const,
      keys: [] as string[],
      model: envValue('CLOUDFLARE_MODEL', 'CLOUDFLARE_AI_MODEL') || CLOUDFLARE_DEFAULT_MODEL,
      visionModel: envValue('CLOUDFLARE_VISION_MODEL') || CLOUDFLARE_DEFAULT_MODEL,
      accountReady: false,
      baseUrl: '',
      label: 'Cloudflare',
    },
    {
      provider: 'groq' as const,
      keys: [] as string[],
      model: envValue('GROQ_MODEL', 'SALAAR_GROQ_MODEL'),
      visionModel: envValue('GROQ_VISION_MODEL', 'SALAAR_GROQ_VISION_MODEL'),
      accountReady: true,
      baseUrl: 'https://api.groq.com/openai/v1',
      label: 'Groq',
    },
    {
      provider: 'gemini' as const,
      keys: [] as string[],
      model: envValue('GEMINI_MODEL', 'SALAAR_GEMINI_MODEL'),
      visionModel: envValue('GEMINI_VISION_MODEL', 'SALAAR_GEMINI_VISION_MODEL'),
      accountReady: true,
      baseUrl: '',
      label: 'Gemini',
    },
    {
      provider: 'openrouter' as const,
      keys: [] as string[],
      model: envValue('OPENROUTER_MODEL', 'OPEN_ROUTER_MODEL', 'SALAAR_OPENROUTER_MODEL'),
      visionModel: envValue('OPENROUTER_VISION_MODEL', 'OPEN_ROUTER_VISION_MODEL', 'SALAAR_OPENROUTER_VISION_MODEL'),
      accountReady: true,
      baseUrl: 'https://openrouter.ai/api/v1',
      label: 'OpenRouter',
    },
    {
      provider: 'custom' as const,
      keys: [] as string[],
      model: '',
      visionModel: '',
      accountReady: false,
      baseUrl: '',
      label: 'Manual / Custom',
    },
  ];

  return definitions.map(item => {
    const saved = credentials[item.provider];
    const accountId = item.provider === 'cloudflare' ? saved?.accountId || '' : '';
    const baseUrl = item.provider === 'custom'
      ? String(saved?.baseUrl || '').replace(/\/+$/, '')
      : item.baseUrl;
    const label = item.provider === 'custom' ? String(saved?.label || 'Manual / Custom').trim() : item.label;
    const keys = saved?.disabled ? [] : saved?.keys || [];
    const accountReady = item.provider === 'cloudflare'
      ? /^[a-f0-9]{32}$/i.test(accountId)
      : item.provider === 'custom'
        ? /^https:\/\//i.test(baseUrl)
        : item.accountReady;

    return {
      ...item,
      keys,
      accountId,
      baseUrl,
      label,
      accountReady,
      model: config.models[item.provider] || item.model,
      visionModel: item.provider === 'custom'
        ? (config.models.custom || '')
        : item.visionModel,
    };
  })
    .sort((a, b) => Number(b.provider === config.preferredProvider) - Number(a.provider === config.preferredProvider));
}

export type ProviderTarget = {
  provider: ProviderName;
  apiKey: string;
  keyIndex: number;
  model: string;
  visionModel: string;
  accountId?: string;
  baseUrl?: string;
  label?: string;
};

export function providerTargets(useVision: boolean, selection?: unknown, credentials: ProviderCredentials = {}): ProviderTarget[] {
  return providerDefinitions(selection, credentials)
    .filter(item => item.accountReady)
    .flatMap(item => item.keys.map((apiKey, index) => ({
      provider: item.provider,
      apiKey,
      keyIndex: index + 1,
      model: item.model,
      visionModel: item.visionModel,
      accountId: item.accountId,
      baseUrl: item.baseUrl,
      label: item.label,
    })))
    .filter(item => Boolean(useVision ? item.visionModel : item.model));
}
