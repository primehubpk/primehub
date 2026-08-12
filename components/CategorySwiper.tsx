// components/CategorySwiper.tsx
// Live categories only: reads the same Firestore collection managed by Admin.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { Category } from '@/lib/types';

function categorySlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function CategorySwiper() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[]);
    });
    return () => unsub();
  }, []);

  if (categories.length === 0) return null;

  return (
    <section className="mx-auto mt-7 max-w-md px-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Browse the collection</p>
          <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-base font-black tracking-tight">Shop by Category</h2>
        </div>
        <Link href="/shop" className="flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5">
          View all <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 snap-x snap-mandatory [scrollbar-width:none]">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/category/${encodeURIComponent(categorySlug(cat.title || cat.id))}`}
            className="group flex w-[78px] shrink-0 snap-start flex-col items-center gap-1.5 text-center transition active:scale-95"
          >
            <span className="flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-[22px] border border-black/6 bg-white p-1 shadow-[0_8px_22px_rgba(20,20,15,0.06)] transition group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_26px_rgba(20,20,15,0.1)]">
              {cat.iconUrl ? (
                <img src={cat.iconUrl} alt={cat.title} className="h-full w-full rounded-[18px] object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center rounded-[18px] bg-[#F4F4F1] font-[family-name:var(--font-display)] text-xl font-black text-[#0F6A5F]">
                  {cat.title.charAt(0)}
                </span>
              )}
            </span>
            <span className="line-clamp-2 text-[10px] font-bold leading-3.5 text-black/70">{cat.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
