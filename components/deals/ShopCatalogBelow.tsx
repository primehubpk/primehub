'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useRef, useState } from 'react';

const ShopLandingCatalog = dynamic(() => import('@/components/shop/ShopLandingCatalog'), { ssr: false });

export default function ShopCatalogBelow() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '500px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <section ref={sectionRef} className="mx-auto max-w-6xl border-t border-[#DCCCA8]/60 pt-8" aria-label="Shop all products">
    <div className="px-4"><p className="text-[10px] font-black uppercase tracking-widest text-[#A26D13]">Keep exploring</p><h2 className="mt-1 text-2xl font-black">Shop all products</h2></div>
    {visible ? <Suspense fallback={null}><ShopLandingCatalog /></Suspense> : <div className="h-40" aria-hidden="true" />}
  </section>;
}
