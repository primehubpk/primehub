'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { ArrowRight, BadgePercent } from 'lucide-react';
import type { Product } from '@/lib/types';
import { resolveGlassOfferProducts, resolveGlassOffers, type GlassOfferSettings } from '@/lib/glassOffers';
import GlassOfferCard from './GlassOfferCard';
import { useContinuousHomeRail } from '@/lib/useContinuousHomeRail';
import './glass-offers.css';

export default function HomeGlassOfferRail({
  products,
  settings,
}: {
  products: Product[];
  settings?: Partial<GlassOfferSettings> | null;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const config = resolveGlassOffers(settings);
  const offers = resolveGlassOfferProducts(products, settings);
  useContinuousHomeRail(railRef, { itemCount: offers.length, speed: 24 });
  if (!offers.length) return null;

  return (
    <section className="glass-offers-home mx-2 mt-3 sm:mx-4 sm:mt-5" aria-label="70% OFF and more special deals">
      <div className="glass-offers-home__toolbar">
        <Link href="/deals/glass-bangles" prefetch={false} className="glass-offers-home__more">
          View More <ArrowRight size={15} />
        </Link>
      </div>

      <div className="glass-offers-home__row">
        <Link href="/deals/glass-bangles" prefetch={false} className="glass-offers-home__promo" aria-label={`${config.badge} special offers, view all products`}>
          <span className="glass-offers-home__promo-kicker">DEAL BOX COLLECTION</span>
          <BadgePercent className="glass-offers-home__badge-icon" size={30} aria-hidden="true" />
          <strong>{config.badge}</strong>
        </Link>

        <div ref={railRef} className="glass-offers-home__viewport" role="region" aria-label="Continuously scrolling product offers" tabIndex={0}>
          <div className="glass-offers-home__marquee">
            {[0, 1].map((copy) => (
              <div key={copy} className="glass-offers-home__group" data-loop-original={copy === 0 ? '' : undefined} data-loop-copy={copy === 1 ? '' : undefined}>
                {offers.map((offer) => <GlassOfferCard key={offer.product.id} offer={offer} compact clone={copy === 1} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
