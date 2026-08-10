'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { Plus, ShoppingBag } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';

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
  isFlashSale?: boolean;
  [key: string]: any;
};

export function rememberProduct(id: string) {
  try {
    const ids = JSON.parse(localStorage.getItem('phdeals-recent') || '[]').filter((value: string) => value !== id);
    localStorage.setItem('phdeals-recent', JSON.stringify([id, ...ids].slice(0, 8)));
  } catch {}
}

function titleOf(p: Product) { return p.title || p.name || 'PrimeHub Deal'; }
function imageOf(p: Product) { return p.imageUrl || p.image || p.images?.[0] || ''; }
function priceOf(p: Product) { return Number(p.price || 0); }
function originalOf(p: Product) { return Number(p.compareAtPrice ?? p.originalPrice ?? 0); }
function discountOf(p: Product) { const original = originalOf(p), price = priceOf(p); return original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0; }

function ProductRail({ title, eyebrow, products }: { title: string; eyebrow?: string; products: Product[] }) {
  const addItem = useCartStore((state) => state.addItem);
  if (!products.length) return null;
  return (
    <section className="mx-auto mt-8 max-w-6xl px-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">{eyebrow}</p>}
          <h2 className="mt-1 text-lg font-black tracking-tight text-[#14140F]">{title}</h2>
        </div>
        <span className="text-[9px] font-bold text-black/35">Swipe to explore</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
        {products.map((product) => {
          const image = imageOf(product);
          const discount = discountOf(product);
          return (
            <article key={product.id} className="w-[154px] shrink-0 overflow-hidden rounded-[20px] border border-black/7 bg-white shadow-[0_8px_25px_rgba(20,20,15,0.06)]">
              <Link href={`/product/${product.id}`} className="block">
                <div className="relative aspect-square overflow-hidden bg-[#F4F4F1]">
                  {image ? <img src={image} alt={titleOf(product)} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[9px] font-bold text-black/25">No image</div>}
                  {discount > 0 && <span className="absolute left-2 top-2 rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">-{discount}%</span>}
                </div>
              </Link>
              <div className="p-2.5">
                <Link href={`/product/${product.id}`} className="block">
                  <p className="line-clamp-2 min-h-[28px] text-[10px] font-black leading-3.5 text-[#14140F]">{titleOf(product)}</p>
                  <p className="mt-1.5 font-[family-name:var(--font-mono)] text-[12px] font-black text-[#E1352B]">Rs. {priceOf(product).toLocaleString()}</p>
                </Link>
                <button type="button" onClick={() => addItem({ id: product.id, name: titleOf(product), price: priceOf(product), originalPrice: originalOf(product) || priceOf(product), image, imageUrl: image })} className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[#14140F] py-2 text-[9px] font-black text-white transition hover:bg-[#E1352B]">
                  <Plus size={11} /> Add to Cart
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [recent, setRecent] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [current, setCurrent] = useState<Product | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [snap, all] = await Promise.all([
          excludeId ? getDoc(doc(db, 'products', excludeId)) : Promise.resolve(null),
          getDocs(collection(db, 'products')),
        ]);
        if (cancelled) return;
        setCurrent(snap?.exists() ? ({ id: snap.id, ...snap.data() } as Product) : null);
        setAllProducts(all.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]);

        const ids: string[] = JSON.parse(localStorage.getItem('phdeals-recent') || '[]').filter((id: string) => id !== excludeId);
        const recentMap = new Map(all.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Product]));
        setRecent(ids.map((id) => recentMap.get(id)).filter(Boolean) as Product[]);
      } catch {
        if (!cancelled) setAllProducts([]);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [excludeId]);

  const similar = useMemo(() => {
    if (!current) return [];
    const category = String(current.categoryId || current.category || '').toLowerCase();
    const price = priceOf(current);
    return allProducts.filter((p) => {
      if (p.id === current.id) return false;
      const pCategory = String(p.categoryId || p.category || '').toLowerCase();
      return category && pCategory === category;
    }).sort((a, b) => Math.abs(priceOf(a) - price) - Math.abs(priceOf(b) - price)).slice(0, 8);
  }, [allProducts, current]);

  const selected = useMemo(() => {
    const used = new Set([current?.id, ...similar.map((p) => p.id), ...recent.map((p) => p.id)].filter(Boolean));
    return allProducts.filter((p) => !used.has(p.id)).sort((a, b) => (Number(b.isFlashSale) - Number(a.isFlashSale)) || (discountOf(b) - discountOf(a))).slice(0, 8);
  }, [allProducts, current, recent, similar]);

  return (
    <>
      <ProductRail title="Similar Products" eyebrow="More like this" products={similar} />
      <ProductRail title="Selected Just For You" eyebrow="Picked for your next find" products={selected} />
      <ProductRail title="Recently Viewed" eyebrow="Keep shopping" products={recent.slice(0, 8)} />
    </>
  );
}
