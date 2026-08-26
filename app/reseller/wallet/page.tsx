'use client';

import Link from 'next/link';
import { ArrowLeft, Banknote, Clock3, ShieldCheck, WalletCards } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { MIN_WITHDRAWAL_AMOUNT } from '@/lib/resellerWallet';

export default function ResellerWalletPage() {
  const available = 1250;
  const pending = 300;

  return (
    <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]"><Header />
      <section className="bg-[#14140F] px-4 py-7 text-white sm:px-6"><div className="mx-auto max-w-3xl"><Link href="/reseller/dashboard" className="inline-flex items-center gap-2 text-[10px] font-bold text-white/60"><ArrowLeft size={13}/> Dashboard</Link><div className="mt-5 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCF68]/10 text-[#FFCF68]"><WalletCards size={24}/></div><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FFCF68]">Reseller Wallet</p><h1 className="text-2xl font-black">Rs. {available.toLocaleString()}</h1></div></div></div></section>
      <section className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-2 gap-3"><Balance label="Available" value={available}/><Balance label="Pending" value={pending}/></div>
        <div className="rounded-[26px] bg-white p-5 shadow-[0_12px_35px_rgba(20,20,15,0.06)]"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Withdraw</p><h2 className="mt-1 text-lg font-black">Request your available reward</h2><p className="mt-2 text-[10px] leading-5 text-black/45">Minimum withdrawal: Rs. {MIN_WITHDRAWAL_AMOUNT}. Choose Easypaisa, JazzCash or Bank. Admin approval is required before payment.</p><div className="mt-4 grid gap-2 sm:grid-cols-3"><Method title="Easypaisa"/><Method title="JazzCash"/><Method title="Bank"/></div><button disabled className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14140F] py-3.5 text-sm font-black text-white opacity-50"><Banknote size={16}/> Withdrawal form in secure integration phase</button></div>
        <div className="rounded-[24px] border border-[#0F6A5F]/10 bg-[#0F6A5F]/5 p-4"><div className="flex items-center gap-2 text-sm font-black"><ShieldCheck size={16} className="text-[#0F6A5F]"/> Protected wallet flow</div><div className="mt-3 space-y-2 text-[10px] text-black/50"><p className="flex items-center gap-2"><Clock3 size={13}/> Pending rewards cannot be withdrawn.</p><p className="flex items-center gap-2"><ShieldCheck size={13}/> Wallet balances and approvals must be controlled by trusted backend/admin logic.</p></div></div>
      </section><Footer />
    </main>
  );
}

function Balance({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-white p-4 shadow-[0_10px_25px_rgba(20,20,15,0.04)]"><p className="text-[9px] font-black uppercase tracking-wider text-black/35">{label}</p><p className="mt-1 text-xl font-black">Rs. {value.toLocaleString()}</p></div>; }
function Method({ title }: { title: string }) { return <div className="rounded-2xl border border-black/5 bg-[#F4F4F1] p-3 text-center text-[10px] font-black">{title}</div>; }
