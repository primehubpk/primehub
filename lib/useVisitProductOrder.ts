'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { usePathname } from 'next/navigation';
import { recentProductsForVisit } from './shuffleProducts';

/** New visit/reopen only; timer ticks and ordinary browsing never redeal cards.
 * Keep SSR card space reserved until client ordering is ready, avoiding a first-card flash. */
export function useVisitProductOrder<T>(items: readonly T[], namespace: string,
  railRef: RefObject<HTMLDivElement | null>, enabled = true) {
  const pathname = usePathname();
  const activeRef = useRef(false);
  const lastEntry = useRef(-Infinity);
  const lead = useRef('');
  const [visit, setVisit] = useState<{ seed: number; previous: string } | null>(null);
  const storageKey = `ph-home-products-v1:${namespace}`;
  useEffect(() => {
    const active = enabled && pathname === '/';
    const enter = () => {
      if (!active || performance.now() - lastEntry.current < 300) return;
      lastEntry.current = performance.now();
      let previous = lead.current;
      try { previous = localStorage.getItem(storageKey) || previous; } catch {}
      const seed = typeof crypto !== 'undefined' && crypto.getRandomValues
        ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 0x100000000);
      setVisit({ seed, previous });
      if (railRef.current) { railRef.current.scrollLeft = 0; railRef.current.dispatchEvent(new Event('click')); }
    };
    if (active && !activeRef.current) enter();
    activeRef.current = active;
    let hidden = document.visibilityState === 'hidden';
    const visible = () => {
      if (document.visibilityState === 'hidden') hidden = true;
      else if (hidden) { hidden = false; enter(); }
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) enter(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pageshow', restore);
    return () => { document.removeEventListener('visibilitychange', visible); window.removeEventListener('pageshow', restore); };
  }, [pathname, enabled, storageKey, railRef]);
  const ordered = useMemo(() => enabled && visit
    ? recentProductsForVisit(items, visit.seed, namespace, visit.previous) : [...items], [items, visit, namespace, enabled]);
  const first = ordered[0] as { id?: string; product?: { id?: string } } | undefined;
  const firstId = String(first?.product?.id || first?.id || '');
  useEffect(() => {
    if (!enabled || !visit || !firstId || pathname !== '/') return;
    lead.current = firstId;
    try { localStorage.setItem(storageKey, firstId); } catch {}
  }, [enabled, visit, firstId, storageKey, pathname]);
  return { items: ordered, ready: !enabled || visit !== null };
}
