'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingCart, Tag } from 'lucide-react';
import { isDirectStorefrontImage, normalizeImageUrl } from '@/lib/imageUrl';
import { normalizeProductVariants, useCartStore } from '@/lib/cartStore';
import { getVerifiedDealProduct } from '@/lib/verifiedDealProduct';
import { imageOf, type Product } from '@/components/shop/ShopTypes';
import { MAX_MEGA_CART_QUANTITY, prepareMegaCartItem } from '@/lib/megaDealCart';
import { megaImageNeedsTrim, megaImageTrimStyle } from '@/lib/megaImagePresentation';
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
  const [selectedColor, setSelectedColor] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [freshSizes, setFreshSizes] = useState<string[] | null>(null);
  const [quantity, setQuantity] = useState(1);
  const adding = useRef(false);
  const addItem = useCartStore((state) => state.addItem);
  const title = String(product.title || 'Bangles deal');
  const gallery = Array.isArray(product.images) ? product.images : [];
  const cover = gallery[0];
  const image = normalizeImageUrl(String(product.imageUrl || product.image || (typeof cover === 'string' ? cover : (cover as { url?: string } | undefined)?.url || '') || ''));
  const trimImage = megaImageNeedsTrim(product.id, image);

  const sizes = freshSizes ?? (Array.isArray(product.availableSizes) ? product.availableSizes.filter((size): size is string => typeof size === 'string' && Boolean(size.trim())) : []);
  const sizeLabel = (size: string) => size.match(/^\d+(?:\.\d+)?/)?.[0] || size;

  function chooseSize(size: string) {
    setSelectedSize(size);
    setSelectedColor('');
    setColors([]);
    setAdded(false);
    setError('');
  }

  async function addSelected() {
    if (adding.current) return;
    if (sizes.length && !selectedSize) {
      setError('Please choose a size.');
      return;
    }
    adding.current = true;
    setChecking(true);
    setAdded(false);
    setError('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const fresh = await Promise.race([
        getVerifiedDealProduct(product.id),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Connection is slow. Please retry adding to cart.')), 12000); }),
      ]) as Product;
      const freshImage = imageOf(fresh) || image;
      const rows = normalizeProductVariants(fresh).rows;
      const available = rows.filter(row => Number(row.stock) > 0);
      setFreshSizes([...new Set(available.map(row => String(row.size || 'Standard')))]);
      const prepared = prepareMegaCartItem({ ...fresh, imageUrl: freshImage }, rows, selectedSize, selectedColor, useCartStore.getState().items, quantity);
      if (!prepared.item) {
        setColors(prepared.colors);
        setError('Please choose a colour below, then add to cart.');
        return;
      }
      for (let count = 0; count < quantity; count += 1) addItem(prepared.item);
      setAdded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Product options are unavailable. Please retry.');
    } finally {
      clearTimeout(timer);
      adding.current = false;
      setChecking(false);
    }
  }

  return (
    <article data-product-id={product.id} data-price={price} aria-hidden={clone || undefined} className={compact ? 'glass-offer-card glass-offer-card--compact' : 'glass-offer-card'}>
      <Link href={`/product/${encodeURIComponent(product.id)}`} prefetch={false} tabIndex={clone ? -1 : undefined}
        className="glass-offer-card__link" aria-label={`View ${title}, ${money(price)}`}>
        <div className="glass-offer-card__image">
          {image ? <Image src={image} alt={title} fill unoptimized={isDirectStorefrontImage(image)} sizes={compact ? '180px' : '(max-width: 640px) 45vw, 260px'} quality={72}
            style={trimImage ? megaImageTrimStyle : undefined}
            data-mega-trim={trimImage || undefined} className="object-contain" />
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
          tabIndex={clone ? -1 : undefined} onClick={() => chooseSize(size)}>{sizeLabel(size)}</button>)}</div>
      </fieldset>}
      {colors.length > 1 && <fieldset className="glass-offer-card__sizes" disabled={checking}>
        <legend>Available colours</legend>
        <div>{colors.map(color => <button key={color} type="button" aria-pressed={selectedColor === color}
          tabIndex={clone ? -1 : undefined} onClick={() => { setSelectedColor(color); setAdded(false); setError(''); }}>{color}</button>)}</div>
      </fieldset>}
      <div className="glass-offer-card__quantity">
        <label htmlFor={`mega-qty-${product.id}-${clone ? 'copy' : compact ? 'home' : 'grid'}`}>Quantity</label>
        <div>
          <button type="button" aria-label={`Decrease ${title} quantity`} disabled={checking || quantity <= 1} tabIndex={clone ? -1 : undefined}
            onClick={() => { setQuantity(Math.max(1, quantity - 1)); setAdded(false); }}><Minus size={12}/></button>
          <input id={`mega-qty-${product.id}-${clone ? 'copy' : compact ? 'home' : 'grid'}`} type="number" inputMode="numeric" min={1} max={MAX_MEGA_CART_QUANTITY} step={1}
            value={quantity} disabled={checking} tabIndex={clone ? -1 : undefined} aria-label={`Quantity for ${title}`}
            onChange={event => { setQuantity(Math.max(1, Math.min(MAX_MEGA_CART_QUANTITY, Math.floor(Number(event.target.value) || 1)))); setAdded(false); setError(''); }}/>
          <button type="button" aria-label={`Increase ${title} quantity`} disabled={checking || quantity >= MAX_MEGA_CART_QUANTITY} tabIndex={clone ? -1 : undefined}
            onClick={() => { setQuantity(Math.min(MAX_MEGA_CART_QUANTITY, quantity + 1)); setAdded(false); }}><Plus size={12}/></button>
        </div>
      </div>
      <button type="button" className="glass-offer-card__action" onClick={() => void addSelected()}
        disabled={checking} tabIndex={clone ? -1 : undefined}
        aria-label={`Add ${title}${selectedSize ? ` size ${selectedSize}` : ''} to cart`}>
        <ShoppingCart size={14} />
        {checking ? 'Adding…' : added ? 'Added ✓' : 'Add to Cart'}
      </button>
      {error && !clone ? <p role="alert" className="glass-offer-card__error">{error}</p> : null}
    </article>
  );
}
