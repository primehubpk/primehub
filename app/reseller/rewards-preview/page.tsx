'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { calculateResellerReward, type EligibleResellerOrder } from '@/lib/resellerRewards';

const samples: EligibleResellerOrder[] = [
  { orderId: 'DEMO-1001', status: 'delivered', subtotal: 5000 },
  { orderId: 'DEMO-1002', status: 'pending', subtotal: 3000 },
  { orderId: 'DEMO-1003', status: 'cancelled', subtotal: 2500 },
];

export default function ResellerRewardsPreviewPage() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
      <Header />
      <section className="bg-[#14140F] px-4 py-7 text-white sm:px-6"><div className="mx-auto max-w-3xl"><Link href="/reseller/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold text-white/60"><ArrowLeft size={13}/> Dashboard</Link><h1 className="mt-5 text-2xl font-black">Reward Engine Preview</h1><p className="mt-1 text-[11px] text-white/50">Only eligible delivered orders can create a reseller reward.</p></div></section>
      <section className="mx-auto max-w-3xl space-y-3 px-4 py-6 sm:px-6">
        {samples.map((order, index) => { const result = calculateResellerReward(order, index + 4); return <article key={order.orderId} className="rounded-[24px] bg-white p-4 shadow-[0_10px_28px_rgba(20,20,15,0.05)]"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wider text-black/35">{order.orderId}</p><h2 className="mt-1 text-sm font-black">Rs. {order.subtotal.toLocaleString()}</h2></div>{result.eligible ? <CheckCircle2 className="text-[#0F6A5F]" size={20}/> : <XCircle className="text-[#E1352B]" size={20}/>}</div><div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black"><span className="rounded-full bg-black/5 px-2.5 py-1 capitalize">{order.status}</span><span className="rounded-full bg-[#0F6A5F]/10 px-2.5 py-1 text-[#0F6A5F]">{result.rewardPercent}% tier rate</span>{result.eligible && <span className="rounded-full bg-[#FFCF68]/25 px-2.5 py-1">Reward Rs. {result.rewardAmount.toLocaleString()}</span>}</div><p className="mt-2 text-[10px] text-black/45">{result.reason}</p></article>; })}
        <div className="rounded-[24px] border border-[#0F6A5F]/10 bg-[#0F6A5F]/5 p-4"><div className="flex items-center gap-2 text-sm font-black"><ShieldCheck size={17} className="text-[#0F6A5F]"/> Protected reward flow</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><Mini icon={<Clock3 size={14}/>} text="Pending rewards are not withdrawable."/><Mini icon={<CheckCircle2 size={14}/>} text="Delivered eligible orders can qualify."/></div></div>
      </section><Footer />
    </main>
  );
}

function Mini({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-[10px] font-semibold text-black/55">{icon}{text}</div>; }
