// components/CategorySwiper.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { categoryHref, productMatchesCategory, slugifyCategory } from '@/lib/categoryUtils';
import { Category } from '@/lib/types';
import { Product } from '@/components/shop/ShopTypes';

export default function CategorySwiper() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const stopCategories = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[]);
    });
    const stopProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]);
    });
    return () => { stopCategories(); stopProducts(); };
  }, []);

  const visible = useMemo(
    () => categories
      .filter((category) => category.active !== false && String(category.title || '').trim())
      .filter((category) => products.some((product) =>
        product.published !== false &&
        productMatchesCategory(slugifyCategory(category.slug || category.title), product, [category]),
      ))
      .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || a.title.localeCompare(b.title)),
    [categories, products],
  );

  if (visible.length === 0) return null;

  return (
    <section className="mx-auto mt-7 max-w-6xl px-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Browse the collection</p>
          <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-base font-black tracking-tight">Shop by Category</h2>
        </div>
        <Link href="/shop" className="flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5">View all <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
      </div>
      <div className="flex gap-3 overflow-x-auto overflow-y-visible touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing snap-x snap-mandatory overscroll-x-contain scroll-smooth pb-3 [scrollbar-width:none] lg:[scrollbar-width:thin] lg:[scrollbar-color:#9ca3af_transparent] [&::-webkit-scrollbar]:hidden lg:[&::-webkit-scrollbar]:block lg:[&::-webkit-scrollbar]:h-1.5 lg:[&::-webkit-scrollbar-thumb]:rounded-full lg:[&::-webkit-scrollbar-thumb]:bg-black/25">
        {visible.map((category) => <Link key={category.id} href={categoryHref(category)} className="group w-[92px] shrink-0 snap-start text-center lg:w-[78px]"><span className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F1] ring-1 ring-black/5 lg:h-[68px] lg:w-[68px]">{category.iconUrl ? <img src={category.iconUrl} alt={category.title} draggable={false} className="h-full w-full object-cover" /> : <span className="font-[family-name:var(--font-display)] text-xl font-black text-[#0F6A5F]">{category.title.charAt(0)}</span>}</span><span className="mt-2 block truncate text-[10px] font-black text-[#14140F]">{category.title}</span></Link>)}
      </div>
    </section>
  );
}