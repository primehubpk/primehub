'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Coins, ShoppingBag, Ticket } from 'lucide-react';
import RewardsVoucherPanel from '@/components/RewardsVoucherPanel';
import { useRewardsStore } from '@/lib/rewardsStore';

const DEMO_SUBTOTAL = 3490;

export default function RewardsPreviewPage() {
  const appliedVoucher = useRewardsStore((state) => state.appliedVoucher);
  const vouchers = useRewardsStore((state) => state.vouchers);
  const pointsToRedeem = useRewardsStore((state) => state.pointsToRedeem);
  const getVoucherDiscount = useRewardsStore((state) => state.getVoucherDiscount);
  const getPointsDiscount = useRewardsStore((state) => state.getPointsDiscount);

  const voucherDiscount = getVoucherDiscount(DEMO_SUBTOTAL);
  const pointsDiscount = getPointsDiscount(Math.max(0, DEMO_SUBTOTAL - voucherDiscount));
  const finalTotal = Math.max(0, DEMO_SUBTOTAL - voucherDiscount - pointsDiscount);
  const applied = useMemo(() => vouchers.find((v) => v.code === appliedVoucher), [vouchers, appliedVoucher]);

  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 pb-16 pt-4 text-[#14140F]">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" aria-label="Back to shop"><ArrowLeft size={17} /></Link>
        <div className="mt-5 rounded-[30px] bg-[#14140F] p-6 text-white shadow-xl md:p-8">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/45">PrimeHub Rewards</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Rewards & Voucher Center</h1>
          <p className="mt-2 max-w-xl text-xs leading-5 text-white/55">Spin for a voucher, redeem points, and see the order total update.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/8 p-4"><Coins size={17} className="text-[#FFB020]" /><p className="mt-2 text-lg font-black">350</p><p className="text-[9px] text-white/40">Reward points</p></div>
            <div className="rounded-2xl bg-white/8 p-4"><Ticket size={17} className="text-[#E1352B]" /><p className="mt-2 text-lg font-black">{vouchers.length}</p><p className="text-[9px] text-white/40">Saved vouchers</p></div>
          </div>
        </div>
        <RewardsVoucherPanel subtotal={DEMO_SUBTOTAL} />
        <section className="mt-4 rounded-[26px] border border-black/7 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><ShoppingBag size={16} /><h2 className="text-sm font-black">Live cart total preview</h2></div>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between"><span className="text-black/45">Cart subtotal</span><strong>Rs. {DEMO_SUBTOTAL.toLocaleString()}</strong></div>
            {applied && <div className="flex justify-between text-[#0F6A5F]"><span>Voucher · {applied.code}</span><strong>- Rs. {voucherDiscount.toLocaleString()}</strong></div>}
            {pointsToRedeem > 0 && <div className="flex justify-between text-[#0F6A5F]"><span>Reward points · {pointsToRedeem.toLocaleString()}</span><strong>- Rs. {pointsDiscount.toLocaleString()}</strong></div>}
            <div className="h-px bg-black/8" />
            <div className="flex items-center justify-between"><span className="font-black">Final total</span><span className="font-[family-name:var(--font-mono)] text-2xl font-black">Rs. {finalTotal.toLocaleString()}</span></div>
          </div>
          {(voucherDiscount > 0 || pointsDiscount > 0) && <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#0F6A5F]/8 p-3 text-[10px] font-black text-[#0F6A5F]"><CheckCircle2 size={15} /> Discount is reflected in the final total.</div>}
          <Link href="/checkout" className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#14140F] py-3.5 text-xs font-black text-white">Continue to Checkout</Link>
        </section>
      </div>
    </main>
  );
}
