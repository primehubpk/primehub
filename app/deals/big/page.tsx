'use client';

import Link from 'next/link';
import { ArrowLeft, Clock3, ShoppingBag, Sparkles } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

function countdownEnd(endAt: string) {
  const end = endAt ? new Date(endAt).getTime() : 0;
  if (end > Date.now()) return new Date(end).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
  return 'When configured in Admin';
}

export default function BigDealPage() {
  const { settings, loading } = useSettings();
  const deal = settings.dailyDeal;
  const discount = deal && Number(deal.originalPrice) > Number(deal.dealPrice) ? Math.round(((Number(deal.originalPrice) - Number(deal.dealPrice)) / Number(deal.originalPrice)) * 100) : 0;

  if (loading) return <main className="min-h-screen bg-[#F4F4F1] p-6"><div className="mx-auto max-w-5xl animate-pulse rounded-[30px] bg-white p-8"><div className="h-7 w-40 rounded bg-black/10"/><div className="mt-6 aspect-[16/8] rounded-3xl bg-black/10"/></div></main>;

  return <main className="min-h-screen bg-[#F4F4F1] pb-28">
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-6">
      <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black shadow-sm"><ArrowLeft size={14}/> Back to Home</Link>
      {!deal?.active || !deal.title ? <section className="mt-5 rounded-[30px] bg-white p-10 text-center"><Sparkles className="mx-auto h-10 w-10 text-[#FFB020]"/><h1 className="mt-4 text-2xl font-black">Big Deal is not active</h1><p className="mt-1 text-xs text-black/45">The admin can publish the next Big Deal from Admin → Settings.</p></section> : <>
        <header className="mt-5 rounded-[30px] bg-[#14140F] p-6 text-white md:p-8"><p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#FFB020]">PrimeHub Spotlight</p><h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">Big Deal</h1><p className="mt-2 text-sm text-white/55">One featured offer, managed separately from Sunday–Saturday deals.</p></header>
        <section className="mt-5 overflow-hidden rounded-[30px] bg-white shadow-sm"><div className="grid md:grid-cols-2"><div className="relative aspect-square bg-[#F4F4F1] md:aspect-auto md:min-h-[520px]">{deal.imageUrl ? <img src={deal.imageUrl} alt={deal.title} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-sm font-bold text-black/25">No Big Deal image</div>}<div className="absolute left-4 top-4 flex gap-2"><span className="rounded-full bg-[#E1352B] px-3 py-1.5 text-[9px] font-black text-white">BIG DEAL</span>{discount > 0 && <span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-[9px] font-black">-{discount}% OFF</span>}</div></div><div className="flex flex-col justify-center p-6 md:p-10"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Limited time offer</p><h2 className="mt-2 text-3xl font-black md:text-4xl">{deal.title}</h2><div className="mt-6 flex items-end gap-3"><span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#E1352B]">Rs. {Number(deal.dealPrice).toLocaleString()}</span>{Number(deal.originalPrice) > Number(deal.dealPrice) && <span className="pb-1 text-sm text-black/35 line-through">Rs. {Number(deal.originalPrice).toLocaleString()}</span>}</div><div className="mt-5 rounded-2xl bg-[#F4F4F1] p-4 text-xs"><div className="flex items-center gap-2 font-bold"><Clock3 size={16}/> Offer ends</div><p className="mt-1 text-black/45">{countdownEnd(deal.endAt)}</p></div><div className="mt-6 flex flex-wrap gap-2"><Link href={deal.buttonLink || `/product/${deal.productId}`} className="inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white"><ShoppingBag size={15}/> Shop Big Deal</Link><Link href={`/product/${deal.productId}`} className="inline-flex rounded-xl border border-black/10 px-5 py-3 text-xs font-black">View Product</Link></div></div></div></section>
      </>}
    </div>
  </main>;
}
