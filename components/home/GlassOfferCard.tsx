import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Tag } from 'lucide-react';
import { normalizeImageUrl } from '@/lib/imageUrl';
import type { GlassOfferDisplay } from '@/lib/glassOffers';

const money = (price: number) => 'Rs. ' + price.toLocaleString('en-PK');

export default function GlassOfferCard({
  offer,
  compact = false,
  clone = false,
}: {
  offer: GlassOfferDisplay;
  compact?: boolean;
  clone?: boolean;
}) {
  const { product, price, referencePrice, savingPercent } = offer;
  const title = String(product.title || product.name || 'Bangles deal');
  const gallery = Array.isArray(product.images) ? product.images : [];
  const cover = gallery[0];
  const image = normalizeImageUrl(String(product.imageUrl || product.image || (typeof cover === 'string' ? cover : cover?.url || '') || ''));
  return (
    <article className={compact ? 'glass-offer-card glass-offer-card--compact' : 'glass-offer-card'}>
      <Link
        href={`/product/${encodeURIComponent(product.id)}`}
        prefetch={false}
        tabIndex={clone ? -1 : undefined}
        className="glass-offer-card__link"
        aria-label={`View ${title}, ${money(price)}`}
      >
        <div className="glass-offer-card__image">
          {image ? (
            <Image src={image} alt={title} fill sizes={compact ? '180px' : '(max-width: 640px) 45vw, 260px'} quality={74} className="object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : <div className="glass-offer-card__empty">PrimeHubMall</div>}
          {savingPercent > 0 ? (
            <span className="glass-offer-card__discount"><Tag size={11} /> Save {savingPercent}%</span>
          ) : null}
        </div>
        <h3 className="glass-offer-card__title">{title}</h3>
        <div className="glass-offer-card__prices">
          <strong>{money(price)}</strong>
          {referencePrice > price ? <s>{money(referencePrice)}</s> : null}
        </div>
        <span className="glass-offer-card__action">Choose options <ArrowUpRight size={14} /></span>
      </Link>
    </article>
  );
}
