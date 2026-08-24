'use client';

import { useMemo } from 'react';
import { Crown, Gem, Sparkles, SlidersHorizontal, Zap, Package } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';
import { isWholesalePriceBucket, sortPriceBuckets } from '@/lib/priceBucketUtils';
import type { PriceBucket } from '@/lib/types';

interface PriceBucketsProps {
  selectedMaxPrice: number | null;
  wholesaleSelected: boolean;
  onSelect: (amount: number | null) => void;
  onWholesaleSelect: () => void;
}

function bucketIcon(title: string) {
  const value = title.toLowerCase();
  if (value.includes('wholesale')) return <Package size={18} />;
  if (value.includes('999') || value.includes('premium')) return <Crown size={18} />;
  if (value.includes('299')) return <Gem size={18} />;
  if (value.includes('99')) return <Zap size={18} />;
  return <Sparkles size={18} />;
}

export default function PriceBuckets({ selectedMaxPrice, wholesaleSelected, onSelect, onWholesaleSelect }: PriceBucketsProps) {
  const { settings, loading } = useSettings();
  const buckets = useMemo<PriceBucket[]>(
    () => sortPriceBuckets([...(settings.priceBuckets || [])].filter((bucket) => bucket.active)).slice(0, 4),
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
        {(selectedMaxPrice !== null || wholesaleSelected) && <button type="button" onClick={() => { onSelect(null); if (wholesaleSelected) onWholesaleSelect(); }} className="inline-flex items-center gap-1.5 rounded-full bg-[#14140F] px-3 py-1.5 text-[10px] font-black text-white"><SlidersHorizontal size={12} />Clear</button>}
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide sm:grid sm:grid-cols-4 sm:overflow-visible">
        {buckets.map((bucket) => {
          const wholesale = isWholesalePriceBucket(bucket);
          const selected = wholesale ? wholesaleSelected : selectedMaxPrice === bucket.amount && !wholesaleSelected;
          const accent = bucket.accent || (wholesale ? '#0F6A5F' : '#FFB020');
          return (
            <button
              key={bucket.id}
              type="button"
              onClick={() => {
                if (wholesale) {
                  onWholesaleSelect();
                } else {
                  onSelect(selected ? null : (bucket.amount ?? null));
                }
                setTimeout(() => {
                  const element = document.getElementById('discover-deals-section');
                  if (element) {
                    const headerOffset = 90;
                    const elementPosition = element.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                  }
                }, 100);
              }}
              className={`relative min-w-[168px] shrink-0 overflow-hidden rounded-[28px] border px-4 py-3.5 text-left transition active:scale-[0.98] sm:min-w-0 ${
                selected ? 'border-white/20 text-white shadow-[0_14px_34px_rgba(15,106,95,0.22)]' : 'border-white/50 text-[#14140F] shadow-[0_10px_28px_rgba(20,20,15,0.06)]'
              }`}
              style={selected ? { background: `linear-gradient(135deg, ${accent}, #14140F)` } : { background: `linear-gradient(135deg, rgba(255,255,255,0.86), ${accent}22)` }}
            >
              <div className="absolute inset-0 backdrop-blur-md" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full shadow-sm ${selected ? 'bg-white/15 text-white' : 'bg-white/80 text-[#14140F]'}`}>
                    {bucket.iconUrl ? <img src={bucket.iconUrl} alt="" className="h-full w-full object-cover" /> : bucketIcon(bucket.title)}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider ${wholesale ? 'bg-[#FFB020]/20 text-[#8A5A00]' : selected ? 'bg-white/12 text-white' : 'bg-[#E1352B]/10 text-[#E1352B]'}`}>
                    {wholesale ? 'Wholesale' : 'Hot'}
                  </span>
                </div>
                <p className={`mt-3 text-[8px] font-black uppercase tracking-[0.16em] ${selected ? 'text-white/60' : 'text-black/40'}`}>{wholesale ? 'Special Wholesale Pricing' : bucket.title}</p>
                <p className="mt-0.5 text-sm font-black leading-tight">{wholesale ? 'Wholesale Deals' : `Under Rs. ${Number(bucket.amount).toLocaleString()}`}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
