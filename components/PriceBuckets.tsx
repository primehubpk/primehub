'use client';

import { useMemo } from 'react';
import { Crown, Gem, Sparkles, SlidersHorizontal, Zap } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

interface PriceBucketsProps {
  selectedMaxPrice: number | null;
  onSelect: (amount: number | null) => void;
}

function bucketIcon(title: string) {
  const value = title.toLowerCase();
  if (value.includes('999') || value.includes('premium')) return <Crown size={18} />;
  if (value.includes('299')) return <Gem size={18} />;
  if (value.includes('99')) return <Zap size={18} />;
  return <Sparkles size={18} />;
}

export default function PriceBuckets({ selectedMaxPrice, onSelect }: PriceBucketsProps) {
  const { settings, loading } = useSettings();

  const buckets = useMemo(
    () => [...(settings.priceBuckets || [])].filter((bucket) => bucket.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [settings.priceBuckets]
  );

  if (loading || buckets.length === 0) return null;

  return (
    <section className="mt-7 px-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[#E1352B]"><Sparkles size={13} /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Premium price drops</span></div>
          <h2 className="text-xl font-black tracking-tight text-[#14140F]">Shop by budget</h2>
        </div>
        {selectedMaxPrice !== null && <button type="button" onClick={() => onSelect(null)} className="inline-flex items-center gap-1.5 rounded-full bg-[#14140F] px-3 py-1.5 text-[10px] font-black text-white"><SlidersHorizontal size={12} />Clear</button>}
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:none]">
        {buckets.map((bucket) => {
          const selected = selectedMaxPrice === bucket.amount;
          const accent = bucket.accent || '#FFB020';
          return (
            <button key={bucket.id} type="button" onClick={() => onSelect(selected ? null : bucket.amount)} className={[
              'relative min-w-[142px] flex-1 overflow-hidden rounded-[22px] border p-3 text-left transition active:scale-[0.98]',
              selected ? 'border-[#FFB020] bg-[#14140F] text-white shadow-[0_0_28px_rgba(255,176,32,0.22)]' : 'border-black/8 bg-white text-[#14140F] shadow-[0_10px_28px_rgba(20,20,15,0.07)] hover:-translate-y-0.5',
            ].join(' ')}>
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-md" style={{ background: accent }} />
              <div className="relative mb-3 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-[#14140F] shadow-sm" style={{ background: accent }}>{bucket.iconUrl ? <img src={bucket.iconUrl} alt="" className="h-full w-full rounded-2xl object-cover" /> : bucketIcon(bucket.title)}</div>
                <span className="animate-pulse rounded-full border border-[#E1352B]/20 bg-[#E1352B]/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#E1352B]">HOT</span>
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] opacity-50">Best finds</p>
              <p className="mt-0.5 text-sm font-black">{bucket.title}</p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-[9px] opacity-50">Products ≤ Rs. {bucket.amount.toLocaleString()}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
