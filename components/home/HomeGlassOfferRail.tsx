'use client';
import { useMemo, useRef } from 'react';
import Link from 'next/link';
import type { Product } from '@/lib/types';
import { resolveGlassOfferProducts, type GlassOfferSettings } from '@/lib/glassOffers';
import { useSettings } from '@/lib/useSettings';
import { useContinuousHomeRail } from '@/lib/useContinuousHomeRail';
import GlassOfferCard from './GlassOfferCard';
import MegaDealsHero from './MegaDealsHero';
import './glass-offers.css';

export default function HomeGlassOfferRail({ products, settings: supplied }: { products: Product[]; settings?: Partial<GlassOfferSettings> | null }) {
  const { settings } = useSettings();
  const config = supplied || settings.glassDealShowcase;
  const offers = useMemo(() => resolveGlassOfferProducts(products, config), [products, config]);
  const railRef = useRef<HTMLDivElement>(null);
  useContinuousHomeRail(railRef, { itemCount: offers.length, speed: 24 });
  if (!offers.length) return null;
  return <section id="mega-deals" className="glass-offers-home" aria-label="Mega Deals from every category">
    <MegaDealsHero offers={offers} heading={config?.heading} subtitle={config?.subtitle} />
    <div className="glass-offers-home__caption"><span>Discover your next favourite</span><Link href="/deals" prefetch={false}>View all deals →</Link></div>
    <div ref={railRef} className="glass-offers-home__viewport" role="region" aria-label="Swipe to explore all deals" tabIndex={0}>
      <div className="glass-offers-home__marquee">
        {[0, 1].map(copy => <div key={copy} className="glass-offers-home__group" data-loop-original={copy === 0 ? '' : undefined} data-loop-copy={copy === 1 ? '' : undefined}>
          {offers.map(offer => <GlassOfferCard key={offer.product.id} offer={offer} compact clone={copy === 1} />)}
        </div>)}
      </div>
    </div>
  </section>;
}
