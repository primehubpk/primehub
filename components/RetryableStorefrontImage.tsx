'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useRef, useState } from 'react';

function retryUrl(src: string) {
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}ph_image_retry=1`;
}

export default function RetryableStorefrontImage({ src, alt, ...props }: Omit<ImageProps, 'src' | 'alt'> & { src: string; alt: string }) {
  const [retry, setRetry] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRetry(0);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [src]);

  return retry < 2 ? <Image
    {...props}
    key={`${src}:${retry}`}
    src={retry === 1 ? retryUrl(src) : src}
    alt={alt}
    onError={() => {
      if (timer.current) clearTimeout(timer.current);
      if (retry === 0) timer.current = setTimeout(() => setRetry(1), 700);
      else setRetry(2);
    }}
  /> : <span role="img" aria-label={`${alt} image unavailable`} className="flex h-full w-full items-center justify-center bg-[#F4F4F1] px-3 text-center text-xs text-black/40">Image unavailable</span>;
}
