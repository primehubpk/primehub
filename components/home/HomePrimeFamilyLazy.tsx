'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const PrimeFamilyDashboard = dynamic(
  () => import('@/components/reseller/PrimeFamilyDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[180px] rounded-[24px] bg-[#F6F1E8]" aria-hidden="true" />
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
      { rootMargin: '1200px 0px' },
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
        <div className="min-h-[1px]" aria-hidden="true" />
      )}
    </section>
  );
}
