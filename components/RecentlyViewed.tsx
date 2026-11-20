'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import FastProductLink from '@/components/FastProductLink';
import { useCartStore } from '@/lib/cartStore';
import { getMegaDealAvailableSizes, isExclusiveGlassDealProduct, resolveGlassOfferProducts, type GlassOfferDisplay } from '@/lib/glassOffers';
import GlassOfferCard from '@/components/home/GlassOfferCard';
import { useSettings } from '@/lib/useSettings';
import { selectMegaRecommendations } from '@/lib/megaRecommendations';
import { fetchPublicStorefront } from '@/lib/storefrontClient';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { megaImageNeedsTrim, megaImageTrimStyle } from '@/lib/megaImagePresentation';
import {
  loadProductsForNavigation,
  cacheCatalogForNavigation,
  readCachedCatalog,
  readCachedProduct,
  readCachedProducts,
} from '@/lib/productNavigationCache';

type Product = { id: string; title?: string; name?: string; price?: number; compareAtPrice?: number; originalPrice?: number; imageUrl?: string; image?: string; images?: (string | {url?: string})[]; category?: string; categoryId?: string; isFlashSale?: boolean; [key: string]: any };
export function rememberProduct(id: string) { try { const ids = JSON.parse(localStorage.getItem('phdeals-recent') || '[]').filter((value: string) => value !== id); localStorage.setItem('phdeals-recent', JSON.stringify([id, ...ids].slice(0, 12))); } catch {} }
function titleOf(p: Product) { return p.title || p.name || 'PrimeHub Deal'; }
function imageOf(p: Product) { const first = p.images?.[0]; return typeof first === 'string' ? first : first?.url || p.imageUrl || p.image || ''; }
function priceOf(p: Product) { return Number(p.price || 0); }
function originalOf(p: Product) { return Number(p.compareAtPrice ?? p.originalPrice ?? 0); }
function discountOf(p: Product) { const original = originalOf(p), price = priceOf(p); return original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0; }
function addableItem(product: Product) { const image = imageOf(product); return { id: product.id, name: titleOf(product), price: priceOf(product), originalPrice: originalOf(product) || priceOf(product), image, imageUrl: image }; }

