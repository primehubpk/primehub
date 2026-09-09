'use client';

import { useEffect } from 'react';

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const browser = window as IdleWindow;
    let idleId: number | null = null;
    let fallbackTimer: number | null = null;
    let registration: ServiceWorkerRegistration | null = null;
    let lastUpdateAt = 0;
    let disposed = false;

    const refreshWorker = () => {
      if (!registration || !navigator.onLine) return;
      const now = Date.now();
      if (now - lastUpdateAt < 5 * 60_000) return;
      lastUpdateAt = now;
      void registration.update().catch(() => undefined);
    };

    const register = async () => {
      try {
        const nextRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        if (disposed) return;
        registration = nextRegistration;
        refreshWorker();
      } catch {
        // PWA support is progressive; a registration failure must never
        // affect the shopping experience.
      }
    };

    const scheduleRegistration = () => {
      if (browser.requestIdleCallback) {
        idleId = browser.requestIdleCallback(() => { void register(); }, { timeout: 1800 });
      } else {
        fallbackTimer = window.setTimeout(() => { void register(); }, 450);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshWorker();
    };
    const onOnline = () => refreshWorker();

    if (document.readyState === 'complete') scheduleRegistration();
    else window.addEventListener('load', scheduleRegistration, { once: true });

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      disposed = true;
      window.removeEventListener('load', scheduleRegistration);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      if (idleId != null) browser.cancelIdleCallback?.(idleId);
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
    };
  }, []);

  return null;
}
