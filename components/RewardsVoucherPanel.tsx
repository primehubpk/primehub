'use client';

import { useMemo, useState } from 'react';
import { Gift, Sparkles, Ticket, Coins, Check } from 'lucide-react';
import { useRewardsStore } from '@/lib/rewardsStore';

export default function RewardsVoucherPanel({ subtotal = 0 }: { subtotal?: number }) {
  const rewardPoints = useRewardsStore((state) => state.rewardPoints);
  const vouchers = useRewardsStore((state) => state.vouchers);
  const appliedVoucher = useRewardsStore((state) => state.appliedVoucher);
  const pointsToRedeem = useRewardsStore((state) => state.pointsToRedeem);
  const hasSpun = useRewardsStore((state) => state.hasSpun);
  const spinAndWin = useRewardsStore((state) => state.spinAndWin);
  const applyVoucher = useRewardsStore((state) => state.applyVoucher);
  const removeVoucher = useRewardsStore((state) => state.removeVoucher);
  const setPointsToRedeem = useRewardsStore((state) => state.setPointsToRedeem);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState('');

  const applied = useMemo(() => vouchers.find((voucher) => voucher.code === appliedVoucher) || null, [vouchers, appliedVoucher]);
  const maxPoints = Math.floor(rewardPoints / 100) * 100;
  const pointsDiscount = Math.min(pointsToRedeem * 0.1, Math.max(0, subtotal));

  const spin = () => {
    setSpinning(true);
    window.setTimeout(() => {
      const voucher = spinAndWin();
      setWon(`${voucher.title} • ${voucher.code}`);
      setSpinning(false);
    }, 850);
  };

  return (
    <section className="mt-4 overflow-hidden rounded-[26px] border border-black/7 bg-white shadow-sm">
      <div className="bg-[#14140F] p-4 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Gift size={17} /></span>
          <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">Rewards & vouchers</p><h3 className="text-sm font-black">Save more on this order</h3></div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/8 p-3">
          <div className="flex items-center gap-2"><Coins size={16} className="text-[#FFB020]" /><span className="text-[11px] font-black">{rewardPoints.toLocaleString()} points</span></div>
          <span className="text-[9px] font-bold text-white/45">100 pts = Rs. 10</span>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="rounded-2xl border border-[#E1352B]/15 bg-[#E1352B]/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-black">Spin & Win</p><p className="mt-0.5 text-[9px] leading-4 text-black/45">Win a voucher and apply it instantly.</p></div>
            <button type="button" onClick={spin} disabled={spinning} className="flex items-center gap-1.5 rounded-xl bg-[#E1352B] px-3 py-2 text-[9px] font-black text-white disabled:opacity-60"><Sparkles size={12} />{spinning ? 'Spinning…' : hasSpun ? 'Spin Again' : 'Spin Now'}</button>
          </div>
          {won && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-[9px] font-black text-[#E1352B]">🎉 {won}</p>}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2"><Ticket size={14} className="text-[#0F6A5F]" /><p className="text-[10px] font-black">Available vouchers</p></div>
          <div className="space-y-2">
            {vouchers.map((voucher) => {
              const selected = appliedVoucher === voucher.code;
              return <button key={voucher.code} type="button" onClick={() => selected ? removeVoucher() : applyVoucher(voucher.code)} className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left ${selected ? 'border-[#0F6A5F] bg-[#0F6A5F]/5' : 'border-black/8 bg-[#F4F4F1]'}`}>
                <span><span className="block text-[10px] font-black">{voucher.title}</span><span className="mt-0.5 block text-[9px] text-black/40">{voucher.code} · {voucher.expires}</span></span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white">{selected ? <Check size={13} className="text-[#0F6A5F]" /> : <span className="text-[9px] font-black">Use</span>}</span>
              </button>;
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-[#F4F4F1] p-3">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-black">Use reward points</p><p className="text-[9px] text-black/40">Redeem in 100-point steps</p></div><span className="text-[10px] font-black">{pointsToRedeem.toLocaleString()}</span></div>
          <input aria-label="Reward points to redeem" type="range" min="0" max={maxPoints} step="100" value={pointsToRedeem} onChange={(e) => setPointsToRedeem(Number(e.target.value))} className="mt-3 w-full accent-[#0F6A5F]" />
          <div className="mt-1 flex justify-between text-[8px] font-bold text-black/35"><span>0 pts</span><span>{maxPoints.toLocaleString()} pts max</span></div>
          {pointsDiscount > 0 && <p className="mt-2 text-[9px] font-black text-[#0F6A5F]">You save Rs. {Math.round(pointsDiscount).toLocaleString()} with points</p>}
        </div>

        {applied && <div className="rounded-xl bg-[#0F6A5F]/8 px-3 py-2 text-[9px] font-black text-[#0F6A5F]">Voucher applied: {applied.code}</div>}
      </div>
    </section>
  );
}
