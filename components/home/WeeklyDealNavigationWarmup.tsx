'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { pakistanNowWeekday, WEEKDAY_ORDER } from '@/lib/weeklyDealUtils';
import type { WeeklyDeal } from '@/lib/types';

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
      new Set(ordered.map((deal) => `/deals/${deal.day}`)),
    );
    if (!hrefs.length) return;

    // The live weekly deal is above the fold and is the most likely deal tap.
    // Warm its App Router payload immediately so the click does not wait on route code/RSC.
    router.prefetch(hrefs[0]);


  }, [router, weeklyDeals]);

  return null;
}
