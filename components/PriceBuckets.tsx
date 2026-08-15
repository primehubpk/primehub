'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Crown, Gem, Sparkles, SlidersHorizontal, Zap, Package } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

interface PriceBucketsProps {
  selectedMaxPrice: number | null;
  onSelect: (amount: number | null) => void;
}

function bucketIcon(title: string) {
  const value = title.toLowerCase();
  if (value.includes('wholesale')) return <Package size={18} />;
  if (value.includes('999') || value.includes('premium')) return <Crown size={18} />;
  if (value.includes('299')) return <Gem size={18} />;
  if (value.includes('99')) return <Zap size={18} />;
  return <Sparkles size={18} />;
}

export default function PriceBuckets({ selectedMaxPrice, onSelect }: PriceBucketsProps) {
  const { settings, loading } = useSettings();
  const buckets = useMemo(
    () => [...(settings.priceBuckets || [])].filter((bucket) => bucket.active).sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 4),
    [settings.priceBuckets]
  );

  if (loading || buckets.length === 0) return null;

  return (
    <section className="mt-7 px-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[#E1352B]"><Sparkles size={12} /><span className="text-[9px] font-black uppercase tracking-[0.2em]">Smart savings</span></div>
          <h2 className="text-xl font-black tracking-tight text-[#14140F]">Shop by budget</h2>
        </div>
        {selectedMaxPrice !== null && <button type="button" onClick={() => onSelect(null)} className="inline-flex items-center gap-1.5 rounded-full bg-[#14140F] px-3 py-1.5 text-[10px] font-black text-white"><SlidersHorizontal size={12} />Clear</button>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:flex md:gap-2.5 md:overflow-x-auto md:pb-2 md:[scrollbar-width:none]">
        {buckets.map((bucket) => {
          const wholesale = bucket.title.toLowerCase().includes('wholesale');
          const selected = !wholesale && selectedMaxPrice === bucket.amount;
          const accent = bucket.accent || (wholesale ? '#0F6A5F' : '#FFB020');
          const cardClass = 'relative min-w-0 overflow-hidden rounded-[22px] border p-3.5 text-left transition active:scale-[0.98] md:min-w-[148px] md:flex-1';
          const inner = (
            <>
              <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full opacity-20 blur-md" style={{ background: accent }} />
              <div className="relative flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl text-[#14140F] shadow-sm" style={{ background: accent }}>
                  {bucket.iconUrl ? <img src={bucket.iconUrl} alt="" className="h-full w-full object-cover" /> : bucketIcon(bucket.title)}
                </div>
                <span className="rounded-full border border-[#E1352B]/15 bg-[#E1352B]/8 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#E1352B]">Hot</span>
              </div>
              <p className="relative mt-3 text-[8px] font-black uppercase tracking-[0.16em] opacity-45">{wholesale ? 'Bulk savings' : 'Best finds'}</p>
              <p className="relative mt-0.5 text-base font-black leading-tight">{bucket.title}</p>
              <p className="relative mt-1 font-[family-name:var(--font-mono)] text-[9px] opacity-50">
                {wholesale || !bucket.amount ? 'Special wholesale pricing' : `Products ≤ Rs. ${bucket.amount.toLocaleString()}`}
              </p>
            </>
          );
          return wholesale ? (
            <Link key={bucket.id} href="/shop?wholesale=true" className={`${cardClass} border-black/6 bg-white text-[#14140F] shadow-[0_10px_28px_rgba(20,20,15,0.07)] hover:-translate-y-0.5`}>
              {inner}
            </Link>
          ) : (
            <button key={bucket.id} type="button" onClick={() => onSelect(selected ? null : bucket.amount)} className={`${cardClass} ${selected ? 'border-[#14140F] bg-[#14140F] text-white shadow-[0_14px_32px_rgba(20,20,15,0.16)]' : 'border-black/6 bg-white text-[#14140F] shadow-[0_10px_28px_rgba(20,20,15,0.07)] hover:-translate-y-0.5'}`}>
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}
