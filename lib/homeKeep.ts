'use client';

import { useLayoutEffect, useRef, useState } from 'react';

const SCROLL_KEY = 'ph-home-scroll';
let savedY = 0;
let savedHeight = 0;
let snapshot: HTMLElement | null = null;

export function readKeptHomeScroll() { return savedY; }

export function scrollHomeToTop() {
  savedY = 0;
  try { sessionStorage.setItem(SCROLL_KEY, '0'); } catch {}
  window.dispatchEvent(new Event('ph-home-top'));
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

// Keep only an inert visual snapshot. Never move React-owned nodes or patch
// Node.removeChild: both break router teardown and can leave a footer on screen.
export function useKeptHomeCover() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [covering, setCovering] = useState(false);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const live = frame?.querySelector<HTMLElement>('[data-ph-home-live]');
    if (!frame || !live) return;
    let cover = snapshot;
    snapshot = null;
    let targetY = savedY;
    let timer = 0;
    let observer: ResizeObserver | undefined;
    let leaving = false;
    let loadListener: (() => void) | undefined;

    const finish = () => {
      if (!cover) return;
      cover.remove();
      cover = null;
      frame.style.minHeight = '';
      live.style.opacity = '';
      setCovering(false);
      window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
      observer?.disconnect();
      window.clearTimeout(timer);
    };
    if (cover) {
      cover.setAttribute('aria-hidden', 'true');
      cover.inert = true;
      Object.assign(cover.style, { position: 'absolute', inset: '0 auto auto 0', width: '100%', pointerEvents: 'none', zIndex: '1' });
      frame.style.minHeight = `${savedHeight}px`;
      live.style.opacity = '0';
      frame.appendChild(cover);
      cover.querySelectorAll<HTMLElement>('[data-ph-scroll-left]').forEach(node => {
        node.scrollLeft = Number(node.dataset.phScrollLeft || 0);
      });
      setCovering(true);
      window.scrollTo({ top: targetY, left: 0, behavior: 'instant' });
      const check = () => {
        if (live.offsetHeight < Math.min(savedHeight, targetY + window.innerHeight)) return;
        const visible = [...live.querySelectorAll('img')].filter(image => {
          const box = image.getBoundingClientRect();
          return box.width > 8 && box.bottom > 0 && box.top < window.innerHeight;
        });
        if (visible.every(image => image.complete)) finish();
      };
      observer = new ResizeObserver(check);
      observer.observe(live);
      loadListener = check;
      live.addEventListener('load', check, true);
      timer = window.setTimeout(finish, 800);
      check();
    }
    const capture = (force = false) => {
      if (leaving && !force) return;
      leaving = true;
      savedY = window.scrollY;
      savedHeight = live.offsetHeight;
      snapshot = live.cloneNode(true) as HTMLElement;
      snapshot.style.opacity = '';
      snapshot.removeAttribute('data-ph-home-live');
      const originals = live.querySelectorAll<HTMLElement>('*');
      const copies = snapshot.querySelectorAll<HTMLElement>('*');
      originals.forEach((node, i) => {
        if (node.scrollLeft) copies[i].dataset.phScrollLeft = String(node.scrollLeft);
      });
      // Preserve embed geometry without restarting playback.
      snapshot.querySelectorAll('iframe,script,video').forEach(node => {
        if (node instanceof HTMLElement) node.style.visibility = 'hidden';
        node.removeAttribute('src');
        node.querySelectorAll('source').forEach(source => source.removeAttribute('src'));
      });
    };
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin === location.origin && url.pathname !== '/' && !url.pathname.startsWith('/product/')) capture(true);
    };
    const onTop = () => { targetY = 0; finish(); };
    document.addEventListener('click', onClick, true);
    window.addEventListener('ph-home-top', onTop);
    return () => {
      capture();
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('ph-home-top', onTop);
      observer?.disconnect();
      if (loadListener) live.removeEventListener('load', loadListener, true);
      window.clearTimeout(timer);
      cover?.remove();
    };
  }, []);

  return { frameRef, covering };
}
