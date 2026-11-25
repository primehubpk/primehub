'use client';

import Link from 'next/link';
import { ArrowRight, Gift, UsersRound, Sparkles, CalendarCheck } from 'lucide-react';

// The homepage advertises Prime Family; the full account dashboard lives at /reseller/dashboard.
export default function HomePrimeFamilyLazy(_props: {
  initialSettings?: Record<string, unknown>;
}) {
  return (
    <section aria-label="Prime Family membership" className="my-3">
      <Link href="/reseller/dashboard" className="relative flex min-h-[150px] items-center gap-3 overflow-hidden rounded-[22px] border border-[#d5b46c] bg-gradient-to-br from-[#103b35] via-[#0c6559] to-[#174d42] p-4 text-[#fff5db] shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f6a5f] sm:p-6">
        <div aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-2 border-[#ffe7a2] bg-gradient-to-br from-[#fff0b7] to-[#c48b31] text-[#174d42] shadow-md sm:h-20 sm:w-20">
          <UsersRound size={34} strokeWidth={2.3} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#f4cf83]">Your exclusive rewards club</p>
          <h2 className="mt-1 text-[25px] font-black leading-none tracking-tight text-[#fff1c6] sm:text-3xl">Prime Family</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-[#fff5db]">
            <span className="inline-flex items-center gap-1"><Gift size={13}/> Rewards</span>
            <span className="inline-flex items-center gap-1"><CalendarCheck size={13}/> Daily check-in</span>
            <span className="inline-flex items-center gap-1"><Sparkles size={13}/> Spin &amp; earn</span>
          </p>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ffe5a1] px-3 py-2 text-xs font-black text-[#174d42]">Explore Prime Family <ArrowRight size={14}/></span>
        </div>
      </Link>
    </section>
  );
}
