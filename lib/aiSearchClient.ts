export type AiSearchIntent = {
  query: string;
  maxPrice?: number | null;
  minPrice?: number | null;
  category?: string | null;
  color?: string | null;
  material?: string | null;
  aiUsed?: boolean;
};

export async function interpretSearchQuery(query: string): Promise<AiSearchIntent> {
  const clean = query.trim();
  if (!clean) return { query: '' };

  try {
    const response = await fetch('/api/search/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: clean }),
      cache: 'no-store',
    });
    if (!response.ok) return { query: clean, aiUsed: false };
    const data = await response.json();
    return {
      query: typeof data?.query === 'string' && data.query.trim() ? data.query.trim() : clean,
      maxPrice: Number.isFinite(Number(data?.maxPrice)) && Number(data.maxPrice) > 0 ? Number(data.maxPrice) : null,
      minPrice: Number.isFinite(Number(data?.minPrice)) && Number(data.minPrice) > 0 ? Number(data.minPrice) : null,
      category: typeof data?.category === 'string' ? data.category : null,
      color: typeof data?.color === 'string' ? data.color : null,
      material: typeof data?.material === 'string' ? data.material : null,
      aiUsed: Boolean(data?.aiUsed),
    };
  } catch {
    return { query: clean, aiUsed: false };
  }
}

export function buildSmartSearchHref(intent: AiSearchIntent): string {
  const params = new URLSearchParams();
  if (intent.query.trim()) params.set('q', intent.query.trim());
  if (intent.maxPrice && intent.maxPrice > 0) params.set('max', String(intent.maxPrice));
  if (intent.minPrice && intent.minPrice > 0) params.set('min', String(intent.minPrice));
  if (intent.category?.trim()) params.set('category', intent.category.trim());
  const suffix = params.toString();
  return suffix ? `/shop?${suffix}` : '/shop';
}
