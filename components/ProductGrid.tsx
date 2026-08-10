'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  Heart,
  Play,
  Plus,
  Search,
  ShoppingBag,
  X,
  Zap,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { ProductUrgencyBadges } from '@/components/ProductCard';

type Product = {
  id: string;
  title?: string;
  name?: string;
  price?: number;
  compareAtPrice?: number;
  originalPrice?: number;
  imageUrl?: string;
  image?: string;
  images?: string[];
  category?: string;
  categoryId?: string;
  stock?: number;
  quantity?: number;
  isFlashSale?: boolean;
  videoUrl?: string;
  reelUrl?: string;
  description?: string;
  [key: string]: any;
};

type SortMode = 'featured' | 'low' | 'high' | 'discount';

interface ProductGridProps {
  selectedMaxPrice?: number | null;
}

function getTitle(product: Product) {
  return product.title || product.name || 'Untitled Product';
}

function getImage(product: Product) {
  return product.imageUrl || product.image || product.images?.[0] || '';
}

function getOriginalPrice(product: Product) {
  return Number(product.compareAtPrice ?? product.originalPrice ?? 0);
}

function getPrice(product: Product) {
  return Number(product.price ?? 0);
}

function getDiscount(product: Product) {
  const original = getOriginalPrice(product);
  const price = getPrice(product);
  if (!original || !price || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

function getVideo(product: Product) {
  return product.videoUrl || product.reelUrl || '';
}

export default function ProductGrid({ selectedMaxPrice = null }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>('featured');
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<Product | null>(null);
  const [videoProduct, setVideoProduct] = useState<Product | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state) => state.openDrawer);
  const cartItems = useCartStore((state) => state.items);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Product[]);
        setLoading(false);
      },
      () => {
        setProducts([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) =>
      selectedMaxPrice == null || getPrice(product) <= selectedMaxPrice
    );

    return filtered.sort((a, b) => {
      if (sort === 'low') return getPrice(a) - getPrice(b);
      if (sort === 'high') return getPrice(b) - getPrice(a);
      if (sort === 'discount') return getDiscount(b) - getDiscount(a);
      return Number(Boolean(b.isFlashSale)) - Number(Boolean(a.isFlashSale));
    });
  }, [products, selectedMaxPrice, sort]);

  const addedProduct = addedProductId ? products.find((product) => product.id === addedProductId) || null : null;

  const toggleWishlist = (id: string) => {
    setWishlist((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleAdd = (product: Product) => {
    const image = getImage(product);
    addItem({
      id: product.id,
      name: getTitle(product),
      price: getPrice(product),
      originalPrice: Number(product.originalPrice ?? product.compareAtPrice ?? getPrice(product)),
      image,
      imageUrl: image,
    });
    setAddedId(product.id);
    setAddedProductId(product.id);
    window.setTimeout(() => setAddedId(null), 1100);
    window.setTimeout(() => setAddedProductId(null), 4500);
  };

  if (loading) {
    return (
      <section className="mt-8 px-4">
        <div className="mb-4 h-7 w-44 animate-pulse rounded-lg bg-black/8" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[22px] bg-white">
              <div className="aspect-square animate-pulse bg-black/8" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-4/5 animate-pulse rounded bg-black/8" />
                <div className="h-5 w-1/2 animate-pulse rounded bg-black/8" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 px-4 pb-40">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[#E1352B]">
            <ShoppingBag size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">PrimeHub picks</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#14140F]">Discover deals</h2>
          <p className="mt-1 text-xs text-black/45">{visibleProducts.length} product{visibleProducts.length === 1 ? '' : 's'} to explore</p>
        </div>

        <label className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-black/8 bg-white px-2.5 py-2.5 shadow-sm">
          <ArrowDownUp size={14} className="text-black/45" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="max-w-[90px] bg-transparent text-[10px] font-black outline-none"
            aria-label="Sort products"
          >
            <option value="featured">Featured</option>
            <option value="discount">Best deal</option>
            <option value="low">Low price</option>
            <option value="high">High price</option>
          </select>
        </label>
      </div>

      {visibleProducts.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-black/12 bg-white p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4F4F1]"><Search size={22} className="text-black/35" /></div>
          <h3 className="mt-4 text-base font-black">No deals found</h3>
          <p className="mt-1 text-xs text-black/45">Try another budget filter.</p>
          {selectedMaxPrice !== null && (
            <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-[#E1352B]">Budget: Rs. {Number(selectedMaxPrice).toLocaleString()} or less</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visibleProducts.map((product) => {
            const title = getTitle(product);
            const image = getImage(product);
            const price = getPrice(product);
            const original = getOriginalPrice(product);
            const discount = getDiscount(product);
            const video = getVideo(product);
            const stock = Number(product.stock ?? product.quantity ?? 0);
            const lowStock = stock > 0 && stock <= 5;
            const wished = wishlist.includes(product.id);

            return (
              <article key={product.id} className="group overflow-hidden rounded-[24px] border border-black/7 bg-white shadow-[0_10px_30px_rgba(20,20,15,0.06)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(20,20,15,0.10)]">
                <div className="relative aspect-square overflow-hidden bg-[#F4F4F1]">
                  {image ? (
                    <img src={image} alt={title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-bold text-black/25">No image</div>
                  )}
                  <div className="absolute left-2.5 top-2.5 flex max-w-[75%] flex-wrap gap-1.5">
                    {discount > 0 && <span className="rounded-full bg-[#E1352B] px-2 py-1 text-[9px] font-black text-white shadow-sm">-{discount}%</span>}
                    {product.isFlashSale && <span className="inline-flex items-center gap-1 rounded-full bg-[#14140F] px-2 py-1 text-[9px] font-black text-white shadow-sm"><Zap size={9} />FLASH</span>}
                  </div>
                  <div className="absolute right-2.5 top-2.5 flex gap-1.5">
                    {video && <button type="button" onClick={() => setVideoProduct(product)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-[#14140F] shadow-md backdrop-blur" aria-label={`Play video for ${title}`}><Play size={13} fill="currentColor" /></button>}
                    <button type="button" onClick={() => toggleWishlist(product.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/92 shadow-md backdrop-blur" aria-label={wished ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`}>
                      <Heart size={14} className={wished ? 'text-[#E1352B]' : 'text-[#14140F]'} fill={wished ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  {lowStock && <span className="absolute bottom-2.5 left-2.5 rounded-full bg-[#FFB020] px-2 py-1 text-[9px] font-black text-[#14140F]">Only {stock} left</span>}
                  <ProductUrgencyBadges stock={stock} productId={product.id} />
                </div>

                <div className="p-3">
                  <Link href={`/product/${product.id}`} className="block w-full text-left">
                    <p className="line-clamp-2 min-h-[32px] text-[12px] font-extrabold leading-4 text-[#14140F]">{title}</p>
                    {product.category && <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-black/35">{product.category}</p>}
                    <div className="mt-2 flex items-end gap-1.5">
                      <span className="font-[family-name:var(--font-mono)] text-[16px] font-black text-[#E1352B]">Rs. {price.toLocaleString()}</span>
                      {original > price && <span className="mb-0.5 text-[9px] text-black/35 line-through">Rs. {original.toLocaleString()}</span>}
                    </div>
                  </Link>
                  <button type="button" onClick={() => handleAdd(product)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#14140F] py-2.5 text-[10px] font-black text-white transition hover:bg-[#E1352B] active:scale-[0.98]">
                    {addedId === product.id ? <><Check size={13} />Added to cart</> : <><Plus size={13} />Add to cart</>}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {addedProduct && (
        <div className="fixed inset-x-0 bottom-16 z-[75] px-3 sm:bottom-4">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-[20px] border border-white/15 bg-[#14140F]/96 p-2.5 text-white shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10">
              {getImage(addedProduct) && <img src={getImage(addedProduct)} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#FFB020]">Added to cart ✓</p>
              <p className="mt-0.5 truncate text-[10px] font-bold text-white/80">{getTitle(addedProduct)}</p>
              <p className="mt-0.5 text-[10px] font-black text-white">Rs. {getPrice(addedProduct).toLocaleString()}</p>
            </div>
            <button type="button" onClick={openDrawer} className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[9px] font-black text-[#14140F]">View cart</button>
            <button type="button" onClick={() => setAddedProductId(null)} className="shrink-0 rounded-full p-1.5 text-white/45 hover:bg-white/10" aria-label="Close notification"><X size={13} /></button>
          </div>
        </div>
      )}

      {quickView && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center" onClick={() => setQuickView(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-square bg-[#F4F4F1]">
              {getImage(quickView) && <img src={getImage(quickView)} alt={getTitle(quickView)} className="h-full w-full object-cover" />}
              <button type="button" onClick={() => setQuickView(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md" aria-label="Close quick view"><X size={16} /></button>
            </div>
            <div className="p-5">
              <p className="text-lg font-black">{getTitle(quickView)}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-[family-name:var(--font-mono)] text-2xl font-black text-[#E1352B]">Rs. {getPrice(quickView).toLocaleString()}</span>
                {getOriginalPrice(quickView) > getPrice(quickView) && <span className="text-xs text-black/35 line-through">Rs. {getOriginalPrice(quickView).toLocaleString()}</span>}
              </div>
              {quickView.description && <p className="mt-3 text-xs leading-5 text-black/55">{quickView.description}</p>}
              <button type="button" onClick={() => { handleAdd(quickView); setQuickView(null); }} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E1352B] py-3.5 text-xs font-black text-white"><ShoppingBag size={15} />Add to cart</button>
            </div>
          </div>
        </div>
      )}

      {videoProduct && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" onClick={() => setVideoProduct(null)}>
          <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setVideoProduct(null)} className="absolute -right-1 -top-12 flex h-9 w-9 items-center justify-center rounded-full bg-white" aria-label="Close video"><X size={16} /></button>
            <video src={getVideo(videoProduct)} controls playsInline autoPlay className="max-h-[78vh] w-full rounded-3xl bg-black" />
          </div>
        </div>
      )}
    </section>
  );
}