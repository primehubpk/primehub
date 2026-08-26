'use client';

import Link from 'next/link';
import { ArrowLeft, Crown, Gift, ShoppingBag, WalletCards } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getTierProgress } from '@/lib/resellerTiers';

export default function ResellerDashboardPage() {
  const monthlyOrders = 7;
  const walletAvailable = 1250;
  const progress = getTierProgress(monthlyOrders);

  return (
    <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
      <Header />
      <section className="bg-[#14140F] px-4 pb-8 pt-6 text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link href="/reseller" className="inline-flex items-center gap-2 text-[10px] font-bold text-white/60"><ArrowLeft size={13} /> Reseller Club</Link>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCF68]/10 text-[#FFCF68]"><Crown size={24} /></div>
            <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FFCF68]">Prime Reseller</p><h1 className="text-2xl font-black">Welcome back</h1></div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<ShoppingBag size={15} />} label="Orders" value={`${monthlyOrders}`} />
            <Stat icon={<WalletCards size={15} />} label="Wallet" value={`Rs. ${walletAvailable.toLocaleString()}`} />
            <Stat icon={<Crown size={15} />} label="Tier" value={progress.current} />
            <Stat icon={<Gift size={15} />} label="Bonus" value="Coming" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <div className="rounded-[26px] bg-white p-5 shadow-[0_12px_35px_rgba(20,20,15,0.06)]">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Monthly challenge</p><h2 className="mt-1 text-lg font-black">10 orders = special reward</h2></div><span className="rounded-full bg-[#0F6A5F]/10 px-3 py-1 text-[9px] font-black text-[#0F6A5F]">{monthlyOrders}/10</span></div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-[#0F6A5F]" style={{ width: `${Math.min(100, monthlyOrders * 10)}%` }} /></div>
          <p className="mt-3 text-[10px] text-black/45">Complete {Math.max(0, 10 - monthlyOrders)} more eligible orders to unlock the monthly reward.</p>
        </div>

        <div className="rounded-[26px] bg-[#0F6A5F] p-5 text-white shadow-[0_12px_35px_rgba(15,106,95,0.14)]">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/55">Current tier</p>
          <div className="mt-2 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black capitalize">{progress.current}</h2><p className="mt-1 text-[10px] text-white/60">Reward rate shown from admin rules</p></div><div className="text-right text-3xl font-black">{getTierProgress(monthlyOrders).next ? `${getTierProgress(monthlyOrders).next?.rewardPercent}%` : '20%'}</div></div>
          {progress.next && <p className="mt-4 text-[10px] text-white/60">{progress.remaining} more orders to reach {progress.next.name}.</p>}
        </div>

        <div className="rounded-[26px] bg-white p-5 shadow-[0_12px_35px_rgba(20,20,15,0.06)]"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Wallet</p><h2 className="mt-1 text-2xl font-black">Rs. {walletAvailable.toLocaleString()}</h2><p className="mt-1 text-[10px] text-black/45">Available rewards. Withdrawal will be enabled in the wallet phase.</p></div>
      </section>
      <Footer />
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/[0.08]"><div className="flex items-center gap-1.5 text-[#FFCF68]">{icon}<span className="text-[8px] font-black uppercase tracking-wider text-white/45">{label}</span></div><p className="mt-1 text-sm font-black capitalize">{value}</p></div>;
}
