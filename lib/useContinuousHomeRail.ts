'use client';

import { useEffect, useRef, type RefObject } from 'react';

type Options = {
  enabled?: boolean;
  speed?: number;
  resumeAfterMs?: number;
  itemCount?: number;
};

/**
 * Native horizontal scrolling (not transform animation) so the customer can
 * actually swipe/scroll the same rail. A repeated copy allows seamless wraps.
 * All listeners and animation frames are removed when the rail unmounts.
 */
export function useContinuousHomeRail(
  railRef: RefObject<HTMLElement | null>,
  { enabled = true, speed = 24, resumeAfterMs = 5000, itemCount = 0 }: Options = {},
) {
  const pauseRef = useRef<() => void>(() => {});

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !enabled || itemCount < 2 || typeof window === 'undefined') return;

    const original = rail.querySelector<HTMLElement>('[data-loop-original]');
    const copy = rail.querySelector<HTMLElement>('[data-loop-copy]');
    if (!original || !copy) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    let touching = false;
    let pausedUntil = performance.now() + 1700;
    let frame = 0;
    let last = 0;

    const pause = () => { pausedUntil = performance.now() + resumeAfterMs; };
    pauseRef.current = pause;

    const onPointerDown = () => { touching = true; pause(); };
    const onPointerUp = () => { touching = false; pause(); };
    const onClick = () => pause();
    const onWheel = () => pause();
    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => { visible = Boolean(entry?.isIntersecting); }, { threshold: 0.01 })
      : null;

    rail.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    rail.addEventListener('click', onClick, { passive: true });
    rail.addEventListener('wheel', onWheel, { passive: true });
    rail.addEventListener('mouseenter', pause, { passive: true });
    rail.addEventListener('focusin', pause);
    observer?.observe(rail);

    function tick(time: number) {
      const delta = Math.min((time - (last || time)) / 1000, 0.05);
      last = time;
      if (!rail) return;
      const loopLength = copy!.offsetLeft - original!.offsetLeft;
      if (visible && !reducedMotion.matches && document.visibilityState === 'visible'
        && !touching && time >= pausedUntil && loopLength > rail.clientWidth + 4) {
        const next = rail.scrollLeft + speed * delta;
        rail.scrollLeft = next >= loopLength ? next - loopLength : next;
      }
      frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      rail.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      rail.removeEventListener('click', onClick);
      rail.removeEventListener('wheel', onWheel);
      rail.removeEventListener('mouseenter', pause);
      rail.removeEventListener('focusin', pause);
      pauseRef.current = () => {};
    };
  }, [railRef, enabled, speed, resumeAfterMs, itemCount]);

  return pauseRef;
}
