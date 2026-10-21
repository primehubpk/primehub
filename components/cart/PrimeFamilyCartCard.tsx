'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Crown, Gift, Sparkles, Wallet } from 'lucide-react';

export type CashbackTier = {
  id: string;
  name: string;
  minMonthlyOrders: number;
  cashbackPercent: number;
};

type Props = {
  signedIn: boolean;
  activeMember: boolean;
  tierName: string;
  cashbackPercent: number;
  tierCashbackPercent: number;
  voucherCashbackPercent: number;
  voucherKind: string;
  referralPercent: number;
  referralCashEstimate: number;
  cashbackEstimate: number;
  eligibleSubtotal: number;
  voucherCashAmount: number;
  tiers: CashbackTier[];
};

/** Always use prices and tiers from /api/orders quote, not cart prices. */
export default function PrimeFamilyCartCard({
  signedIn, activeMember, tierName, cashbackPercent, tierCashbackPercent,
  voucherCashbackPercent, voucherKind, referralPercent, referralCashEstimate, cashbackEstimate,
  eligibleSubtotal, voucherCashAmount, tiers,
}: Props) {
  const active = signedIn && activeMember;
  const sorted = Array.isArray(tiers) ? [...tiers].sort((a, b) => a.minMonthlyOrders - b.minMonthlyOrders) : [];
  const money = (amount: number) => Math.max(0, Number(amount) || 0).toLocaleString('en-PK');
  const eligible = Math.max(0, Number(eligibleSubtotal || 0));
  const tierCashback = Math.max(0, Number(cashbackEstimate || 0));
  const cashVoucher = Math.min(Math.max(0, Number(voucherCashAmount || 0)), Math.max(0, eligible - tierCashback));
  return (
    <section aria-label="PrimeHub Family Cashback" className="mt-4 overflow-hidden rounded-[22px] border border-[#0F6A5F]/15 bg-gradient-to-br from-[#EFF9F5] via-[#F7FCF9] to-[#FFF9E9] p-3.5 sm:p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#0F6A5F] text-white"><Gift size={20}/></span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-extrabold uppercase tracking-[.13em] text-[#13746B]">PrimeHub Family</p>
          <h3 className="text-sm font-black leading-5 text-[#123B32]">Earn cashback from your orders</h3>
        </div>
        <Sparkles size={18} className="shrink-0 text-[#D29D39]" />
      </div>

      {!signedIn ? (
        <div className="mt-3">
          <p className="text-[11px] leading-5 text-[#355C50]">Join PrimeHub Family and earn cashback on eligible purchases. Your reward goes into your withdrawable Cash Wallet after delivery.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href="/reseller/join?mode=signup&redirect=%2Fcart" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 text-xs font-extrabold text-white">Sign Up & Earn <ArrowRight size={14}/></Link>
            <Link href="/reseller/join?mode=signin&redirect=%2Fcart" className="rounded-xl border border-[#0F6A5F]/20 bg-white px-3 py-2.5 text-[11px] font-bold text-[#0F6A5F]">Already a member? Sign In</Link>
          </div>
        </div>
      ) : !active ? (
        <div className="mt-3">
          <p className="text-[11px] leading-5 text-[#355C50]">You are signed in. Activate your PrimeHub Family membership to earn cashback on eligible orders.</p>
          <Link href="/reseller/join?mode=signin&redirect=%2Fcart" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 text-xs font-extrabold text-white">Activate Prime Family <ArrowRight size={14}/></Link>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-[#0F6A5F]/10 bg-white/85 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#176E62]"><Crown size={13}/> Your current tier: {tierName || 'Prime Family'} · {tierCashbackPercent || cashbackPercent}%</p>
              <p className="mt-1 text-[10px] leading-4 text-black/55">Eligible products: Rs. {money(eligible)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[9px] font-bold text-black/45">{voucherKind === 'referral' ? 'Your cashback' : 'You can earn'}</p>
              <p className="text-lg font-black leading-6 text-[#0F6A5F]">Rs. {money(tierCashback + cashVoucher)}</p>
            </div>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[10px] font-semibold leading-4 text-[#276C5C]">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            {voucherKind === 'referral' ? 'This order uses a friend code. Your tier cashback is replaced; the code owner can earn an inviter reward after delivery.' : eligible > 0 ? 'This cashback will be credited to your withdrawable Cash Wallet after Admin marks your order Delivered.' : 'This cart has no cashback-eligible products. Big Deal and Weekly Deal items are excluded.'}
          </p>
          {voucherKind === 'referral' && <p className="mt-1 text-[10px] font-bold text-[#0F6A5F]">Friend code: {referralPercent}% (estimated Rs. {money(referralCashEstimate)}) goes to the code OWNER once this buyer's qualifying order is Delivered; not to buyer. No double cashback.</p>}
          {voucherKind === 'cashback' && <p className="mt-1 text-[10px] font-bold text-[#0F6A5F]">Promo {voucherCashbackPercent}% replaces tier cashback: Rs. {money(cashVoucher)} Cash Wallet credit on delivery (not extra).</p>}
          {voucherKind === 'cash' && <p className="mt-1 text-[10px] font-bold text-[#0F6A5F]">Fixed cash voucher replaces tier cashback: Rs. {money(cashVoucher)} after delivery.</p>}
          {voucherKind === 'discount' && <p className="mt-1 text-[10px] font-bold text-[#0F6A5F]">Checkout discount voucher applied instead of tier cashback on this order.</p>}
        </div>
      )}

      {sorted.length > 0 && <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[10px] font-extrabold text-[#345E52]"><Wallet size={12}/> Cashback tiers</p>
          <Link href="/reseller/dashboard" className="text-[9px] font-bold text-[#0F6A5F] underline-offset-2 hover:underline">View benefits →</Link>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {sorted.map((tier) => {
            const current = active && tier.name.toLowerCase() === tierName.toLowerCase();
            return <div key={tier.id} className={`rounded-xl border px-1.5 py-2 text-center ${current ? 'border-[#0F6A5F] bg-[#0F6A5F] text-white' : 'border-[#0F6A5F]/10 bg-white/80 text-[#234C41]'}`}>
              <p className="truncate text-[9px] font-extrabold">{tier.name}</p>
              <p className="mt-0.5 text-sm font-black">{Number(tier.cashbackPercent) || 0}%</p>
              <p className={`mt-0.5 text-[8px] font-bold ${current ? 'text-white/85' : 'text-black/45'}`}>{current ? 'CURRENT' : `${tier.minMonthlyOrders}+ orders`}</p>
            </div>;
          })}
        </div>
      </div>}
      <p className="mt-2 text-[9px] leading-4 text-[#628177]">Cashback applies to eligible regular products only—not Big Deal or Weekly Deal. No cashback is subtracted from checkout payment.</p>
    </section>
  );
}
