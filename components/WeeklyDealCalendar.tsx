'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Clock3, LockKeyhole, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { WEEKDAY_LABELS, countdownParts, dealTiming } from '@/lib/weeklyDealUtils';
import type { Product, WeeklyDeal } from '@/lib/types';

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

function discount(dealPrice: number, regularPrice: number) {
  if (regularPrice <= 0 || dealPrice <= 0 || dealPrice >= regularPrice) return 0;
  return Math.round(((regularPrice - dealPrice) / regularPrice) * 100);
}

type Props = {
  weeklyDeals: WeeklyDeal[];
  weeklyProducts: Record<string, Product>;
  nowTick: number | null;
};

export default function WeeklyDealCalendar({ weeklyDeals, weeklyProducts, nowTick }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const [addedId, setAddedId] = useState<string | null>(null);

  const addDeal = (deal: WeeklyDeal) => {
    const item = weeklyProducts[deal.productId];
    const dealPrice = Number(deal.dealPrice || 0);
    const stock = Number(item?.stock ?? item?.quantity ?? item?.inventory ?? 10);
    if (!item || dealPrice <= 0 || stock <= 0) return;
    const image = item.imageUrl || (item as any).image || ((item as any).images?.[0] ?? '');
    addItem({
      id: item.id,
      name: item.title || (item as any).name || deal.title,
      price: dealPrice,
      originalPrice: Number(item.price || deal.originalPrice || dealPrice),
      image,
      imageUrl: image,
      dealDay: deal.day,
    });
    setAddedId(deal.id);
    window.setTimeout(() => setAddedId(null), 1200);
  };

  return (
    <section className="mx-auto mt-8 max-w-6xl px-3 md:px-5">
      <div className="rounded-[30px] border border-black/7 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#E1352B]">Weekly Deal Calendar</p>
            <h2 className="mt-1 text-2xl font-black">🔥 Explore All Weekly Deals</h2>
            <p className="mt-1 text-[10px] font-bold text-black/40">All seven days, one premium deal destination.</p>
          </div>
          <Link href="/weekly-deals" className="shrink-0 text-[9px] font-black uppercase tracking-wider text-[#0F6A5F]">View all</Link>
        </div>
        <div className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {weeklyDeals.map((deal) => {
            const item = weeklyProducts[deal.productId];
            const image = item?.imageUrl || (item as any)?.image || deal.imageUrl || '';
            const normal = Number(item?.price || deal.originalPrice || 0);
            const dealP = Number(deal.dealPrice || 0);
            const itemTiming = nowTick !== null ? dealTiming(deal.day, new Date(nowTick)) : null;
            const itemLive = Boolean(itemTiming?.isLive);
            const itemCountdown = itemTiming && nowTick !== null ? countdownParts(itemTiming.unlockAt.getTime() - nowTick) : null;
            const itemSave = discount(dealP, normal);
            const stock = Number(item?.stock ?? item?.quantity ?? item?.inventory ?? 10);
            const canAdd = Boolean(item && dealP > 0 && stock > 0);
            return (
              <div key={deal.id} className="group w-[210px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-black/8 bg-[#FCFCFA] transition hover:-translate-y-0.5 hover:shadow-md sm:w-[235px]">
                <Link href={`/product/${deal.productId}`} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#F4F4F1]">
                    {image ? <img src={image} alt={deal.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-[9px] font-bold text-black/25">No image</div>}
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[7px] font-black uppercase ${itemLive ? 'bg-[#E1352B] text-white' : 'bg-white/95 text-black'}`}>{itemLive ? '⚡ LIVE TODAY' : `🔒 ${WEEKDAY_LABELS[deal.day]}`}</span>
                  </div>
                </Link>
                <div className="p-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#0F6A5F]">{WEEKDAY_LABELS[deal.day]} Deal</p>
                  <h3 className="mt-1 line-clamp-2 min-h-[36px] text-sm font-black">{item?.title || (item as any)?.name || deal.title}</h3>
                  <div className="mt-2 flex flex-wrap items-baseline gap-2"><span className="font-[family-name:var(--font-mono)] text-base font-black text-[#E1352B]">{money(dealP)}</span>{normal > dealP && <span className="text-[9px] font-bold text-black/35 line-through">{money(normal)}</span>}</div>
                  {itemSave > 0 && <p className="mt-1 text-[8px] font-black text-[#0F6A5F]">SAVE {itemSave}% • {money(normal - dealP)} off</p>}
                  <div className="mt-2 flex items-center gap-1 text-[8px] font-bold text-black/40">{itemLive ? <Clock3 size={10} /> : <LockKeyhole size={10} />}{itemLive ? `Ends in ${itemCountdown ? `${itemCountdown.hours.toString().padStart(2, '0')}:${itemCountdown.minutes.toString().padStart(2, '0')}:${itemCountdown.seconds.toString().padStart(2, '0')}` : '—'}` : `Unlocks ${WEEKDAY_LABELS[deal.day]}`}</div>
                  <button type="button" onClick={() => addDeal(deal)} disabled={!canAdd} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] px-3 py-3 text-[9px] font-black text-white transition hover:bg-[#0F6A5F] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40" aria-label={canAdd ? `Add ${deal.title} to cart` : 'Deal out of stock'}>
                    {addedId === deal.id ? <Check size={13} /> : <ShoppingCart size={13} />}
                    {addedId === deal.id ? 'ADDED' : stock <= 0 ? 'OUT OF STOCK' : '🛒 ADD TO CART'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
