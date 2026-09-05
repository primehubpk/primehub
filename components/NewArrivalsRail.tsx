'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ShoppingCart, Sparkles } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { imageOf, originalOf, priceOf, productHasVariants, titleOf, type Product } from '@/components/shop/ShopTypes';
import { normalizeImageUrl } from '@/lib/imageUrl';

function timeOf(p: Product) {
  const value = p.createdAt || p.updatedAt;
  return typeof value?.toMillis === 'function' ? value.toMillis() : new Date(value || 0).getTime() || 0;
}

export function newestFirst(products: Product[]) {
  return [...products]
    .filter((p) => p.published !== false)
    .sort((a, b) => timeOf(b) - timeOf(a) || b.id.localeCompare(a.id));
}

export default function NewArrivalsRail({ initialProducts = [] }: { initialProducts?: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [addedId, setAddedId] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const openVariantModal = useCartStore((s) => s.openVariantModal);

  useEffect(() => {
    const stop = onSnapshot(
      collection(db, 'products'),
      (snapshot) => setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)),
    );
    return () => stop();
  }, []);

  const newest = useMemo(() => newestFirst(products).slice(0, 10), [products]);

  const addProduct = (product: Product) => {
    const image = imageOf(product);
    if (productHasVariants(product) && openVariantModal({ ...product, image, imageUrl: image }, 'cart')) return;
    addItem({
      id: product.id,
      name: titleOf(product),
      price: priceOf(product),
      originalPrice: originalOf(product) || priceOf(product),
      image,
      imageUrl: image,
    });
    setAddedId(product.id);
    window.setTimeout(() => setAddedId((current) => current === product.id ? null : current), 1400);
  };

  if (!newest.length) return null;

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-end justify-between px-4">
        <div>
          <div className="flex items-center gap-1 text-[#B7791F]"><Sparkles size={12}/><span className="text-[8px] font-black uppercase tracking-[.2em]">Premium Picks</span></div>
          <h2 className="mt-1 text-xl font-black">New Arrivals</h2>
        </div>
        <Link href="/new-arrivals" className="flex items-center gap-1 rounded-full bg-[#14140F] px-3 py-2 text-[9px] font-black text-white">View All <ArrowRight size={12}/></Link>
      </div>

      <div className="flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {newest.map((p, index) => {
          const src = normalizeImageUrl(imageOf(p));
          return (
            <article key={p.id} className="w-[132px] shrink-0 snap-start overflow-hidden rounded-[18px] bg-white shadow-sm ring-1 ring-black/5 sm:w-[160px]">
              <Link href={`/product/${p.id}`} className="block">
                <div className="relative aspect-square overflow-hidden bg-white">
                  {src ? (
                    <Image
                      src={src}
                      alt={titleOf(p)}
                      fill
                      priority={index < 3}
                      loading={index < 3 ? 'eager' : 'lazy'}
                      fetchPriority={index < 3 ? 'high' : 'auto'}
                      sizes="(max-width: 640px) 132px, 160px"
                      quality={72}
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[9px] text-black/30">No image</div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-gradient-to-r from-[#A66A00] to-[#F6C453] px-2 py-1 text-[7px] font-black uppercase tracking-wider text-white shadow">New Arrival</span>
                </div>
              </Link>
              <div className="p-2.5">
                <Link href={`/product/${p.id}`} className="block"><p className="line-clamp-2 min-h-[28px] text-[10px] font-black leading-[14px]">{titleOf(p)}</p></Link>
                <p className="mt-1 text-[11px] font-black text-[#E1352B]">Rs. {priceOf(p).toLocaleString()}</p>
                <button type="button" onClick={() => addProduct(p)} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-[#14140F] px-2 py-2 text-[9px] font-black text-white">{addedId === p.id ? 'Added ✓' : <><ShoppingCart size={12}/>Add to cart</>}</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
