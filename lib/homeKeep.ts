'use client';

import { useLayoutEffect, useRef, useState } from 'react';

const PARK_ID = 'ph-home-park';
const SCROLL_KEY = 'ph-home-scroll';

let patched = false;

function parkElement() {
  let park = document.getElementById(PARK_ID);
  if (!park) {
    park = document.createElement('div');
    park.id = PARK_ID;
    park.hidden = true;
    document.body.appendChild(park);
  }
  return park;
}

function rememberScroll() {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY || window.pageYOffset || 0));
  } catch {
    // The picture keep still works if the browser blocks storage.
  }
}

export function readKeptHomeScroll() {
  try {
    const value = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

// Home's real node is moved aside when the route changes, instead of being
// destroyed. Coming back paints that same node until the new page is ready,
// so weekly-deal pictures do not blink. No catalog request is added here.
export function installHomeKeep() {
  if (patched || typeof window === 'undefined') return;
  patched = true;

  document.addEventListener('pointerdown', (event) => {
    if (window.location.pathname !== '/') return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    try {
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === '/') return;
    } catch {
      return;
    }
    rememberScroll();
  }, true);

  const original = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    const home = keptHomeInside(child);
    if (home) {
      rememberScroll();
      const park = parkElement();
      park.querySelectorAll('[data-ph-home-root]').forEach((old) => {
        if (!(old instanceof HTMLElement) || old === home) return;
        old.dataset.phRelease = '1';
        old.remove();
      });
      home.querySelectorAll('iframe').forEach((frame) => {
        frame.contentWindow?.postMessage(JSON.stringify({
          event: 'command',
          func: 'pauseVideo',
          args: [],
        }), '*');
      });
      park.hidden = true;
      if (home.parentNode !== park) park.appendChild(home);
      if (child instanceof HTMLElement && child.dataset.phHomeLive === '1') return child;
    }
    return original.call(this, child) as T;
  };
}

function keptHomeInside(child: Node) {
  if (!(child instanceof HTMLElement)) return null;
  const home = child.dataset.phHomeRoot === '1' && child.dataset.phHomeLive === '1'
    ? child
    : child.querySelector('[data-ph-home-live="1"]');
  if (!(home instanceof HTMLElement) || home.dataset.phRelease === '1') return null;
  return home;
}

export function peekKeptHome() {
  if (typeof document === 'undefined') return null;
  const node = document.getElementById(PARK_ID)?.querySelector('[data-ph-home-root]');
  return node instanceof HTMLElement ? node : null;
}

export function releaseKeptHome(node: HTMLElement | null) {
  if (!node) return;
  node.dataset.phRelease = '1';
  node.remove();
}

export function useKeptHomeCover() {
  const frameRef = useRef<HTMLDivElement>(null);
  const keptRef = useRef<HTMLElement | null>(null);
  const [covering, setCovering] = useState(false);

  useLayoutEffect(() => {
    installHomeKeep();
    const frame = frameRef.current;
    if (!frame) return;
    const kept = keptRef.current ?? peekKeptHome();
    if (!kept) return;
    kept.dataset.phHomeLive = '';
    kept.removeAttribute('data-ph-home-live');
    kept.style.position = 'absolute';
    kept.style.top = '0';
    kept.style.left = '0';
    kept.style.width = '100%';
    kept.style.zIndex = '1';
    kept.style.pointerEvents = 'none';
    kept.hidden = false;
    kept.setAttribute('aria-hidden', 'true');
    if (kept.parentNode !== frame) frame.appendChild(kept);
    keptRef.current = kept;
    document.documentElement.dataset.phKeptShown = '1';
    if (!covering) {
      const y = readKeptHomeScroll();
      if (y > 0) window.scrollTo(0, y);
      setCovering(true);
    }
  }, [covering]);

  useLayoutEffect(() => {
    if (!covering) return;
    const frame = frameRef.current;
    const kept = keptRef.current;
    const live = frame?.querySelector<HTMLElement>('[data-ph-home-live]');
    if (!kept || !live) return;

    let finished = false;
    let hardStop = 0;
    let emptyWait = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(hardStop);
      window.clearTimeout(emptyWait);
      const y = window.scrollY || readKeptHomeScroll();
      releaseKeptHome(keptRef.current);
      keptRef.current = null;
      setCovering(false);
      if (y > 0) window.scrollTo(0, y);
    };
    const viewportImages = () => [...live.querySelectorAll('img')].filter((image) => {
      const box = image.getBoundingClientRect();
      return box.width > 8 && box.bottom > 0 && box.top < window.innerHeight + 80;
    });
    const check = () => {
      const images = viewportImages();
      if (images.length > 0 && images.every((image) => image.complete)) finish();
    };
    // Pictures already in memory can be ready before paint. An empty first
    // pass usually means a rail has not mounted yet, so give it a moment.
    if (viewportImages().length > 0 && viewportImages().every((image) => image.complete)) {
      finish();
      return;
    }
    emptyWait = window.setTimeout(() => {
      if (viewportImages().length === 0) finish();
    }, 120);
    hardStop = window.setTimeout(finish, 800);
    live.querySelectorAll('img').forEach((image) => {
      image.addEventListener('load', check);
      image.addEventListener('error', check);
    });
    return () => {
      finished = true;
      window.clearTimeout(hardStop);
      window.clearTimeout(emptyWait);
    };
  }, [covering]);

  return { frameRef, covering };
}
