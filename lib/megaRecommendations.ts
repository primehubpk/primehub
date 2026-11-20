type Offer = { product: { id: string; category?: unknown; categoryId?: unknown; active?: unknown; published?: unknown }; price: number };

/** Start with the configured Mega collection, not ordinary category products. */
export function selectMegaRecommendations<T extends Offer>(current: Offer['product'], offers: T[]): T[] {
  const category = String(current.categoryId || current.category || '').trim().toLowerCase();
  const eligible = offers.filter(offer => offer.product.id !== current.id && offer.product.active !== false && offer.product.published !== false);
  const matching = eligible.filter(offer => category && String(offer.product.categoryId || offer.product.category || '').trim().toLowerCase() === category);
  return matching.length ? matching : eligible;
}
