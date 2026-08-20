'use client';

import type { WeeklyDeal } from '@/lib/types';

type Props = { currentDeal?: WeeklyDeal; liveDeal: boolean; bannerCountdown: string; timing: unknown; nowTick: number | null };

export default function ProductDealBanner({ currentDeal }: Props) {
  if (!currentDeal) return null;
  return null;
}
