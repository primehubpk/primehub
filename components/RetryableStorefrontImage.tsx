'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useRef, useState } from 'react';

type Props = Omit<ImageProps, 'src' | 'alt'> & {
  src: string;
  alt: string;
  fallbackSrcs?: string[];
};

export default function RetryableStorefrontImage({
  src,
  alt,
  fallbackSrcs = [],
  ...props
}: Props) {
  const sources = Array.from(
    new Set(
      [src, ...fallbackSrcs]
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
  const sourceKey = sources.join('\n');
  const [sourceIndex, setSourceIndex] = useState(0);
  const [retry, setRetry] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exhausted = retry >= 2 || sources.length === 0;
  const currentSrc = sources[Math.min(sourceIndex, Math.max(0, sources.length - 1))] || '';

  useEffect(() => {
    setSourceIndex(0);
    setRetry(0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [sourceKey]);

  useEffect(() => {
    if (!exhausted) return;

    const recover = () => {
      if (!navigator.onLine || document.visibilityState === 'hidden') return;
      setSourceIndex(0);
      setRetry(0);
    };

    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [exhausted, sourceKey]);

  if (!currentSrc || exhausted) {
    return (
      <span
        role="img"
        aria-label={`${alt} image unavailable`}
        className="flex h-full w-full items-center justify-center bg-[#F4F4F1] px-3 text-center text-xs text-black/40"
      >
        Image unavailable
      </span>
    );
  }

  return (
    <Image
      {...props}
      key={`${currentSrc}:${retry}`}
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (timer.current) clearTimeout(timer.current);

        // If a product has another stored image, switch immediately instead of
        // requesting a known-bad cover twice. This is the cheapest recovery path.
        if (sourceIndex + 1 < sources.length) {
          setSourceIndex((index) => index + 1);
          setRetry(0);
          return;
        }

        // A product with no remaining fallback gets one delayed retry for a brief
        // radio/CDN hiccup. Reuse the exact URL so the browser/CDN cache can help.
        if (retry === 0) {
          timer.current = setTimeout(() => setRetry(1), 700);
          return;
        }

        setRetry(2);
      }}
    />
  );
}
