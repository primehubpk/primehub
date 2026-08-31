import Link from 'next/link';
import { Users, Sparkles } from 'lucide-react';

export default function RewardsTeaser() {
  return (
    <Link
      href="/reseller/dashboard"
      className="block overflow-hidden rounded-[26px] bg-[#14140F] p-5 text-white shadow-lg"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#FFB020]">
            <Sparkles size={15} />
            <span className="text-[8px] font-black uppercase tracking-[0.22em]">
              PrimeHub Reseller Club
            </span>
          </div>
          <h3 className="mt-2 text-lg font-black">Sell more. Earn more.</h3>
          <p className="mt-1 text-[9px] leading-4 text-white/45">
            Missions, points, vouchers and reseller rewards.
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E1352B]">
          <Users size={20} />
        </div>
      </div>
    </Link>
  );
}