function ProductCard({ product, compact = false, offer }: { product: Product; compact?: boolean; offer?: GlassOfferDisplay }) {
  const addItem = useCartStore((state) => state.addItem);
  if (offer || Number(product.megaDealPrice) > 0 || isExclusiveGlassDealProduct(product)) {
    const price = Number(product.megaDealPrice) || priceOf(product);
    const referencePrice = Math.max(originalOf(product), price);
    const reviewed = offer || { product: { ...product, availableSizes: Array.isArray(product.availableSizes) ? product.availableSizes : getMegaDealAvailableSizes(product) } as unknown as GlassOfferDisplay['product'],
      price, referencePrice, savingPercent: referencePrice > price ? Math.round((1 - price / referencePrice) * 100) : 0 };
    return <GlassOfferCard offer={reviewed} recommendation/>;
  }
  const discount = discountOf(product);
  const showFullImage = Number(product.megaDealPrice || 0) > 0 || isExclusiveGlassDealProduct(product);
  const image = showFullImage ? normalizeImageUrl(imageOf(product)) : imageOf(product);
  const trimImage = megaImageNeedsTrim(product.id, image);
  return (
    <article className={`${compact ? 'w-[154px] shrink-0' : 'w-full'} overflow-hidden rounded-[20px] border border-black/7 bg-white shadow-[0_8px_25px_rgba(20,20,15,0.06)]`}>
      <FastProductLink product={product} className="block">
        <div className={`${trimImage ? 'aspect-square' : showFullImage ? 'p-2' : compact ? 'aspect-square' : 'aspect-[4/3]'} relative overflow-hidden bg-[#F4F4F1]`}>
          {image ? <img src={image} alt={titleOf(product)} loading="lazy" draggable={false} style={trimImage ? megaImageTrimStyle : undefined} data-mega-trim={trimImage || undefined} className={trimImage ? "h-full w-full object-cover" : showFullImage ? "block h-auto w-full object-contain" : "h-full w-full object-cover transition duration-300 hover:scale-[1.02]"} onError={(e) => { e.currentTarget.src = '/placeholder.png'; }} /> : <div className="flex h-full items-center justify-center text-[9px] font-bold text-black/25">No image</div>}
          {discount > 0 && <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">-{discount}%</span>}
        </div>
      </FastProductLink>
      <div className={compact ? 'p-2.5' : 'p-3'}>
        <FastProductLink product={product} className="block">
          <p className="line-clamp-2 min-h-[28px] text-[10px] font-black leading-3.5 text-[#14140F]">{titleOf(product)}</p>
          <p className="mt-1.5 font-[family-name:var(--font-mono)] text-[12px] font-black text-[#E1352B]">Rs. {priceOf(product).toLocaleString()}</p>
        </FastProductLink>
        <button type="button" onClick={() => addItem(addableItem(product))} className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[#14140F] py-2 text-[9px] font-black text-white transition hover:bg-[#E1352B]"><Plus size={11}/> Add to Cart</button>
      </div>
    </article>
  );
}

function SimilarRail({ products, offersById }: { products: Product[]; offersById: Map<string, GlassOfferDisplay> }) { if (!products.length) return null; return <section data-similar-items className="mx-auto mt-8 max-w-6xl px-4"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">More like this</p><h2 className="mt-1 text-lg font-black tracking-tight text-[#14140F]">Similar Items</h2></div><span className="text-[9px] font-bold text-black/35">Swipe to explore</span></div><div className="flex items-stretch gap-3 overflow-x-auto overflow-y-visible touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing snap-x snap-mandatory overscroll-x-contain scroll-smooth pb-3 [scrollbar-width:none]">{products.map((product) => <ProductCard key={product.id} product={product} compact offer={offersById.get(product.id)}/>)}</div></section>; }
function DiscoveryFeed({ products, offersById }: { products: Product[]; offersById: Map<string, GlassOfferDisplay> }) { if (!products.length) return null; return <section className="mx-auto mt-9 max-w-6xl px-4"><div className="mb-4"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Picked for your next find</p><h2 className="mt-1 text-xl font-black tracking-tight text-[#14140F]">Selected Just For You</h2><p className="mt-1 text-[10px] font-medium text-black/35">Keep scrolling — more deals from the catalogue are waiting.</p></div><div className="mega-recommendations-grid grid grid-cols-2 gap-3 md:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} offer={offersById.get(product.id)}/>)}</div></section>; }
function RecentRail({ products, offersById }: { products: Product[]; offersById: Map<string, GlassOfferDisplay> }) { if (!products.length) return null; return <section className="mx-auto mt-9 max-w-6xl px-4"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Keep shopping</p><h2 className="mt-1 text-lg font-black tracking-tight text-[#14140F]">Recently Viewed</h2></div></div><div className="flex items-stretch gap-3 overflow-x-auto overflow-y-visible touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing snap-x snap-mandatory overscroll-x-contain scroll-smooth pb-3 [scrollbar-width:none]">{products.map((product) => <ProductCard key={product.id} product={product} compact offer={offersById.get(product.id)}/>)}</div></section>; }

export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const { settings } = useSettings();
  const [recent, setRecent] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [current, setCurrent] = useState<Product | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const ids: string[] = JSON.parse(localStorage.getItem('phdeals-recent') || '[]').filter((id: string) => id !== excludeId).slice(0, 12);
        const requestedIds = [...(excludeId ? [excludeId] : []), ...ids];
        const loaded = await loadProductsForNavigation<Product>(requestedIds);
        // Direct product links have no Home/Shop navigation catalog yet.
        // Reuse the shared request cache instead of depending on a previous visit.
        if (!readCachedCatalog()) {
          const response = await fetchPublicStorefront('catalog');
          if (response.ok) {
            const catalog = await response.json();
            if (cancelled) return;
            cacheCatalogForNavigation(Array.isArray(catalog.products) ? catalog.products : [], Array.isArray(catalog.categories) ? catalog.categories : []);
          }
        }
        if (cancelled) return;
        setCurrent(excludeId ? loaded[excludeId] || readCachedProduct<Product>(excludeId) : null);
        setAllProducts(readCachedProducts<Product>());
        setRecent(ids.map((id) => loaded[id] || readCachedProduct<Product>(id)).filter(Boolean) as Product[]);
      } catch {
        if (!cancelled) {
          setRecent([]);
          setAllProducts(readCachedProducts<Product>());
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [excludeId]);
  const megaOffers = useMemo(() => resolveGlassOfferProducts(allProducts as GlassOfferDisplay['product'][], settings.glassDealShowcase), [allProducts, settings.glassDealShowcase]);
  const offersById = useMemo(() => new Map(megaOffers.map(offer => [offer.product.id, offer])), [megaOffers]);
  const megaPage = Boolean((excludeId && offersById.has(excludeId)) || (current && (Number(current.megaDealPrice) > 0 || isExclusiveGlassDealProduct(current))));
  const similar = useMemo(() => {
    if (!current) return [];
    if (megaPage) return selectMegaRecommendations(current, megaOffers)
      .sort((a, b) => Math.abs(a.price - priceOf(current)) - Math.abs(b.price - priceOf(current)))
      .map(offer => offer.product as Product);
    const category = String(current.categoryId || current.category || '').toLowerCase();
    const price = priceOf(current);
    return allProducts.filter((p) => {
      if (p.id === current.id) return false;
      const pCategory = String(p.categoryId || p.category || '').toLowerCase();
      return category && pCategory === category;
    }).sort((a, b) => Math.abs(priceOf(a) - price) - Math.abs(priceOf(b) - price));
  }, [allProducts, current, megaPage, megaOffers]);
  const selected = useMemo(() => {
    const used = new Set([current?.id, ...similar.map((p) => p.id)].filter(Boolean));
    const pool = (megaPage ? megaOffers.map(offer => offer.product as Product) : allProducts).filter((p) => !used.has(p.id));
    return [...pool].sort(() => Math.random() - 0.5);
  }, [allProducts, current, similar, megaPage, megaOffers]);
  return <><SimilarRail products={similar} offersById={offersById}/><DiscoveryFeed products={selected} offersById={offersById}/><RecentRail products={recent.filter(product => !megaPage || offersById.has(product.id)).slice(0, 12)} offersById={offersById}/></>;
}
