// components/CategorySwiper.tsx
// Live categories only: reads the same Firestore collection managed by Admin.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { Category } from '@/lib/types';

function categorySlug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
export default function CategorySwiper() {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => { const unsub = onSnapshot(collection(db, 'categories'), (snap) => { setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[]); }); return () => unsub(); }, []);
  if (categories.length === 0) return null;
  return <section className="mx-auto mt-7 max-w-6xl px-4"><div className="mb-3 flex items-end justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Browse the collection</p><h2 className="mt-0.5 font-[family-name:var(--font-display)] text-base font-black tracking-tight">Shop by Category</h2></div><Link href="/shop" className="flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5">View all <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Link></div><div className="flex gap-3 overflow-x-auto overflow-y-visible touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing snap-x snap-mandatory overscroll-x-contain scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{categories.map((category) => <Link key={category.id} href={`/category/${encodeURIComponent(categorySlug(category.title || category.id))}`} className="group w-[92px] shrink-0 snap-start text-center"><span className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#F4F4F1] ring-1 ring-black/5">{category.iconUrl ? <img src={category.iconUrl} alt={category.title} draggable={false} className="h-full w-full object-cover" /> : <span className="font-[family-name:var(--font-display)] text-xl font-black text-[#0F6A5F]">{category.title.charAt(0)}</span>}</span><span className="mt-2 block truncate text-[10px] font-black text-[#14140F]">{category.title}</span></Link>)}</div></section>;
}
