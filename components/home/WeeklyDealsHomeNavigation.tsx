'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps the existing Weekly Deals home cards visually and functionally intact,
 * but sends a normal product-card click to the existing Weekly Deals page.
 * Add-to-cart buttons are outside .home-week-link and remain untouched.
 */
export default function WeeklyDealsHomeNavigation() {
  const router = useRouter();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const link = target?.closest('.home-week-link') as HTMLAnchorElement | null;
      if (!link) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      router.push('/weekly-deals');
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [router]);

  return null;
}
