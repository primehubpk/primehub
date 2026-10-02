'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, type MouseEvent, PointerEvent, ReactNode } from 'react';
import { requestStorefrontHome } from '@/lib/productOverlay';

type Props = {
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
};

function plainPointer(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export default function BackHomeLink({ className, children, ariaLabel }: Props) {
  const router = useRouter();
  const handledRef = useRef(false);

  const goHome = () => {
    const action = requestStorefrontHome();
    if (action === 'scroll-top') {
      window.scrollTo(0, 0);
      return;
    }
    if (action === 'overlay-home' || action === 'pushed-home') return;
    const target = '/';
    router.push(target);
    window.setTimeout(() => {
      if (window.location.pathname !== '/') window.location.assign(target);
    }, 700);
  };

  const onPointerDown = (event: PointerEvent<HTMLAnchorElement>) => {
    if (!plainPointer(event)) return;
    event.preventDefault();
    event.stopPropagation();
    handledRef.current = true;
    goHome();
  };

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (handledRef.current) {
      handledRef.current = false;
      event.preventDefault();
      return;
    }
    if (event.defaultPrevented || !plainPointer(event)) return;
    event.preventDefault();
    goHome();
  };

  return (
    <Link href="/" prefetch={false} className={className} aria-label={ariaLabel} onPointerDown={onPointerDown} onClick={onClick}>
      {children}
    </Link>
  );
}
