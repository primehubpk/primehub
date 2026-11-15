'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { selectBannerPreviews } from './bannerPreviewImages';

/** OWNER SETTING: fresh previews on refresh/reopen/return; never on countdown ticks.
 * Product order, pricing and category membership stay unchanged. */
export function useVisitBannerImages(images: readonly string[], namespace: string, count = 2): string[] {
  const pathname = usePathname();
  const mountedPath = useRef(pathname);
  const activeRef = useRef(false);
  const selectedRef = useRef<string[]>([]);
  const poolRef = useRef<readonly string[]>(images);
  const lastSelection = useRef(-Infinity);
  const [selected, setSelected] = useState<string[]>([]);
  poolRef.current = images;
  const poolKey = images.join('\n');

  useEffect(() => {
    const active = pathname === mountedPath.current;
    const choose = () => {
      if (!active || !poolRef.current.some(Boolean)) return;
      const now = performance.now();
      if (now - lastSelection.current < 300) return;
      lastSelection.current = now;
      const key = `ph-banner-photo:${mountedPath.current}:${namespace}`;
      let previous = selectedRef.current[0] || '';
      try { previous = localStorage.getItem(key) || previous; } catch {}
      const seed = typeof crypto !== 'undefined' && crypto.getRandomValues
        ? crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 0x100000000);
      const next = selectBannerPreviews(poolRef.current, seed, namespace, previous, count);
      selectedRef.current = next;
      setSelected(next);
      try { if (next[0]) localStorage.setItem(key, next[0]); } catch {}
    };
    if (active && (!activeRef.current || !selectedRef.current.length || selectedRef.current.some(src => !poolRef.current.includes(src)))) choose();
    activeRef.current = active;
    let hidden = document.visibilityState === 'hidden';
    const visible = () => {
      if (document.visibilityState === 'hidden') hidden = true;
      else if (hidden) { hidden = false; choose(); }
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) choose(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('pageshow', restore);
    return () => {
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('pageshow', restore);
    };
  }, [pathname, namespace, count, poolKey]);

  // SSR shows the decorative emblem, never a real photo that flips on hydration.
  return selected.filter(src => images.includes(src));
}
