'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import type { Product, Category } from '@/lib/types';
import { resolveGlassOffers, resolveGlassOfferProducts, type GlassOfferSettings } from '@/lib/glassOffers';
import MegaDealsHero from './MegaDealsHero';
import GlassOfferCard from './GlassOfferCard';
import { useVisitShuffled } from '@/lib/useVisitShuffled';
import ProductShareButton from '@/components/ProductShareButton';
import './glass-offers.css';

const categoryKey = (product: Product, categories: Category[]) => {
  const id = String(product.categoryId || '');
  const name = String(product.category || '').trim().toLowerCase();
  const found = categories.find(item => item.id === id || item.id === product.category || item.title.trim().toLowerCase() === name);
  return found?.id || name || id;
};
export default function GlassOffersLanding({ products, config, categories = [] }: {
  products: Product[]; config?: Partial<GlassOfferSettings> | null; categories?: Category[];
}) {
  const settings = resolveGlassOffers(config);
  const resolvedOffers = useMemo(() => resolveGlassOfferProducts(products, config), [products, config]);
  const offers = useVisitShuffled(resolvedOffers, 'mega-page', '/deals');
  const [category, setCategory] = useState('all');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('featured');
  const [search, setSearch] = useState('');
  const availableCategories = useMemo(() => {
    const names = new Map(categories.map(item => [item.id, item.title]));
    const options = new Map<string, string>();
    for (const { product } of offers) {
      const key = categoryKey(product, categories);
      if (key) options.set(key, names.get(key) || String(product.category || key));
    }
    return [...options];
  }, [offers, categories]);
  const filtered = useMemo(() => {
    const visible = offers.filter(offer => (category === 'all' || categoryKey(offer.product, categories) === category)
      && (!maxPrice || offer.price <= Number(maxPrice))
      && (!search.trim() || String(offer.product.title).toLowerCase().includes(search.trim().toLowerCase())));
    if (sort === 'low') visible.sort((a, b) => a.price - b.price);
    if (sort === 'high') visible.sort((a, b) => b.price - a.price);
    if (sort === 'saving') visible.sort((a, b) => b.savingPercent - a.savingPercent);
    return visible;
  }, [offers, category, maxPrice, sort, search, categories]);
  return <>
    <MegaDealsHero offers={offers} heading={settings.heading} subtitle={settings.subtitle} landing />
    <div className="mt-3 flex justify-end"><ProductShareButton path="/deals" title="Mega Deals" showLabel className="inline-flex items-center gap-2 rounded-full border border-[#d7c28e] bg-white px-4 py-2 text-xs font-bold text-[#0f6a5f]"/></div>
    <label className="mega-deals-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search deals</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find your favourite deal…" /></label>
    <div className="mega-deals-categories" aria-label="Filter deals by category">
      <button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>All deals</button>
      {availableCategories.map(([id, title]) => <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)}>{title}</button>)}
    </div>
    <div className="glass-offers-landing__filter">
      <label>Price <select aria-label="Maximum deal price" value={maxPrice} onChange={event => setMaxPrice(event.target.value)}><option value="">Any price</option><option value="99">Up to Rs. 99</option><option value="299">Up to Rs. 299</option><option value="999">Up to Rs. 999</option><option value="2999">Up to Rs. 2,999</option></select></label>
      <label>Sort <select aria-label="Sort deals" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="saving">Biggest saving</option></select></label>
    </div>
    <p className="mega-deals-results" role="status">{filtered.length} {filtered.length === 1 ? 'deal' : 'deals'}{category !== 'all' || maxPrice || search ? ' found' : ' ready to shop'}</p>
    {filtered.length ? <div className="glass-offers-landing__grid">{filtered.map(offer => <GlassOfferCard key={offer.product.id} offer={offer} />)}</div>
      : <div className="mega-deals-empty"><h2>{offers.length ? 'No matching deals' : 'New deals are on the way'}</h2><p>{offers.length ? 'Try another category, price or search.' : 'Explore the rest of the shop in the meantime.'}</p>{offers.length ? <button type="button" onClick={() => { setCategory('all'); setMaxPrice(''); setSearch(''); }}>Clear filters</button> : <Link href="/shop">Browse shop</Link>}</div>}
    <div className="mega-deals-back"><Link href="/"><ArrowLeft size={16} aria-hidden="true" /> Back to home</Link></div>
  </>;
}
