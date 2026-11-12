'use client';

import { useEffect, useRef, type RefObject } from 'react';

type Options = {
  enabled?: boolean;
  speed?: number;
  resumeAfterMs?: number;
  itemCount?: number;
};

/**
 * Native, swipe-friendly infinite horizontal scrolling shared by home rails.
 * Start when the rail enters the viewport, never while offscreen.
 * Finger/mouse dragging wins over autoplay; only resume after 6s idle.
 */
export function useContinuousHomeRail(
  railRef: RefObject<HTMLElement | null>,
  { enabled = true, speed = 24, resumeAfterMs = 6000, itemCount = 0 }: Options = {},
) {
  const pauseRef = useRef<() => void>(() => {});

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !enabled || itemCount < 2 || typeof window === 'undefined') return;

    const original = rail.querySelector<HTMLElement>('[data-loop-original]');
    const copy = rail.querySelector<HTMLElement>('[data-loop-copy]');
    if (!original || !copy) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let hasEnteredViewport = false;
    let pointerHolding = false;
    let touchHolding = false;
    let pausedUntil = 0;
    let frame = 0;
    let lastFrame = 0;

    const pause = () => {
      pausedUntil = performance.now() + resumeAfterMs;
    };
    pauseRef.current = pause;

    // Pointer events work on both desktop and mobile. Keep a separate touch
    // guard because mobile browsers can fire pointercancel during a swipe.
    const onPointerDown = () => { pointerHolding = true; pause(); };
    const onPointerMove = () => { pause(); };
    const onPointerUp = () => {
      if (pointerHolding) {
        pointerHolding = false;
        pause();
      }
    };
    const onTouchStart = () => { touchHolding = true; pause(); };
    const onTouchMove = () => { pause(); };
    const onTouchEnd = () => {
      if (touchHolding) {
        touchHolding = false;
        pause();
      }
    };

    function tick(time: number) {
      if (!visible) { frame = 0; return; }

      const delta = Math.min((time - (lastFrame || time)) / 1000, 0.05);
      lastFrame = time;
      const loopLength = copy!.offsetLeft - original!.offsetLeft;
      if (!reducedMotion.matches &&
          document.visibilityState === 'visible' &&
          !pointerHolding && !touchHolding &&
          time >= pausedUntil &&
          loopLength > rail!.clientWidth + 4) {
        const next = rail!.scrollLeft + speed * delta;
        rail!.scrollLeft = next >= loopLength ? next - loopLength : next;
      }
      frame = window.requestAnimationFrame(tick);
    }

    const onIntersection = (entries: IntersectionObserverEntry[]) => {
      const nextVisible = Boolean(entries[0]?.isIntersecting);
      if (nextVisible && !visible) {
        visible = true;
        if (!hasEnteredViewport) {
          // Prevent offscreen animation / scroll restoration leaving half of
          // the first product visible on the customer's first visit.
          rail.scrollLeft = 0;
          hasEnteredViewport = true;
        }
        lastFrame = 0;
        frame = window.requestAnimationFrame(tick);
      } else if (!nextVisible && visible) {
        visible = false;
        window.cancelAnimationFrame(frame);
        frame = 0;
        lastFrame = 0;
      }
    };

    rail.addEventListener('pointerdown', onPointerDown, { passive: true });
    rail.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    rail.addEventListener('touchstart', onTouchStart, { passive: true });
    rail.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    rail.addEventListener('click', pause, { passive: true });
    rail.addEventListener('wheel', pause, { passive: true });
    rail.addEventListener('keydown', pause);
    rail.addEventListener('focusin', pause);

    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(onIntersection, {
          threshold: 0.02,
          rootMargin: '0px 0px -5% 0px',
        })
      : null;

    if (observer) observer.observe(rail);
    else {
      // Browser compatibility fallback, no automatic delay.
      visible = true;
      frame = window.requestAnimationFrame(tick);
    }

    return () => {
      visible = false;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      rail.removeEventListener('pointerdown', onPointerDown);
      rail.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      rail.removeEventListener('touchstart', onTouchStart);
      rail.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      rail.removeEventListener('click', pause);
      rail.removeEventListener('wheel', pause);
      rail.removeEventListener('keydown', pause);
      rail.removeEventListener('focusin', pause);
      pauseRef.current = () => {};
    };
  }, [railRef, enabled, speed, resumeAfterMs, itemCount]);

  return pauseRef;
}
