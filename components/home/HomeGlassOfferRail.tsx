'use client';

import Link from 'next/link';
import { ArrowRight, BadgePercent, Gift, Sparkles } from 'lucide-react';
import type { Product } from '@/lib/types';
import { resolveGlassOfferProducts, resolveGlassOffers, type GlassOfferSettings } from '@/lib/glassOffers';
import GlassOfferCard from './GlassOfferCard';
import './glass-offers.css';

export default function HomeGlassOfferRail({
  products,
  settings,
}: {
  products: Product[];
  settings?: Partial<GlassOfferSettings> | null;
}) {
  const config = resolveGlassOffers(settings);
  const offers = resolveGlassOfferProducts(products, settings);
  if (!offers.length) return null;

  return (
    <section className="glass-offers-home mx-4 mt-5" aria-labelledby="glass-offers-home-title">
      <div className="glass-offers-home__heading">
        <div className="glass-offers-home__heading-copy">
          <span className="glass-offers-home__eyebrow"><Sparkles size={13} /> SPECIAL COLLECTION</span>
          <h2 id="glass-offers-home-title">{config.heading}</h2>
          <p>{config.subtitle}</p>
        </div>
        <Link href="/deals/glass-bangles" prefetch={false} className="glass-offers-home__more">
          View More <ArrowRight size={17} />
        </Link>
      </div>

      <div className="glass-offers-home__row">
        <Link href="/deals/glass-bangles" prefetch={false} className="glass-offers-home__promo" aria-label={`${config.badge}, open all glass bangles and other deals`}>
          <span className="glass-offers-home__icon"><BadgePercent size={31} strokeWidth={2.4} /></span>
          <span className="glass-offers-home__promo-kicker">DEAL BOX COLLECTION</span>
          <strong>{config.badge}</strong>
          <span className="glass-offers-home__promo-note">Rs. 999 glass bangle boxes and more offers</span>
          <span className="glass-offers-home__promo-link"><Gift size={15} /> Shop all deals <ArrowRight size={14} /></span>
        </Link>

        <div className="glass-offers-home__viewport" role="region" aria-label="Continuously scrolling product offers" tabIndex={0}>
          <div className="glass-offers-home__marquee" style={{ animationDuration: `${Math.max(34, offers.length * 4)}s` }}>
            {[0, 1].map((copy) => (
              <div key={copy} className="glass-offers-home__group" aria-hidden={copy === 1}>
                {offers.map((offer) => <GlassOfferCard key={offer.product.id} offer={offer} compact clone={copy === 1} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="glass-offers-home__hint">Hover, focus or touch to explore offers. Tap a product to choose its size or colour.</p>
    </section>
  );
}
