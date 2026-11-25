'use client';

import dynamic from 'next/dynamic';
import { CSSProperties, useEffect, useState } from 'react';
import RewardWheelPresentationEnhancer from '@/components/rewards/RewardWheelPresentationEnhancer';
import SalarWidget from '@/components/salar/SalarWidget';

const SalarInteractionEnhancer = dynamic(() => import('@/components/salar/SalarInteractionEnhancer'), { ssr: false });
const SalarOrderCustomizationBridge = dynamic(() => import('@/components/salar/SalarOrderCustomizationBridge'), { ssr: false });
const SalarOrderFeedbackBridge = dynamic(() => import('@/components/salar/SalarOrderFeedbackBridge'), { ssr: false });

type VisualBox = { height: number; top: number };

type SalarShellStyle = CSSProperties & {
  '--salar-viewport-height': string;
  '--salar-viewport-top': string;
  '--salar-icon-image': string;
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

export default function SalarViewportShell({ initialIconUrl = '' }: { initialIconUrl?: string }) {
  const [visualBox, setVisualBox] = useState<VisualBox>({ height: 800, top: 0 });
  const [enhancersReady, setEnhancersReady] = useState(false);

  // Drag only the collapsed launcher, not the chat or its controls. Persist a
  // viewport-relative position and clamp it on resize/orientation changes.
  useEffect(() => {
    const shell = document.getElementById('salar-viewport-shell');
    if (!shell) return;
    let position: { x: number; y: number } | null = null;
    try {
      const saved = JSON.parse(localStorage.getItem('ph-salar-launcher-position') || 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) position = saved;
    } catch {}
    let drag: { id: number; button: HTMLButtonElement; x: number; y: number; left: number; top: number; moved: boolean } | null = null;
    let suppressUntil = 0;
    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(min, v), Math.max(min, max));
    const launcher = () => shell.querySelector<HTMLButtonElement>('button[data-salar-draggable]') ||
      Array.from(shell.querySelectorAll<HTMLButtonElement>('button')).find(button =>
        button.textContent?.trim() === 'Salar' && !shell.querySelector('button[aria-label="Close Salar"]'));
    const apply = () => {
      const button = launcher();
      if (!button) return;
      button.dataset.salarDraggable = 'true';
      const wrapper = button.parentElement?.parentElement;
      if (!wrapper) return;
      if (!position) {
        wrapper.classList.toggle('salar-checkout-default', location.pathname === '/checkout');
        return;
      }
      const width = wrapper.offsetWidth || 64, height = wrapper.offsetHeight || 90;
      const x = clamp(position.x * window.innerWidth, 8, window.innerWidth - width - 8);
      const y = clamp(position.y * window.innerHeight, 8, window.innerHeight - height - 80);
      wrapper.style.setProperty('--salar-drag-x', x + 'px');
      wrapper.style.setProperty('--salar-drag-y', y + 'px');
      wrapper.classList.add('salar-user-position');
    };
    const down = (e: PointerEvent) => {
      const button = launcher();
      if (!button || !(e.target instanceof Node) || !button.contains(e.target) || e.button !== 0) return;
      const wrapper = button.parentElement?.parentElement;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      drag = { id: e.pointerId, button, x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };
      button.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 7) return;
      drag.moved = true;
      position = { x: (drag.left + dx) / window.innerWidth, y: (drag.top + dy) / window.innerHeight };
      apply();
    };
    const end = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) {
        suppressUntil = Date.now() + 500;
        try { localStorage.setItem('ph-salar-launcher-position', JSON.stringify(position)); } catch {}
      }
      drag = null;
    };
    const click = (e: MouseEvent) => {
      if (e.detail !== 0 && Date.now() < suppressUntil && (e.target as Element)?.closest?.('button[data-salar-draggable]')) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    };
    const observer = new MutationObserver(apply);
    observer.observe(shell, { childList: true, subtree: true });
    shell.addEventListener('pointerdown', down);
    shell.addEventListener('pointermove', move);
    shell.addEventListener('pointerup', end);
    shell.addEventListener('pointercancel', end);
    shell.addEventListener('click', click, true);
    window.addEventListener('resize', apply);
    apply();
    return () => {
      observer.disconnect();
      shell.removeEventListener('pointerdown', down);
      shell.removeEventListener('pointermove', move);
      shell.removeEventListener('pointerup', end);
      shell.removeEventListener('pointercancel', end);
      shell.removeEventListener('click', click, true);
      window.removeEventListener('resize', apply);
    };
  }, []);

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

    const revealEnhancers = () => {
      if (disposed) return;
      setEnhancersReady(true);
    };

    const schedule = () => {
      if (scheduled || disposed || routeIsStillLoading()) return;
      scheduled = true;
      const requestIdle = (window as any).requestIdleCallback as undefined | ((callback: () => void, options?: { timeout: number }) => number);
      if (typeof requestIdle === 'function') idleId = requestIdle(revealEnhancers, { timeout: 900 });
      else timeoutId = window.setTimeout(revealEnhancers, 250);
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
    '--salar-icon-image': initialIconUrl ? `url(${JSON.stringify(initialIconUrl)})` : 'none',
  };

  return (
    <div id="salar-viewport-shell" className={initialIconUrl ? 'salar-has-initial-icon' : undefined} style={style}>
      <RewardWheelPresentationEnhancer />
      <SalarWidget />
      {enhancersReady ? (
        <>
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

        #salar-viewport-shell button[data-salar-draggable] { touch-action: none; cursor: grab; user-select: none; -webkit-user-drag: none; }
        #salar-viewport-shell button[data-salar-draggable]:active { cursor: grabbing; }
        #salar-viewport-shell > .salar-user-position:not(:has(button[aria-label="Close Salar"])) {
          left: var(--salar-drag-x) !important; top: var(--salar-drag-y) !important; right: auto !important; bottom: auto !important;
        }
        #salar-viewport-shell > .salar-checkout-default:not(.salar-user-position):not(:has(button[aria-label="Close Salar"])) { bottom: calc(225px + env(safe-area-inset-bottom)) !important; }
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
        #salar-viewport-shell.salar-has-initial-icon > div:not(:has(button[aria-label="Close Salar"])) > div > button > span:first-child {
          background-color: #14140f !important;
          background-image: var(--salar-icon-image) !important;
          background-position: center !important;
          background-repeat: no-repeat !important;
          background-size: cover !important;
        }
        #salar-viewport-shell.salar-has-initial-icon > div:not(:has(button[aria-label="Close Salar"])) > div > button > span:first-child > svg {
          display: none !important;
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
