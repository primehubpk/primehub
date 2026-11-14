'use client';

import { createContext, createElement, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { usePathname } from 'next/navigation';
import { recentProductsForVisit } from './shuffleProducts';

// A unique server seed is embedded into dynamic homepage HTML on each HTTP visit.
// Using the same initial seed on SSR and hydration prevents stale-image flashing.
const HomeVisitContext = createContext<{seed: number; previous: Record<string, string>} | null>(null);
export function HomeVisitProvider({seed, previous, children}: {
  seed: number; previous: Record<string, string>; children: ReactNode;
}) {
  const value = useMemo(() => ({seed, previous}), [seed, previous]);
  return createElement(HomeVisitContext.Provider, {value}, children);
}

/** New visit/reopen only; timer ticks and ordinary browsing never redeal cards.
 * Real SSR cards stay visible even while client ordering or JavaScript is delayed. */
export function useVisitProductOrder<T>(items: readonly T[], namespace: string,
  railRef: RefObject<HTMLDivElement | null>, enabled = true) {
  const pathname = usePathname();
  const bootstrap = useContext(HomeVisitContext);
  const activeRef = useRef(false);
  const lastEntry = useRef(-Infinity);
  const lead = useRef('');
  const [visit, setVisit] = useState<{ seed: number; previous: string } | null>(
    () => enabled && bootstrap ? { seed: bootstrap.seed, previous: bootstrap.previous[namespace] || '' } : null,
  );
  const storageKey = `ph-home-products-v1:${namespace}`;
  // Shuffle promptly on every fresh hydration, before the browser paints the
  // hydrated page; SSR cards remain visible until JavaScript is ready.
  useLayoutEffect(() => {
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
    // SSR already rendered the shuffled visit. Do not reshuffle it on hydration.
    if (active && !activeRef.current && !bootstrap) enter();
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
  }, [pathname, enabled, storageKey, railRef, bootstrap]);
  const ordered = useMemo(() => enabled && visit
    ? recentProductsForVisit(items, visit.seed, namespace, visit.previous) : [...items], [items, visit, namespace, enabled]);
  const first = ordered[0] as { id?: string; product?: { id?: string } } | undefined;
  const firstId = String(first?.product?.id || first?.id || '');
  useEffect(() => {
    if (!enabled || !visit || !firstId || pathname !== '/') return;
    lead.current = firstId;
    try { localStorage.setItem(storageKey, firstId); } catch {}
    try { document.cookie = `ph-vis-${encodeURIComponent(namespace)}=${encodeURIComponent(firstId)}; Path=/; Max-Age=604800; SameSite=Lax`; } catch {}
  }, [enabled, visit, firstId, storageKey, pathname]);
  return { items: ordered, ready: !enabled || visit !== null };
}
