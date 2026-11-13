'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { shuffleForVisit } from '@/lib/shuffleProducts';

function visitSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 0x100000000);
}

/** SSR is cacheable/deterministic. Only an actual page entry/refresh gets a new
 * seed, not timer ticks, swipe, search, focus or background catalog refreshes. */
export function useVisitShuffled<T>(items: T[], namespace: string, activePath: string): T[] {
  const pathname = usePathname();
  const activeRef = useRef(false);
  const [seed, setSeed] = useState<number | null>(null);
  useEffect(() => {
    const active = pathname === activePath;
    if (active && !activeRef.current) setSeed(visitSeed());
    activeRef.current = active;
  }, [pathname, activePath]);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted && window.location.pathname === activePath) setSeed(visitSeed());
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, [activePath]);
  return useMemo(() => seed === null ? items : shuffleForVisit(items, seed, namespace), [items, seed, namespace]);
}
