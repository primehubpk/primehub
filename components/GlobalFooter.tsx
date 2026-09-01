'use client';

import { usePathname } from 'next/navigation';
import Footer from '@/components/Footer';

const PAGES_WITH_OWN_FOOTER = new Set([
  '/',
  '/reseller',
  '/reseller/challenges',
  '/reseller/rewards-preview',
]);

export default function GlobalFooter() {
  const pathname = usePathname();
  if (PAGES_WITH_OWN_FOOTER.has(pathname)) return null;
  return <Footer />;
}
