'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, Tag } from 'lucide-react';
import { isDirectStorefrontImage, normalizeImageUrl } from '@/lib/imageUrl';
import { normalizeProductVariants, useCartStore } from '@/lib/cartStore';
import { getVerifiedDealProduct } from '@/lib/verifiedDealProduct';
import { imageOf, priceOf, originalOf, productHasVariants, titleOf, type Product } from '@/components/shop/ShopTypes';
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
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [measuredImage, setMeasuredImage] = useState<{ src: string; aspect: number } | null>(null);
  const openVariantModal = useCartStore((state) => state.openVariantModal);
  const addItem = useCartStore((state) => state.addItem);
  const title = String(product.title || 'Bangles deal');
  const gallery = Array.isArray(product.images) ? product.images : [];
  const cover = gallery[0];
  const image = normalizeImageUrl(String(product.imageUrl || product.image || (typeof cover === 'string' ? cover : (cover as { url?: string } | undefined)?.url || '') || ''));
  const offersSize = product.hasVariants !== false;
  const imageAspect = measuredImage?.src === image ? measuredImage.aspect : 1;

  const sizes = Array.isArray(product.availableSizes) ? product.availableSizes.filter((size): size is string => typeof size === 'string' && Boolean(size.trim())) : [];
  const sizeLabel = (size: string) => size.match(/^\d+(?:\.\d+)?/)?.[0] || size;

  async function selectSize(preferredSize = selectedSize) {
    if (checking) return;
    setChecking(true);
    setError('');
    try {
      // Catalog cards are deliberately compact and have no variant rows.
      // Never allow a missing/failing fresh read to bypass size selection.
      const fresh = await getVerifiedDealProduct(product.id) as Product;
      const freshImage = imageOf(fresh) || image;
      const currentPrice = priceOf(fresh);
      if (productHasVariants(fresh)) {
        if (preferredSize && !normalizeProductVariants(fresh).rows.some(row => String(row.size || '').trim().toLowerCase() === preferredSize.trim().toLowerCase() && Number(row.stock) > 0)) {
          setSelectedSize('');
          throw new Error('This size is no longer in stock. Please choose another size.');
        }
        setSelectedSize(preferredSize);
        if (!openVariantModal({ ...fresh, price: currentPrice, image: freshImage, imageUrl: freshImage, preferredSize }, 'cart')) {
          throw new Error('Please retry selecting your size.');
        }
        return;
      }
      if (currentPrice <= 0) throw new Error('Product price is unavailable.');
      addItem({
        id: fresh.id,
        productId: fresh.id,
        name: titleOf(fresh),
        category: String(fresh.category || ''),
        price: currentPrice,
        originalPrice: originalOf(fresh) || currentPrice,
        image: freshImage,
        imageUrl: freshImage,
      });
      setAdded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Product options are unavailable. Please retry.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <article data-product-id={product.id} data-price={price} aria-hidden={clone || undefined} className={compact ? 'glass-offer-card glass-offer-card--compact' : 'glass-offer-card'}>
      <Link href={`/product/${encodeURIComponent(product.id)}`} prefetch={false} tabIndex={clone ? -1 : undefined}
        className="glass-offer-card__link" aria-label={`View ${title}, ${money(price)}`}>
        <div className="glass-offer-card__image" style={compact ? undefined : { aspectRatio: imageAspect }}>
          {image ? <Image src={image} alt={title} fill unoptimized={isDirectStorefrontImage(image)} sizes={compact ? '180px' : '(max-width: 640px) 45vw, 260px'} quality={72}
            onLoad={(event) => {
              const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
              if (width > 0 && height > 0) {
                setMeasuredImage({ src: image, aspect: width / height });
              }
            }}
            className="object-contain" />
            : <div className="glass-offer-card__empty">PrimeHubMall</div>}
          {savingPercent > 0 ? <span className="glass-offer-card__discount"><Tag size={11} /> Save {savingPercent}%</span> : null}
        </div>
        <h3 className="glass-offer-card__title">{title}</h3>
        <div className="glass-offer-card__prices">
          <strong>{money(price)}</strong>
          {referencePrice > price ? <s>{money(referencePrice)}</s> : null}
        </div>
      </Link>
      {sizes.length > 0 && <fieldset className="glass-offer-card__sizes" disabled={checking}>
        <legend>Available sizes</legend>
        <div>{sizes.map(size => <button key={size} type="button" title={size}
          aria-label={`Choose size ${size} for ${title}`} aria-pressed={selectedSize === size}
          tabIndex={clone ? -1 : undefined} onClick={() => void selectSize(size)}>{sizeLabel(size)}</button>)}</div>
      </fieldset>}
      <button type="button" className="glass-offer-card__action" onClick={() => void selectSize()}
        disabled={checking} tabIndex={clone ? -1 : undefined}
        aria-label={`Select size for ${title}`}>
        <ShoppingCart size={14} />
        {checking ? 'Checking sizes…' : added ? 'Added ✓' : offersSize ? 'Select Size' : 'Add to Cart'}
      </button>
      {error && !clone ? <p role="alert" className="glass-offer-card__error">{error}</p> : null}
    </article>
  );
}
