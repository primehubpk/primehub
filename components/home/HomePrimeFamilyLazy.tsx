'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

function PrimeFamilyPreview() {
  return (
    <div className="mx-3 my-3 rounded-[22px] border border-[#D7C69F] bg-[#F6F1E8] px-5 py-6 text-[#162E28] shadow-sm sm:mx-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#976E20]">PrimeHubMall</p>
      <h2 className="mt-2 text-2xl font-black">Prime Family</h2>
      <p className="mt-2 text-sm leading-6 text-[#5B6258]">
        Apna wallet, cashback aur Prime Family benefits dekhein.
      </p>
      <Link href="/reseller/dashboard" className="mt-4 inline-flex rounded-xl bg-[#0F6658] px-5 py-3 text-sm font-extrabold text-white">
        Prime Family Dekhein →
      </Link>
    </div>
  );
}

const PrimeFamilyDashboard = dynamic(
  () => import('@/components/reseller/PrimeFamilyDashboard'),
  {
    ssr: false,
    loading: () => (
      <PrimeFamilyPreview />
    ),
  },
);

export default function HomePrimeFamilyLazy({
  initialSettings,
}: {
  initialSettings?: Record<string, unknown>;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '1600px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="home-prime-family-lazy">
      {ready ? (
        <PrimeFamilyDashboard
          embedded
          initialSettings={initialSettings}
        />
      ) : (
        <PrimeFamilyPreview />
      )}
    </section>
  );
}
