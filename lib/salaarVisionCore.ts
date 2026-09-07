export type SalaarVisionAnalysis = {
  reply: string;
  searchQuery: string;
  category?: string;
  color?: string;
  material?: string;
  styleTerms: string[];
};

export const SALAAR_VISION_ANALYSIS_SYSTEM = `You are Salaar's visual sales assistant for PrimeHubMall Pakistan.
Inspect only the customer image and their question. Return ONE JSON object only, with no markdown and no extra text:
{"reply":"short natural Roman Urdu/English reply","searchQuery":"short catalog search phrase","category":"optional likely product category","color":"optional dominant/relevant color","material":"optional likely material","styleTerms":["up to 6 visible style/design terms"]}
Rules:
- Describe only what can actually be seen. Do not invent brand, price, stock, exact material or exact product identity.
- searchQuery should contain useful visible shopping descriptors that can be searched against PrimeHub's real catalog.
- If category/material is uncertain, omit it rather than guessing.
- reply should say what you can see and that matching PrimeHub options will be shown if available.
- Never claim an exact match from the image alone.`;

function clean(value: unknown, max = 220) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function cleanTerms(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const term = clean(item, 60);
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    result.push(term);
    if (result.length >= 6) break;
  }
  return result;
}

function jsonCandidate(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : '';
}

export function parseSalaarVisionAnalysis(raw: unknown): SalaarVisionAnalysis {
  const text = clean(raw, 1800);
  let parsed: any = null;
  const candidate = jsonCandidate(text);
  if (candidate) {
    try { parsed = JSON.parse(candidate); } catch { parsed = null; }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      reply: text || 'Ji, image dekh li hai. Main visible design ke mutabiq matching PrimeHub options check karta hoon.',
      searchQuery: '',
      styleTerms: [],
    };
  }

  const category = clean(parsed.category, 100) || undefined;
  const color = clean(parsed.color, 80) || undefined;
  const material = clean(parsed.material, 100) || undefined;
  const styleTerms = cleanTerms(parsed.styleTerms);
  const explicitSearch = clean(parsed.searchQuery, 260);
  const searchQuery = explicitSearch || [color, material, category, ...styleTerms].filter(Boolean).join(' ').slice(0, 260);

  return {
    reply: clean(parsed.reply, 700) || 'Ji, image dekh li hai. Main visible design ke mutabiq matching PrimeHub options check karta hoon.',
    searchQuery,
    category,
    color,
    material,
    styleTerms,
  };
}

export function visionCatalogQuery(customerMessage: string, analysis: SalaarVisionAnalysis) {
  const parts = [
    analysis.searchQuery,
    analysis.category,
    analysis.color,
    analysis.material,
    ...analysis.styleTerms,
  ].filter(Boolean).map((item) => clean(item, 120));
  const unique = Array.from(new Set(parts.map((item) => item.toLowerCase())));
  if (unique.length) return unique.join(' ').slice(0, 500);
  return clean(customerMessage, 500);
}
