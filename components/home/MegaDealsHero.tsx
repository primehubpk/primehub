'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, Sparkles } from 'lucide-react';
import type { GlassOfferDisplay } from '@/lib/glassOffers';
import { imageOf, titleOf } from '@/components/shop/ShopTypes';

/** Real offer photos and editable text, with lightweight CSS depth. */
export default function MegaDealsHero({ offers, heading = 'Mega Deals', subtitle, landing = false }: {
  offers: GlassOfferDisplay[]; heading?: string; subtitle?: string; landing?: boolean;
}) {
  const photos: GlassOfferDisplay[] = [];
  for (const pattern of [/watch/i, /handbag|\bbag\b/i, /bangle|jewel/i]) {
    const found = offers.find(offer => pattern.test(String(offer.product.category || '') + ' ' + titleOf(offer.product)) && imageOf(offer.product));
    if (found && !photos.some(item => item.product.id === found.product.id)) photos.push(found);
  }
  for (const offer of offers) {
    if (photos.length >= 3) break;
    if (imageOf(offer.product) && !photos.some(item => item.product.id === offer.product.id)) photos.push(offer);
  }
  const discounts = [...new Set(offers.map(offer => offer.savingPercent).filter(value => value > 0))].sort((a, b) => b - a);
  const Heading = landing ? 'h1' : 'h2';
  return <header className={'mega-deals-hero' + (landing ? ' mega-deals-hero--landing' : '')}>
    <div className="mega-deals-hero__copy">
      <span className="mega-deals-hero__eyebrow"><Sparkles size={12} aria-hidden="true" /> ONE PLACE. MORE DEALS.</span>
      <Heading>{heading}</Heading>
      <p>{subtitle || 'More choice. Special prices. Every day.'}</p>
      {!landing ? <Link href="/deals" prefetch={false} className="mega-deals-hero__cta">Shop all deals <ArrowRight size={15} aria-hidden="true" /></Link>
        : <span className="mega-deals-hero__available">{offers.length} offers to explore</span>}
    </div>
    <div className="mega-deals-hero__scene" aria-hidden="true">
      <div className="mega-deals-hero__halo" />
      <div className="mega-deals-hero__bag"><ShoppingBag /><span>MEGA<br />DEALS</span></div>
      {photos.slice(0, 3).map((offer, index) => <div key={offer.product.id} className={'mega-deals-hero__photo mega-deals-hero__photo--' + index}>
        <Image src={imageOf(offer.product)} alt="" fill sizes="(max-width: 640px) 90px, 170px" quality={72} className="object-cover" />
      </div>)}
      <span className="mega-deals-hero__seal"><small>{discounts.length ? 'UP TO' : 'SPECIAL'}</small><strong>{discounts.length ? discounts[0] + '%' : 'DEALS'}</strong><small>{discounts.length ? 'OFF' : 'EVERY DAY'}</small></span>
      {discounts.length > 1 ? <span className="mega-deals-hero__tag">{discounts[1]}%<small>OFF</small></span> : null}
    </div>
  </header>;
}
