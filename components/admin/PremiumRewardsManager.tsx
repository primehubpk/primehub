'use client';

import { useEffect, useRef } from 'react';
import PremiumWheelConfigurator from './PremiumWheelConfigurator';
import RewardsManager from './RewardsManager';

export default function PremiumRewardsManager() {
  const legacyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = legacyRef.current;
    if (!root) return;

    const hideLegacyWheelTab = () => {
      const buttons = Array.from(root.querySelectorAll('button'));
      for (const button of buttons) {
        if (button.textContent?.trim() === 'Spin Wheel') {
          button.hidden = true;
          button.setAttribute('aria-hidden', 'true');
          button.tabIndex = -1;
        }
      }
    };

    hideLegacyWheelTab();
    const observer = new MutationObserver(hideLegacyWheelTab);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <PremiumWheelConfigurator />
      <div ref={legacyRef}>
        <RewardsManager />
      </div>
    </>
  );
}
