'use client';

import { useEffect, useRef } from 'react';
import PremiumWheelConfigurator from './PremiumWheelConfigurator';
import RewardsManager from './RewardsManager';

export default function PremiumRewardsManager({ products = [] }: { products?: any[] }) {
  const legacyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = legacyRef.current;
    if (!root) return;

    const keepSingleWheelEditor = () => {
      const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
      const overview = buttons.find(button => button.textContent?.trim() === 'Overview');
      const legacyWheel = buttons.find(button => button.textContent?.trim() === 'Spin Wheel');

      if (!legacyWheel) return;

      // If the old tab was ever selected by a stale client render, return to the
      // overview before hiding it. PremiumWheelConfigurator above is the only
      // wheel editor customers/admins should use now.
      if (legacyWheel.className.includes('bg-white')) overview?.click();
      legacyWheel.style.setProperty('display', 'none', 'important');
      legacyWheel.setAttribute('aria-hidden', 'true');
      legacyWheel.tabIndex = -1;
      legacyWheel.disabled = true;
    };

    keepSingleWheelEditor();
    const observer = new MutationObserver(keepSingleWheelEditor);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <PremiumWheelConfigurator />
      <div ref={legacyRef}>
        <RewardsManager products={products} />
      </div>
    </>
  );
}
