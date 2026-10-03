'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent, ReactNode } from 'react';
import { scrollHomeToTop } from '@/lib/homeKeep';
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

  const goHome = () => {
    const action = requestStorefrontHome();
    if (action === 'scroll-top') {
      scrollHomeToTop();
      return;
    }
    if (action === 'overlay-home' || action === 'pushed-home') return;
    const target = '/';
    router.push(target, { scroll: false });

  };

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || !plainPointer(event)) return;
    event.preventDefault();
    goHome();
  };

  return (
    <Link href="/" prefetch={false} className={className} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </Link>
  );
}
