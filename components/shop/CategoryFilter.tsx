'use client';
import { ChevronRight } from 'lucide-react';
import { categoryHref, productMatchesCategory, slugifyCategory } from '@/lib/categoryUtils';
import { Category } from './ShopTypes';

type Props = { categories: Category[]; category: string; setCategory: (value: string) => void };
export default function CategoryFilter({ categories, category, setCategory }: Props) {
  const visible = categories.filter((cat) => cat.active !== false);
  const choose = (value: string, href: string) => {
    setCategory(value);
    window.history.replaceState(window.history.state, '', href);
  };
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Browse the collection</p>
          <h2 className="mt-0.5 text-base font-black text-[#14140F]">Shop by Category</h2>
        </div>
        <button type="button" onClick={() => choose('all', '/shop')} className="flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5">
          View all <ChevronRight size={14} />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
        {visible.map((cat) => {
          // Names are unique; old Firestore slugs can be only one duplicate letter.
          const value = slugifyCategory(cat.title || cat.name || cat.id || cat.slug);
          const label = cat.name || cat.title || cat.id;
          const icon = cat.iconUrl || cat.imageUrl || cat.image;
          const selected = category !== 'all' && productMatchesCategory(category, { category: cat.title || cat.name, categoryId: cat.id }, [cat]);
          const nextValue = selected ? 'all' : value;
          const href = selected ? '/shop' : categoryHref(cat);
          return (
            <button key={cat.id} type="button" onClick={() => choose(nextValue, href)} className="flex w-[78px] shrink-0 flex-col items-center gap-1.5 text-center">
              <span className={`flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-[22px] border bg-white p-1 shadow-[0_8px_22px_rgba(20,20,15,0.06)] ${selected ? 'border-[#0F6A5F] ring-2 ring-[#0F6A5F]/15' : 'border-black/6'}`}>
                {icon ? <img src={icon} alt={label} className="h-full w-full rounded-[18px] object-cover" /> : <span className="text-xl font-black text-[#0F6A5F]">{label.charAt(0)}</span>}
              </span>
              <span className={`line-clamp-2 text-[10px] font-bold leading-3.5 ${selected ? 'text-[#0F6A5F]' : 'text-black/70'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}