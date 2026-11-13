'use client';
import Image from 'next/image';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, Sparkles } from 'lucide-react';
import type { GlassOfferDisplay } from '@/lib/glassOffers';
import { imageOf } from '@/components/shop/ShopTypes';
import { useVisitBannerImages } from '@/lib/useVisitBannerImages';

/** Real offer photos and editable text, with lightweight CSS depth. */
export default function MegaDealsHero({ offers, heading = 'Mega Deals', subtitle, landing = false, controls }: {
  offers: GlassOfferDisplay[]; heading?: string; subtitle?: string; landing?: boolean; controls?: ReactNode;
}) {
  const photos = useVisitBannerImages(offers.map(offer => imageOf(offer.product)), 'mega-deals', 3);
  const discounts = [...new Set(offers.map(offer => offer.savingPercent).filter(value => value > 0))].sort((a, b) => b - a);
  const Heading = landing ? 'h1' : 'h2';
  return <header className={'mega-deals-hero' + (landing ? ' mega-deals-hero--landing' : '') + (controls ? ' mega-deals-hero--controls' : '')}>
    <div className="mega-deals-hero__copy">
      <span className="mega-deals-hero__eyebrow"><Sparkles size={12} aria-hidden="true" /> ONE PLACE. MORE DEALS.</span>
      <Heading>{heading}</Heading>
      <p>{subtitle || 'More choice. Special prices. Every day.'}</p>
      {!landing ? <span className="mega-deals-hero__cta">Shop all deals <ArrowRight size={15} aria-hidden="true" /></span>
        : <span className="mega-deals-hero__available">{offers.length} offers to explore</span>}
    </div>
    <div className="mega-deals-hero__scene" aria-hidden="true">
      <div className="mega-deals-hero__halo" />
      <div className="mega-deals-hero__bag"><ShoppingBag /><span>MEGA<br />DEALS</span></div>
      {photos.map((src, index) => <div key={src} className={'mega-deals-hero__photo mega-deals-hero__photo--' + index}>
        <Image src={src} alt="" fill sizes="(max-width: 640px) 90px, 170px" quality={72} className="object-cover" />
      </div>)}
      <span className="mega-deals-hero__seal"><small>{discounts.length ? 'UP TO' : 'SPECIAL'}</small><strong>{discounts.length ? discounts[0] + '%' : 'DEALS'}</strong><small>{discounts.length ? 'OFF' : 'EVERY DAY'}</small></span>
      {discounts.length > 1 ? <span className="mega-deals-hero__tag">{discounts[1]}%<small>OFF</small></span> : null}
    </div>
    {!landing ? <Link href="/deals" prefetch={false} className="mega-deals-hero__link" aria-label="Shop all Mega Deals"><span className="sr-only">Shop all deals</span></Link> : null}
    {controls ? <div className="mega-deals-hero__controls">{controls}</div> : null}
  </header>;
}
