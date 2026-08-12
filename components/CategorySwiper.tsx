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

  // Homepage should show a single category row, using the first/admin-top category only.
  const primaryCategory = categories[0];

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

      <Link
        href={`/category/${encodeURIComponent(categorySlug(primaryCategory.title || primaryCategory.id))}`}
        className="group flex items-center gap-3 rounded-[22px] border border-black/6 bg-white p-2.5 shadow-[0_8px_22px_rgba(20,20,15,0.06)] transition active:scale-[0.99]"
      >
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[#F4F4F1] ring-1 ring-black/5">
          {primaryCategory.iconUrl ? (
            <img src={primaryCategory.iconUrl} alt={primaryCategory.title} className="h-full w-full object-cover" />
          ) : (
            <span className="font-[family-name:var(--font-display)] text-xl font-black text-[#0F6A5F]">
              {primaryCategory.title.charAt(0)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-[#0F6A5F]">Featured category</span>
          <span className="mt-0.5 block truncate text-sm font-black text-[#14140F]">{primaryCategory.title}</span>
          <span className="mt-0.5 block text-[10px] text-black/40">Explore products in this category</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-black/30 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
