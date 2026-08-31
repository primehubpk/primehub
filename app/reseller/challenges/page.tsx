'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Gift, Instagram, Share2, Sparkles, Trophy, Youtube } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS, getChallengeProgress } from '@/lib/resellerChallenges';

const icons = { youtube: Youtube, instagram: Instagram, tiktok: Sparkles, share: Share2 } as const;

export default function ResellerChallengesPage() {
  const orders = 7;
  const challenge = DEFAULT_MONTHLY_CHALLENGE;
  const progress = getChallengeProgress(orders, challenge.targetOrders);

  return <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]"><Header />
    <section className="bg-[#14140F] px-4 py-7 text-white sm:px-6"><div className="mx-auto max-w-3xl"><Link href="/reseller/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold text-white/60"><ArrowLeft size={13}/> Dashboard</Link><div className="mt-5 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCF68]/10 text-[#FFCF68]"><Trophy size={24}/></div><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FFCF68]">Rewards & Tasks</p><h1 className="text-2xl font-black">Reseller Challenges</h1></div></div></div></section>
    <section className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="rounded-[28px] bg-[#0F6A5F] p-5 text-white shadow-[0_16px_40px_rgba(15,106,95,0.15)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/55">Monthly challenge</p><h2 className="mt-1 text-xl font-black">{challenge.title}</h2><p className="mt-1 text-[10px] text-white/60">{challenge.description}</p></div><Gift size={22} className="text-[#FFCF68]"/></div><div className="mt-5 flex items-end justify-between"><span className="text-xs font-black">{orders} / {challenge.targetOrders} orders</span><span className="text-xs font-black">{progress.percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#FFCF68]" style={{ width: `${progress.percent}%` }}/></div><div className="mt-4 rounded-2xl bg-white/[0.08] p-3"><p className="text-[9px] font-black uppercase tracking-wider text-white/45">Unlock reward</p><p className="mt-1 text-sm font-black">{challenge.rewardType === 'cash' ? `Rs. ${challenge.cashAmount?.toLocaleString()} Bonus Cash` : challenge.giftTitle}</p><p className="mt-1 text-[9px] text-white/50">{progress.completed ? 'Challenge completed!' : `${progress.remaining} more eligible orders to go.`}</p></div></div>
      <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Earn extra points</p><h2 className="mt-1 text-xl font-black">Social Tasks</h2><p className="mt-1 text-[10px] text-black/45">Complete enabled tasks to collect extra Reward Hub points.</p></div>
      <div className="space-y-3">{DEFAULT_RESELLER_TASKS.filter((task) => task.enabled).map((task) => { const Icon = icons[task.type]; return <div key={task.id} className="rounded-[24px] bg-white p-4 shadow-[0_10px_28px_rgba(20,20,15,0.05)]"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5"><Icon size={19}/></div><div className="min-w-0 flex-1"><h3 className="text-sm font-black">{task.title}</h3><p className="mt-0.5 text-[10px] text-black/45">{task.description}</p></div><span className="rounded-full bg-[#FFCF68]/25 px-2.5 py-1 text-[9px] font-black">+{task.points} pts</span></div><button disabled className="mt-3 w-full rounded-xl bg-[#14140F] py-2.5 text-[10px] font-black text-white opacity-50">Task verification in admin integration phase</button></div>; })}</div>
      <div className="rounded-[24px] border border-black/5 bg-white/70 p-4 text-[10px] leading-5 text-black/45"><div className="flex items-center gap-2 font-black text-[#14140F]"><CheckCircle2 size={14}/> Admin controlled rewards</div><p className="mt-1">Challenge targets, reward type, bonus amount, tasks, points and enabled/disabled status will be controlled from the Admin Panel.</p></div>
    </section><Footer /></main>;
}
