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
export function useVisitShuffled<T>(items: T[], namespace: string, activePath: string, shuffleOnEntry = true): T[] {
  const pathname = usePathname();
  const activeRef = useRef(false);
  const [seed, setSeed] = useState<number | null>(null);
  useEffect(() => {
    const active = pathname === activePath;
    if (shuffleOnEntry && active && !activeRef.current) setSeed(visitSeed());
    activeRef.current = active;
  }, [pathname, activePath, shuffleOnEntry]);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (shuffleOnEntry && event.persisted && window.location.pathname === activePath) setSeed(visitSeed());
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, [activePath, shuffleOnEntry]);
  return useMemo(() => !shuffleOnEntry || seed === null ? items : shuffleForVisit(items, seed, namespace), [items, seed, namespace, shuffleOnEntry]);
}
