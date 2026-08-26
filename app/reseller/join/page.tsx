'use client';

import Link from 'next/link';
import { ArrowLeft, Crown, LockKeyhole } from 'lucide-react';
import Header from '@/components/Header';

export default function ResellerJoinPage() {
  return (
    <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
      <Header />
      <section className="px-4 py-7 sm:px-6">
        <div className="mx-auto max-w-md">
          <Link href="/reseller" className="inline-flex items-center gap-2 text-[10px] font-black text-black/50">
            <ArrowLeft size={13} /> Reseller Club
          </Link>

          <div className="mt-5 rounded-[30px] bg-white p-5 shadow-[0_18px_50px_rgba(20,20,15,0.08)] sm:p-7">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14140F] text-[#FFCF68]">
              <Crown size={26} />
            </div>
            <div className="mt-5 text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Join PrimeHub</p>
              <h1 className="mt-1 text-2xl font-black">Become a Reseller</h1>
              <p className="mt-2 text-[11px] leading-5 text-black/45">Your secure email + password account will be created in the next phase.</p>
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-black/5 bg-[#F4F4F1] p-3.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-black/35">Email</p>
                <div className="mt-1 h-4 rounded bg-black/5" />
              </div>
              <div className="rounded-2xl border border-black/5 bg-[#F4F4F1] p-3.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-black/35">Password</p>
                <div className="mt-1 h-4 rounded bg-black/5" />
              </div>
              <button type="button" disabled className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14140F]/90 py-3.5 text-sm font-black text-white opacity-70">
                <LockKeyhole size={15} /> Signup coming in Phase 3
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
