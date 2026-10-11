'use client';

import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { readKeptHomeScroll } from '@/lib/homeKeep';

// Keep one Home React tree for quick bottom-tab round trips; never duplicate
// another route, query the catalog, or cache personalized Orders/Cart data.
// Bounded lifetime avoids holding the entire storefront in low-memory WebViews.
const HOME_KEEP_MS = 2 * 60_000;

export default function StorefrontPageCache({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [savedHome, setSavedHome] = useState<ReactNode>(() => (isHome ? children : null));
  const previousPath = useRef(pathname);
  const homeWrapper = useRef<HTMLDivElement>(null);

  // Updating the element when an actual Home RSC refresh arrives reconciles the
  // existing HomePageClient (and its images) instead of creating a second tree.
  useEffect(() => {
    if (isHome) setSavedHome(children);
  }, [isHome, children]);

  useEffect(() => {
    if (isHome || savedHome === null) return;
    const timer = window.setTimeout(() => setSavedHome(null), HOME_KEEP_MS);
    return () => window.clearTimeout(timer);
  }, [isHome, savedHome]);

  useLayoutEffect(() => {
    const last = previousPath.current;
    if (last === '/' && !isHome) {
      // An unseen intro video must not consume bandwidth/CPU on other tabs.
      homeWrapper.current?.querySelectorAll('video').forEach((video) => video.pause());
    }
    if (last !== '/' && isHome && savedHome !== null) {
      const y = readKeptHomeScroll();
      const raf = window.requestAnimationFrame(() => {
        window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      });
      previousPath.current = pathname;
      return () => window.cancelAnimationFrame(raf);
    }
    previousPath.current = pathname;
  }, [isHome, pathname, savedHome]);

  return (
    <>
      <div
        ref={homeWrapper}
        data-ph-kept-home="1"
        style={{ display: isHome ? 'contents' : 'none' }}
        aria-hidden={!isHome}
        inert={!isHome}
      >
        {savedHome ?? (isHome ? children : null)}
      </div>
      {!isHome ? children : null}
    </>
  );
}
