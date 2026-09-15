import 'server-only';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type SalarUnderstanding = {
  searchText: string;
  intentSummary: string;
  requirements: Array<{ name: string; value: string }>;
  wantsCatalogue: boolean;
};

function cleanText(value: unknown, max = 2000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function configuredKeys(...values: Array<string | undefined>) {
  const keys = values
    .flatMap((value) => String(value || '').split(/[\n,;]+/))
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(keys)].slice(0, 12);
}

function groqModel() {
  return cleanText(process.env.GROQ_MODEL || process.env.SALAAR_GROQ_MODEL, 300);
}

function safeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: any) => item && (item.role === 'user' || item.role === 'assistant'))
    .slice(-6)
    .map((item: any) => ({ role: item.role, content: cleanText(item.content, 700) }))
    .filter((item) => item.content);
}

function parseUnderstanding(raw: string, originalMessage: string): SalarUnderstanding | null {
  const unfenced = String(raw || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
    const searchText = cleanText(parsed.searchText || originalMessage, 1200);
    const intentSummary = cleanText(parsed.intentSummary || '', 700);
    const requirements = Array.isArray(parsed.requirements)
      ? parsed.requirements
          .slice(0, 12)
          .map((item: any) => ({
            name: cleanText(item?.name, 80),
            value: cleanText(item?.value, 160),
          }))
          .filter((item) => item.name && item.value)
      : [];
    return {
      searchText: searchText || cleanText(originalMessage, 1200),
      intentSummary,
      requirements,
      wantsCatalogue: parsed.wantsCatalogue !== false,
    };
  } catch {
    return null;
  }
}

function looseUnderstanding(raw: string, originalMessage: string): SalarUnderstanding | null {
  const text = cleanText(raw, 1600);
  if (!text) return null;

  const searchMatch = text.match(/search\s*text\s*[:=\-]\s*["']?([^\n,}\"']+)/i)
    || text.match(/searchText\s*[:=\-]\s*["']?([^\n,}\"']+)/i);
  const intentMatch = text.match(/intent(?:Summary)?\s*[:=\-]\s*["']?([^\n,}\"']+)/i);
  const searchText = cleanText(searchMatch?.[1] || text, 900) || cleanText(originalMessage, 1200);
  const intentSummary = cleanText(intentMatch?.[1] || text, 500);
  const explicitlyNoCatalogue = /wantsCatalogue\s*[:=]\s*false/i.test(text);

  return {
    searchText,
    intentSummary,
    requirements: [],
    wantsCatalogue: !explicitlyNoCatalogue,
  };
}

export async function understandCustomerWithGroq(input: {
  message: string;
  history?: unknown;
}): Promise<SalarUnderstanding | null> {
  const message = cleanText(input.message, 4000);
  if (!message) return null;

  const keys = configuredKeys(process.env.GROQ_API_KEY, process.env.GROQ_API_KEYS);
  const model = groqModel();
  if (!keys.length || !model) return null;

  const history = safeHistory(input.history);
  const system = [
    'You are the FIRST understanding layer for Salar, an ecommerce salesman.',
    'Do not answer the customer. Your only job is to understand what the customer really means before any catalogue search happens.',
    'Understand Roman Urdu, Urdu, English and mixed language naturally, including spelling mistakes, phonetic spellings, incomplete words, slang and short follow-ups.',
    'Use recent conversation context to understand short replies such as yes/no/more/okay when the meaning is clear from the previous turn.',
    'Normalize likely spelling mistakes and produce the best catalogue-search meaning. Preserve exact product titles or product ids when the message contains an exact selected-product reference.',
    'Extract requirements generically, such as size, colour, material, design/style, quantity, budget, recipient/adult/kids context, or another concrete constraint. Do not invent a requirement that the customer did not imply.',
    'Do not invent products, prices, stock or website facts.',
    'Return JSON only in this shape: {"searchText":"best normalized catalogue search phrase","intentSummary":"short plain-language meaning","requirements":[{"name":"constraint name","value":"constraint value"}],"wantsCatalogue":true}.',
    'If the message is normal conversation and does not need catalogue lookup, set wantsCatalogue=false but still describe the meaning accurately.',
  ].join(' ');

  const messages = [
    { role: 'system', content: system },
    ...history.map((item) => ({ role: item.role, content: item.content })),
    { role: 'user', content: message },
  ];

  for (let index = 0; index < keys.length; index += 1) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keys[index]}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.05,
          max_tokens: 320,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        console.warn(`Salar model-first Groq key ${index + 1} failed`, response.status);
        if ([400, 404, 413, 422].includes(response.status)) break;
        continue;
      }

      const data = await response.json() as any;
      const raw = cleanText(data?.choices?.[0]?.message?.content, 3000);
      const parsed = parseUnderstanding(raw, message);
      if (parsed) return parsed;

      const loose = looseUnderstanding(raw, message);
      if (loose) {
        console.warn(`Salar model-first Groq key ${index + 1} returned imperfect JSON; using its understood meaning.`);
        return loose;
      }
    } catch (error) {
      console.warn(`Salar model-first Groq key ${index + 1} failed`, error instanceof Error ? error.message : 'unknown');
    }
  }

  return null;
}

export function buildModelFirstSearchMessage(originalMessage: string, understanding: SalarUnderstanding | null) {
  const original = cleanText(originalMessage, 4000);
  if (!understanding) return original;
  const requirements = understanding.requirements.map((item) => `${item.name}=${item.value}`).join(', ');
  return [
    `CATALOGUE SEARCH MEANING: ${understanding.searchText}`,
    understanding.intentSummary ? `CUSTOMER INTENT: ${understanding.intentSummary}` : '',
    requirements ? `CUSTOMER REQUIREMENTS: ${requirements}` : '',
    `CUSTOMER ACTUAL MESSAGE: ${original}`,
    'Use the actual customer message for the natural reply. Use the understood meaning and requirements only to retrieve the right catalogue facts/products. Do not mention this internal understanding block to the customer.',
  ].filter(Boolean).join('\n');
}
