'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { pakistanNowWeekday, WEEKDAY_ORDER } from '@/lib/weeklyDealUtils';
import type { WeeklyDeal } from '@/lib/types';

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export default function WeeklyDealNavigationWarmup({ weeklyDeals }: { weeklyDeals?: WeeklyDeal[] }) {
  const router = useRouter();

  useEffect(() => {
    const activeDeals = (Array.isArray(weeklyDeals) ? weeklyDeals : [])
      .filter((deal) => deal.active !== false && deal.productId && Number(deal.dealPrice) > 0);
    if (!activeDeals.length) return;

    const today = pakistanNowWeekday(new Date());
    const todayIndex = WEEKDAY_ORDER.indexOf(today);
    const ordered = [...activeDeals].sort((a, b) => {
      const aDistance = (WEEKDAY_ORDER.indexOf(a.day) - todayIndex + 7) % 7;
      const bDistance = (WEEKDAY_ORDER.indexOf(b.day) - todayIndex + 7) % 7;
      return aDistance - bDistance;
    });
    const hrefs = Array.from(
      new Set(ordered.map((deal) => `/product/${encodeURIComponent(deal.productId)}`)),
    );
    if (!hrefs.length) return;

    // The live weekly deal is above the fold and is the most likely product tap.
    // Warm its App Router payload immediately so the click does not wait on route code/RSC.
    router.prefetch(hrefs[0]);

    // Warm the next two visible weekly routes only when the browser is idle. This keeps
    // the homepage light on 4G while making adjacent weekly-deal taps much faster.
    const browser = window as IdleWindow;
    let idleId: number | null = null;
    let fallbackTimer: number | null = null;
    const warmAdjacent = () => hrefs.slice(1, 3).forEach((href) => router.prefetch(href));

    if (browser.requestIdleCallback) {
      idleId = browser.requestIdleCallback(warmAdjacent, { timeout: 1800 });
    } else {
      fallbackTimer = window.setTimeout(warmAdjacent, 900);
    }

    return () => {
      if (idleId != null) browser.cancelIdleCallback?.(idleId);
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
    };
  }, [router, weeklyDeals]);

  return null;
}
