'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock3, ShoppingBag, Tag } from 'lucide-react';
import { useMemo } from 'react';
import { useSettings } from '@/lib/useSettings';
import type { Weekday } from '@/lib/types';

const DAYS: Record<Weekday, string> = { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };

function nextMidnight() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value); const m = Number(parts.find((p) => p.type === 'month')?.value); const d = Number(parts.find((p) => p.type === 'day')?.value);
  return new Date(Date.UTC(y, m - 1, d + 1) - 5 * 60 * 60 * 1000).toISOString();
}

export default function DayDealPage() {
  const params = useParams<{ day: string }>();
  const { settings, loading } = useSettings();
  const day = String(params?.day || '').toLowerCase() as Weekday;
  const valid = Boolean(DAYS[day]);
  const deal = useMemo(() => (settings.weeklyDeals || []).find((item) => item.day === day && item.active !== false && Number(item.dealPrice) > 0), [settings.weeklyDeals, day]);
  const endAt = deal?.endAt || nextMidnight();
  const discount = deal && deal.originalPrice > deal.dealPrice ? Math.round(((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100) : 0;

  if (!valid) return <main className="min-h-screen bg-[#F4F4F1] p-6"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-10 text-center"><h1 className="text-2xl font-black">Deal day not found</h1><Link href="/" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white">Back Home</Link></div></main>;
  if (loading) return <main className="min-h-screen bg-[#F4F4F1] p-6"><div className="mx-auto max-w-5xl animate-pulse rounded-3xl bg-white p-8"><div className="h-7 w-48 rounded bg-black/10" /><div className="mt-6 aspect-[16/7] rounded-3xl bg-black/10" /></div></main>;

  return <main className="min-h-screen bg-[#F4F4F1] pb-28">
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-6">
      <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black shadow-sm"><ArrowLeft size={14}/> Back to Home</Link>
      <header className="mt-5 rounded-[30px] bg-[#14140F] p-6 text-white md:p-8">
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#FFB020]">PrimeHub Daily Deals</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">{DAYS[day]} Deal</h1>
        <p className="mt-2 text-sm text-white/55">Only products assigned to the {DAYS[day]} deal are shown on this page.</p>
      </header>

      {!deal ? <section className="mt-5 rounded-[30px] bg-white p-10 text-center shadow-sm"><Tag className="mx-auto h-10 w-10 text-black/20"/><h2 className="mt-4 text-lg font-black">No {DAYS[day]} deal is active</h2><p className="mt-1 text-xs text-black/45">The admin can schedule a product for this day. Regular products are not shown here.</p><Link href="/shop" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-[10px] font-black text-white">Browse Shop</Link></section> : <section className="mt-5 overflow-hidden rounded-[30px] bg-white shadow-sm">
        <div className="grid md:grid-cols-2">
          <div className="relative aspect-square bg-[#F4F4F1] md:aspect-auto md:min-h-[500px]">{deal.imageUrl ? <img src={deal.imageUrl} alt={deal.title} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-sm font-bold text-black/25">No deal image</div>}<div className="absolute left-4 top-4 flex gap-2"><span className="rounded-full bg-[#E1352B] px-3 py-1.5 text-[9px] font-black text-white">{DAYS[day].toUpperCase()} DEAL</span>{discount > 0 && <span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-[9px] font-black">-{discount}% OFF</span>}</div></div>
          <div className="flex flex-col justify-center p-6 md:p-10">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Limited day offer</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{deal.title}</h2>
            <div className="mt-6 flex items-end gap-3"><span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#E1352B]">Rs. {Number(deal.dealPrice).toLocaleString()}</span>{Number(deal.originalPrice) > Number(deal.dealPrice) && <span className="pb-1 text-sm text-black/35 line-through">Rs. {Number(deal.originalPrice).toLocaleString()}</span>}</div>
            <div className="mt-5 flex items-center gap-2 rounded-2xl bg-[#F4F4F1] p-4 text-xs font-bold"><Clock3 size={16}/><span>Offer is reserved for {DAYS[day]}.</span></div>
            <div className="mt-6 flex flex-wrap gap-2"><Link href={deal.buttonLink || `/product/${deal.productId}`} className="inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white"><ShoppingBag size={15}/> Shop This Deal</Link><Link href={`/product/${deal.productId}`} className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-5 py-3 text-xs font-black">View Product</Link></div>
            <p className="mt-5 text-[10px] leading-5 text-black/40">When the {DAYS[day]} deal ends, the special deal price is no longer active. The product returns to its regular storefront pricing.</p>
          </div>
        </div>
      </section>}
      <div className="mt-5 text-center text-[10px] font-bold text-black/35">Deal end: {new Date(endAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</div>
    </div>
  </main>;
}
