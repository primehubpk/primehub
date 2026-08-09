// components/CategorySwiper.tsx
// SECTION 5: Shop by Category — horizontal scroll/swipe container.
//
// UPDATED: categories now load live from Firestore's `categories`
// collection (the same collection the admin Categories tab writes to).

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

  return (
    <section className="max-w-md mx-auto px-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-[family-name:var(--font-display)] font-bold text-base">
          Shop by Category
        </h2>
        <Link href="/shop" className="text-[11px] font-semibold text-[#0F6A5F] flex items-center gap-0.5">
          View all <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      {categories.length === 0 && (
        <p className="text-xs text-black/40">No categories yet — add some from the admin panel.</p>
      )}

      <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/category/${encodeURIComponent(categorySlug(cat.title || cat.id))}`}
            className="flex flex-col items-center gap-1.5 shrink-0 snap-start active:scale-95 transition"
          >
            {cat.iconUrl ? (
              <img
                src={cat.iconUrl}
                alt={cat.title}
                className="w-14 h-14 rounded-full object-cover border border-black/10"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-white border border-black/10 flex items-center justify-center font-[family-name:var(--font-display)] font-bold text-[#0F6A5F]">
                {cat.title.charAt(0)}
              </div>
            )}
            <span className="text-[11px] text-black/70">{cat.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
