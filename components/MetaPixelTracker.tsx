'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackMetaPageView } from '@/lib/metaPixel';

export default function MetaPixelTracker() {
  const pathname = usePathname();
  useEffect(() => { trackMetaPageView(); }, [pathname]);
  return null;
}
