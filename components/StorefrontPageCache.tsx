'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// Home stays in the document when the shopper opens Shop, Sale Mela, or any
// other page. Coming back shows the same pictures instead of painting a fresh
// skeleton and downloading them again. No catalog request is added here.
export default function StorefrontPageCache({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const homeNode = useRef<ReactNode>(null);
  const pendingHome = useRef<ReactNode>(null);
  const scrollY = useRef(0);
  const previousPath = useRef(pathname);
  const [homeCaptured, setHomeCaptured] = useState(false);

  if (pathname === '/') pendingHome.current = children;

  if (previousPath.current === '/' && pathname !== '/' && typeof window !== 'undefined') {
    scrollY.current = window.scrollY || window.pageYOffset || 0;
  }

  useLayoutEffect(() => {
    if (homeCaptured || pathname !== '/' || !document.querySelector('[data-ph-home-root]')) return;
    homeNode.current = pendingHome.current;
    setHomeCaptured(true);
  }, [pathname, children, homeCaptured]);

  useLayoutEffect(() => {
    const root = document.querySelector('[data-ph-home-cache]');
    if (!root) return;
    root.querySelectorAll('iframe').forEach((frame) => {
      const view = (frame as HTMLIFrameElement).contentWindow;
      if (!view) return;
      view.postMessage(JSON.stringify({
        event: 'command',
        func: pathname === '/' ? 'playVideo' : 'pauseVideo',
        args: [],
      }), '*');
    });
  }, [pathname, homeCaptured]);

  useLayoutEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    if (previous === '/' || pathname !== '/' || !homeNode.current) return;
    const y = scrollY.current;
    const restore = () => {
      if (window.location.pathname !== '/') return;
      if (window.scrollY !== y) window.scrollTo(0, y);
    };
    restore();
    const frame = window.requestAnimationFrame(restore);
    const timer = window.setTimeout(restore, 0);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  const cachedHome = homeNode.current;
  const homeVisible = pathname === '/';
  const renderHome = cachedHome ?? (homeVisible ? children : null);

  return (
    <>
      {renderHome ? (
        <div
          data-ph-home-cache=""
          hidden={!homeVisible}
          aria-hidden={homeVisible ? undefined : true}
          inert={homeVisible ? undefined : true}
        >
          {cachedHome ?? children}
        </div>
      ) : null}
      {homeVisible ? null : children}
    </>
  );
}
