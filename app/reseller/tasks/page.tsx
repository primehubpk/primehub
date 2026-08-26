'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronRight, Gift, Instagram, Music2, PlayCircle, Share2 } from 'lucide-react';
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS } from '@/lib/resellerTasks';

const icons: Record<string, any> = { youtube: PlayCircle, instagram: Instagram, tiktok: Music2, share: Share2 };

export default function ResellerTasksPage() {
  const [submitted, setSubmitted] = useState<string[]>([]);
  const challenge = DEFAULT_MONTHLY_CHALLENGE;
  const tasks = useMemo(() => DEFAULT_RESELLER_TASKS.filter(t => t.active), []);

  return <main className="min-h-screen bg-[#F4F4F1] text-[#15150F] px-4 py-5 sm:px-6">
    <div className="mx-auto max-w-md space-y-4">
      <Link href="/reseller/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[10px] font-black shadow-sm"><ArrowLeft size={13}/> Reseller Dashboard</Link>
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#171811] via-[#174F48] to-[#0F806E] p-6 text-white shadow-xl">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCF68] text-[#15150F]"><Gift size={23}/></div><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#FFCF68]">PrimeHub Rewards</p><h1 className="text-xl font-black">Tasks & Monthly Challenge</h1></div></div>
        <p className="mt-4 text-[11px] leading-5 text-white/70">Complete genuine tasks and submit them for review. Rewards are only credited after approval.</p>
      </section>
      <section className="rounded-[28px] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-widest text-[#0F806E]">Monthly Challenge</p><h2 className="mt-1 text-lg font-black">Complete {challenge.targetOrders} Orders</h2></div><div className="rounded-2xl bg-[#FFF0C8] px-3 py-2 text-center"><p className="text-[9px] font-black">CHOOSE</p><p className="text-[10px] font-black">GIFT / CASH</p></div></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-black/5"><div className="h-full w-0 rounded-full bg-[#0F806E]"/></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-[#E5F8F3] p-3"><p className="text-[9px] font-black text-[#0F806E]">🎁 GIFT</p><p className="mt-1 text-xs font-black">{challenge.giftTitle}</p></div><div className="rounded-2xl bg-[#FFF0D1] p-3"><p className="text-[9px] font-black text-[#A06B00]">💵 CASH</p><p className="mt-1 text-xs font-black">Rs. {challenge.cashReward.toLocaleString()}</p></div></div></section>
      <section className="space-y-3"><div className="flex items-end justify-between px-1"><div><p className="text-[9px] font-black uppercase tracking-widest text-black/35">Extra Rewards</p><h2 className="text-lg font-black">Complete Tasks</h2></div><span className="rounded-full bg-[#15150F] px-3 py-1.5 text-[9px] font-black text-white">{tasks.length} ACTIVE</span></div>
        {tasks.map(task => { const Icon = icons[task.id] || CheckCircle2; const done = submitted.includes(task.id); return <article key={task.id} className="rounded-[24px] bg-white p-4 shadow-sm"><div className="flex gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF7F4] text-[#0F806E]"><Icon size={21}/></div><div className="min-w-0 flex-1"><h3 className="text-sm font-black">{task.title}</h3><p className="mt-1 text-[10px] leading-4 text-black/45">{task.description}</p><button type="button" disabled={done} onClick={() => setSubmitted(v => [...v, task.id])} className={`mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[9px] font-black ${done ? 'bg-[#E5F8F3] text-[#0F806E]' : 'bg-[#15150F] text-white'}`}>{done ? <><CheckCircle2 size={12}/> Submitted for Review</> : <>Complete Task <ChevronRight size={12}/></>}</button></div></div></article> })}
      </section>
      <div className="rounded-2xl bg-[#FFF3D8] p-4 text-[9px] font-bold leading-4 text-[#765400]">⚠️ Task rewards are not added instantly. PrimeHub must verify your completion before any reward is credited to your wallet.</div>
    </div>
  </main>;
}
