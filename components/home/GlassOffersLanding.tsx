'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BadgePercent, Gift, Sparkles } from 'lucide-react';
import type { Product } from '@/lib/types';
import { resolveGlassOffers, resolveGlassOfferProducts, type GlassOfferSettings } from '@/lib/glassOffers';
import GlassOfferCard from './GlassOfferCard';
import './glass-offers.css';

type Filter = 'all' | 'under1000' | 'under3000' | 'premium';

export default function GlassOffersLanding({
  products,
  config,
}: {
  products: Product[];
  config?: Partial<GlassOfferSettings> | null;
}) {
  const settings = resolveGlassOffers(config);
  const offers = useMemo(() => resolveGlassOfferProducts(products, config), [products, config]);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState('featured');
  const filtered = useMemo(() => {
    const visible = offers.filter((offer) => {
      if (filter === 'under1000') return offer.price <= 999;
      if (filter === 'under3000') return offer.price >= 1000 && offer.price <= 2999;
      if (filter === 'premium') return offer.price >= 3000;
      return true;
    });
    if (sort === 'low') return [...visible].sort((a, b) => a.price - b.price);
    if (sort === 'high') return [...visible].sort((a, b) => b.price - a.price);
    return visible;
  }, [offers, filter, sort]);

  const fromPrice = offers.length ? Math.min(...offers.map((offer) => offer.price)) : 0;
  if (!offers.length) {
    return (
      <section className="rounded-3xl border border-orange-100 bg-white p-10 text-center">
        <Gift size={34} className="mx-auto mb-3 text-[#dc351d]" />
        <h1 className="text-2xl font-black">Special offers are being updated</h1>
        <p className="mt-2 text-sm text-black/60">Please explore the available deals in our shop.</p>
        <Link href="/shop" className="mt-5 inline-block rounded-full bg-[#0f6a5f] px-6 py-3 text-sm font-bold text-white">Browse Products</Link>
      </section>
    );
  }

  return (
    <>
      <header className="glass-offers-landing__hero">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-black tracking-wide text-white"><BadgePercent size={16} /> {settings.badge}</span>
          <h1>{settings.heading}</h1>
          <p>{settings.subtitle}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-white/95">
            <span className="inline-flex items-center gap-1.5"><Gift size={16} /> {offers.length} real products</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles size={16} /> Multiple designs and price ranges</span>
          </div>
        </div>
        <div className="glass-offers-landing__price relative z-10">
          <small>Deals starting at</small>
          <strong>Rs. {fromPrice.toLocaleString('en-PK')}</strong>
          <small>Choose size / colour on product page</small>
        </div>
      </header>

      <div className="glass-offers-landing__filter">
        {([
          ['all', `All Deals (${offers.length})`],
          ['under1000', 'Up to Rs. 999'],
          ['under3000', 'Rs. 1,000–2,999'],
          ['premium', 'Rs. 3,000+'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}>{label}</button>
        ))}
        <label className="ml-auto text-xs font-bold text-black/65">
          Sort: <select value={sort} onChange={(event) => setSort(event.target.value)} className="ml-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs">
            <option value="featured">Featured</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </label>
      </div>

      {filtered.length ? (
        <div className="glass-offers-landing__grid">
          {filtered.map((offer) => <GlassOfferCard offer={offer} key={offer.product.id} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-black/60">
          No offers in this price range yet. <button onClick={() => setFilter('all')} className="font-bold text-[#b9231c] underline">View all deals</button>
        </div>
      )}
      <div className="mt-9 text-center">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-bold text-[#0f6a5f]"><ArrowLeft size={16} /> Back to Home</Link>
      </div>
    </>
  );
}
