'use client';

import { memo, useMemo, type ComponentProps, type ReactNode } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import ProductShareButton from '@/components/ProductShareButton';
import { imageOf, titleOf, type Product } from '@/components/shop/ShopTypes';
import { useVisitBannerImages } from '@/lib/useVisitBannerImages';
import './collection-banner-content.css';

// Decorative previews always come from this collection's real products.
export const CollectionBannerPhotos = memo(function CollectionBannerPhotos({ products, kind = 'new-arrivals' }: {
  products: readonly Product[]; kind?: 'bogo' | 'new-arrivals';
}) {
  const candidates = useMemo(() => products.filter(product => imageOf(product)), [products]);
  const images = useVisitBannerImages(candidates.map(imageOf), `products-${kind}`);
  const photos = images.map(src => candidates.find(product => imageOf(product) === src)!).filter(Boolean);
  if (!photos.length) return null;
  return <div className="collection-banner-photos" aria-hidden="true">
    {photos.map(product => <div className="collection-banner-photo" key={product.id} data-banner-product={product.id} data-banner-title={titleOf(product)}>
      <Image src={imageOf(product)} alt="" fill sizes="48px" quality={72} className="object-cover"/>
    </div>)}
  </div>;
});

/** Reuse for new collection banners: their own share link and manual rail arrows. */
export function CollectionBannerActions({ path, title, onPrevious, onNext, className = '', shareClassName = '', previousLabel, nextLabel, children }: {
  path: NonNullable<ComponentProps<typeof ProductShareButton>['path']>;
  title: string; onPrevious?: () => void; onNext?: () => void;
  className?: string; shareClassName?: string; previousLabel?: string; nextLabel?: string; children?: ReactNode;
}) {
  return <div className={`collection-banner-actions ${className}`}>
    <ProductShareButton path={path} title={title} showLabel className={shareClassName}/>
    {onPrevious ? <button type="button" aria-label={previousLabel || `Previous ${title}`} onClick={onPrevious}><ArrowLeft size={16}/></button> : null}
    {onNext ? <button type="button" aria-label={nextLabel || `Next ${title}`} onClick={onNext}><ArrowRight size={16}/></button> : null}
    {children}
  </div>;
}
