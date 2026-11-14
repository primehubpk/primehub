'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronDown, Gift, UsersRound } from 'lucide-react';
import './HomeCommerceRails.css';

export function HomePrimeFamilyBanner() {
  return (
    <div className="home-commerce-banner home-commerce-banner--family home-prime-family-banner" aria-label="Prime Family rewards collection">
      <span className="home-commerce-banner__emblem" aria-hidden="true">
        <UsersRound size={29} strokeWidth={1.9} />
      </span>
      <div className="home-commerce-banner__copy">
        <span className="home-commerce-banner__eyebrow">PRIMEHUBMALL · MEMBERS</span>
        <h2>Prime Family</h2>
        <span className="home-commerce-banner__cta">Spin Wheel · Wallet · Cashback</span>
      </div>
      <div className="home-commerce-banner__photos home-prime-family-banner__photos" aria-hidden="true">
        <span className="home-commerce-banner__photo home-prime-family-banner__wheel">
          <span className="home-prime-family-banner__wheel-face" />
        </span>
        <span className="home-commerce-banner__photo home-prime-family-banner__gift">
          <Gift size={28} strokeWidth={2} />
        </span>
      </div>
      <a
        href="#prime-family-dashboard"
        className="home-commerce-banner__link"
        aria-label="Prime Family full dashboard, Spin Wheel, wallet and rewards neeche dekhein"
      >
        <span className="sr-only">View the full Prime Family section below</span>
      </a>
      <div className="home-commerce-banner__controls home-prime-family-banner__controls" aria-hidden="true">
        <span>Full Prime Family neeche dekhein</span>
        <ChevronDown size={18} />
      </div>
    </div>
  );
}

// A small loading state, not a duplicate Prime Family heading/card.
// The real dashboard mounts immediately, including its Admin-driven wheel,
// check-in, referral, wallet, tiers, tasks and gift sections.
function PrimeFamilyLoading() {
  return (
    <div className="mx-4 my-3 rounded-2xl border border-[#e1d6ba] bg-[#F6F1E8] p-5 text-sm text-[#174F44]" role="status">
      Prime Family rewards load ho rahe hain…
      <Link href="/reseller/dashboard" className="mt-2 block font-bold underline underline-offset-2">
        Prime Family page kholein
      </Link>
    </div>
  );
}

const PrimeFamilyDashboard = dynamic(
  () => import('@/components/reseller/PrimeFamilyDashboard'),
  {
    ssr: false,
    loading: () => <PrimeFamilyLoading />,
  },
);

export default function HomePrimeFamilyLazy({
  initialSettings,
}: {
  initialSettings?: Record<string, unknown>;
}) {
  return (
    <section className="home-prime-family-lazy" aria-label="Prime Family full dashboard">
      <PrimeFamilyDashboard embedded initialSettings={initialSettings} />
    </section>
  );
}
