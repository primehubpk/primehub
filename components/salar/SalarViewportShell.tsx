'use client';

import dynamic from 'next/dynamic';
import { CSSProperties, useEffect, useState } from 'react';
import RewardWheelPresentationEnhancer from '@/components/rewards/RewardWheelPresentationEnhancer';

const SalarWidget = dynamic(() => import('@/components/salar/SalarWidget'), { ssr: false });
const SalarInteractionEnhancer = dynamic(() => import('@/components/salar/SalarInteractionEnhancer'), { ssr: false });
const SalarOrderCustomizationBridge = dynamic(() => import('@/components/salar/SalarOrderCustomizationBridge'), { ssr: false });
const SalarOrderFeedbackBridge = dynamic(() => import('@/components/salar/SalarOrderFeedbackBridge'), { ssr: false });

type VisualBox = { height: number; top: number };

type SalarShellStyle = CSSProperties & {
  '--salar-viewport-height': string;
  '--salar-viewport-top': string;
};

function currentVisualBox(): VisualBox {
  if (typeof window === 'undefined') return { height: 800, top: 0 };
  const viewport = window.visualViewport;
  return {
    height: Math.max(320, Math.round(viewport?.height || window.innerHeight)),
    top: Math.max(0, Math.round(viewport?.offsetTop || 0)),
  };
}

function routeIsStillLoading() {
  return Boolean(document.querySelector('main[role="status"][aria-label="Opening page"]'));
}

export default function SalarViewportShell() {
  const [visualBox, setVisualBox] = useState<VisualBox>({ height: 800, top: 0 });
  const [salarReady, setSalarReady] = useState(false);

  useEffect(() => {
    const update = () => setVisualBox(currentVisualBox());
    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  useEffect(() => {
    let idleId = 0;
    let timeoutId = 0;
    let scheduled = false;
    let disposed = false;

    const reveal = () => {
      if (disposed) return;
      setSalarReady(true);
    };

    const schedule = () => {
      if (scheduled || disposed || routeIsStillLoading()) return;
      scheduled = true;
      const requestIdle = (window as any).requestIdleCallback as undefined | ((callback: () => void, options?: { timeout: number }) => number);
      if (typeof requestIdle === 'function') idleId = requestIdle(reveal, { timeout: 900 });
      else timeoutId = window.setTimeout(reveal, 250);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', schedule, { once: true });
    schedule();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('load', schedule);
      if (timeoutId) window.clearTimeout(timeoutId);
      const cancelIdle = (window as any).cancelIdleCallback as undefined | ((id: number) => void);
      if (idleId && typeof cancelIdle === 'function') cancelIdle(idleId);
    };
  }, []);

  const style: SalarShellStyle = {
    '--salar-viewport-height': `${visualBox.height}px`,
    '--salar-viewport-top': `${visualBox.top}px`,
  };

  return (
    <div id="salar-viewport-shell" style={style}>
      <RewardWheelPresentationEnhancer />
      {salarReady ? (
        <>
          <SalarWidget />
          <SalarInteractionEnhancer />
          <SalarOrderCustomizationBridge />
          <SalarOrderFeedbackBridge />
        </>
      ) : null}
      <style jsx global>{`
        #salar-viewport-shell > div:has(button[aria-label="Close Salar"]) {
          position: fixed !important;
          top: var(--salar-viewport-top) !important;
          right: 0 !important;
          bottom: auto !important;
          left: 0 !important;
          z-index: 80 !important;
          display: flex !important;
          height: var(--salar-viewport-height) !important;
          align-items: flex-end !important;
          justify-content: flex-end !important;
          padding: 8px !important;
          pointer-events: none !important;
        }

        #salar-viewport-shell > div:has(button[aria-label="Close Salar"]) > div {
          pointer-events: auto !important;
          max-height: calc(var(--salar-viewport-height) - 16px) !important;
        }

        #salar-viewport-shell > div:has(button[aria-label="Open full chat"]) > div {
          width: min(390px, calc(100vw - 16px)) !important;
          height: min(620px, calc(var(--salar-viewport-height) - 16px)) !important;
        }

        #salar-viewport-shell > div:has(button[aria-label="Make chat smaller"]) {
          padding: 0 !important;
        }

        #salar-viewport-shell > div:has(button[aria-label="Make chat smaller"]) > div {
          width: 100vw !important;
          height: var(--salar-viewport-height) !important;
          max-height: var(--salar-viewport-height) !important;
          border-radius: 0 !important;
        }

        /* Collapsed Salar stays a simple profile-style floating avatar. */
        #salar-viewport-shell > div:not(:has(button[aria-label="Close Salar"])) > div {
          gap: 0 !important;
        }
        #salar-viewport-shell > div:not(:has(button[aria-label="Close Salar"])) > div > span {
          display: none !important;
        }
        #salar-viewport-shell > div:not(:has(button[aria-label="Close Salar"])) > div > button {
          width: 60px !important;
          height: 60px !important;
          padding: 4px !important;
          gap: 0 !important;
          border: 3px solid #fff !important;
          border-radius: 9999px !important;
          background: #14140f !important;
          box-shadow: 0 10px 28px rgba(20,20,15,.28) !important;
        }
        #salar-viewport-shell > div:not(:has(button[aria-label="Close Salar"])) > div > button > span:first-child {
          width: 46px !important;
          height: 46px !important;
          flex: 0 0 46px !important;
          border-radius: 9999px !important;
        }
        #salar-viewport-shell > div:not(:has(button[aria-label="Close Salar"])) > div > button > span:last-child {
          display: none !important;
        }

        @media (min-width: 640px) {
          #salar-viewport-shell > div:has(button[aria-label="Open full chat"]) {
            padding: 20px !important;
          }
          #salar-viewport-shell > div:has(button[aria-label="Open full chat"]) > div {
            max-height: calc(var(--salar-viewport-height) - 40px) !important;
          }
          #salar-viewport-shell > div:not(:has(button[aria-label="Close Salar"])) > div > button {
            width: 64px !important;
            height: 64px !important;
          }
          #salar-viewport-shell > div:not(:has(button[aria-label="Close Salar"])) > div > button > span:first-child {
            width: 50px !important;
            height: 50px !important;
            flex-basis: 50px !important;
          }
        }
      `}</style>
    </div>
  );
}
