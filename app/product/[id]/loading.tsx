'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { clearReturnPath, closeProductOverlayNow, isProductOverlayOpen, readReturnPath } from '@/lib/productOverlay';

export default function ProductLoading() {
  const router = useRouter();
  const handledRef = useRef(false);
  const goBack = () => {
    if (isProductOverlayOpen()) closeProductOverlayNow();
    if (!window.location.pathname.startsWith('/product/')) return;
    const here = `${window.location.pathname}${window.location.search}`;
    const saved = readReturnPath();
    clearReturnPath();
    const destination = saved && saved.startsWith('/') && !saved.startsWith('/product/') ? saved : '/';
    router.push(destination);
    window.setTimeout(() => {
      const now = `${window.location.pathname}${window.location.search}`;
      if (now === here) window.location.replace(destination);
    }, 450);
  };

  return (
    <main className="fixed inset-0 z-[35] overflow-y-auto bg-[#F4F4F1] px-4 pb-28 pt-4">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          aria-label="Go back"
          className="mb-4 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white shadow-sm"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            handledRef.current = true;
            goBack();
          }}
          onClick={() => {
            if (handledRef.current) {
              handledRef.current = false;
              return;
            }
            goBack();
          }}
        >
          <ArrowLeft size={17} />
        </button>
        <div className="grid gap-4 md:grid-cols-[1.05fr_.95fr]">
          <div className="aspect-square animate-pulse rounded-[30px] bg-white md:aspect-[4/3]" />
          <div className="rounded-[30px] bg-white p-6">
            <div className="h-8 w-4/5 animate-pulse rounded bg-black/8" />
            <div className="mt-5 h-16 w-1/2 animate-pulse rounded bg-black/8" />
            <div className="mt-5 h-28 animate-pulse rounded-2xl bg-black/8" />
          </div>
        </div>
      </div>
    </main>
  );
}
