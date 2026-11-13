'use client';
import { useMemo, useRef } from 'react';
import type { Product } from '@/lib/types';
import { resolveGlassOfferProducts, type GlassOfferSettings } from '@/lib/glassOffers';
import { useSettings } from '@/lib/useSettings';
import { useContinuousHomeRail } from '@/lib/useContinuousHomeRail';
import GlassOfferCard from './GlassOfferCard';
import MegaDealsHero from './MegaDealsHero';
import { useVisitProductOrder } from '@/lib/useVisitProductOrder';
import { CollectionBannerActions } from './CollectionBannerContent';
import './glass-offers.css';

export default function HomeGlassOfferRail({ products, settings: supplied }: { products: Product[]; settings?: Partial<GlassOfferSettings> | null }) {
  const { settings } = useSettings();
  const config = supplied || settings.glassDealShowcase;
  const resolvedOffers = useMemo(() => resolveGlassOfferProducts(products, config), [products, config]);
  const railRef = useRef<HTMLDivElement>(null);
  const { items: offers, ready } = useVisitProductOrder(resolvedOffers, 'mega-home', railRef);
  const pauseAutoScroll = useContinuousHomeRail(railRef, { itemCount: offers.length, speed: 14, startDelayMs: 8000 });
  function move(direction: number) {
    pauseAutoScroll.current();
    railRef.current?.scrollBy({ left: direction * (railRef.current.clientWidth + 8), behavior: 'smooth' });
  }
  if (!offers.length) return null;
  return <section id="mega-deals" className="glass-offers-home" aria-label="Mega Deals from every category">
    <MegaDealsHero offers={offers} heading={config?.heading} subtitle={config?.subtitle} controls={<CollectionBannerActions path="/deals" title="Mega Deals" shareClassName="mega-deals-hero__share" onPrevious={() => move(-1)} onNext={() => move(1)}/>} />
    <div ref={railRef} aria-busy={!ready} className="glass-offers-home__viewport" role="region" aria-label="Swipe to explore all deals" tabIndex={0}>
      <div className="glass-offers-home__marquee">
        {[0, 1].map(copy => <div key={copy} className="glass-offers-home__group" data-loop-original={copy === 0 ? '' : undefined} data-loop-copy={copy === 1 ? '' : undefined}>
          {offers.map(offer => <GlassOfferCard key={offer.product.id} offer={offer} compact clone={copy === 1} />)}
        </div>)}
      </div>
    </div>
  </section>;
}
