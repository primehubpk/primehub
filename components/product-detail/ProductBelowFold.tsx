'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const WeeklyDealCalendar = dynamic(() => import('@/components/WeeklyDealCalendar'), {
  ssr: false,
  loading: () => <SectionPlaceholder height={150} />,
});
const RecentlyViewed = dynamic(() => import('@/components/RecentlyViewed'), {
  ssr: false,
  loading: () => <SectionPlaceholder height={180} />,
});
const ReviewsSection = dynamic(() => import('@/components/ReviewsSection'), {
  ssr: false,
  loading: () => null,
});
const WeeklyDealProductExtras = dynamic(() => import('@/components/WeeklyDealProductExtras'), {
  ssr: false,
  loading: () => <SectionPlaceholder height={180} />,
});

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type ProductBelowFoldProps = {
  productId: string;
  weeklyDeals: any[];
  weeklyProducts: Record<string, any>;
  nowTick: number | null;
};

function SectionPlaceholder({ height }: { height: number }) {
  return <div aria-hidden="true" style={{ minHeight: height }} />;
}

function DeferredViewport({ children, height = 1 }: { children: ReactNode; height?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || ready) return;
    const browser = window as IdleWindow;
    let idleId: number | null = null;
    let fallbackTimer: number | null = null;

    const revealWhenIdle = () => {
      if (ready) return;
      if (browser.requestIdleCallback) {
        idleId = browser.requestIdleCallback(() => setReady(true), { timeout: 900 });
      } else {
        fallbackTimer = window.setTimeout(() => setReady(true), 80);
      }
    };

    if (!('IntersectionObserver' in window)) {
      revealWhenIdle();
      return () => {
        if (idleId != null) browser.cancelIdleCallback?.(idleId);
        if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        revealWhenIdle();
      },
      { rootMargin: '700px 0px' },
    );
    observer.observe(host);

    return () => {
      observer.disconnect();
      if (idleId != null) browser.cancelIdleCallback?.(idleId);
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
    };
  }, [ready]);

  return (
    <div ref={hostRef} style={!ready ? { minHeight: height } : undefined}>
      {ready ? children : null}
    </div>
  );
}

export default function ProductBelowFold({
  productId,
  weeklyDeals,
  weeklyProducts,
  nowTick,
}: ProductBelowFoldProps) {
  return (
    <>
      <DeferredViewport height={150}>
        <WeeklyDealCalendar
          weeklyDeals={weeklyDeals}
          weeklyProducts={weeklyProducts}
          nowTick={nowTick}
        />
      </DeferredViewport>
      <DeferredViewport height={180}>
        <RecentlyViewed excludeId={productId} />
      </DeferredViewport>
      <DeferredViewport>
        <ReviewsSection productId={productId} />
      </DeferredViewport>
      <DeferredViewport height={180}>
        <WeeklyDealProductExtras productId={productId} />
      </DeferredViewport>
    </>
  );
}
