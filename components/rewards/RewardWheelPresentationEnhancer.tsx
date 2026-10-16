'use client';

import { useEffect } from 'react';

function decorateSalarLauncher() {
  const root = document.getElementById('salar-viewport-shell');
  if (!root || root.querySelector('button[aria-label="Close Salar"]')) return;
  const label = root.querySelector<HTMLElement>(':scope > div > div > span');
  if (!label || label.textContent?.trim() !== 'Need help?') return;

  label.style.setProperty('display', 'block', 'important');
  label.style.setProperty('margin-right', '5px', 'important');
  label.style.setProperty('padding', '5px 10px', 'important');
  label.style.setProperty('border', '1px solid rgba(20,20,15,.08)', 'important');
  label.style.setProperty('border-radius', '999px', 'important');
  label.style.setProperty('background', '#fffdf8', 'important');
  label.style.setProperty('color', '#14140f', 'important');
  label.style.setProperty('font-size', '10px', 'important');
  label.style.setProperty('font-weight', '900', 'important');
  label.style.setProperty('box-shadow', '0 5px 16px rgba(20,20,15,.13)', 'important');
}

function decoratePresentation() {
  decorateSalarLauncher();
  // This legacy presentation enhancer used to inject two hard-coded WhatsApp
  // buttons below the Salar header. The live SalarWidget now renders ONLY
  // enabled contacts from Admin Panel settings. Clear any old injected row
  // left behind by client-side navigation to prevent duplicate contact cards.
  document.querySelectorAll('[data-salar-whatsapp-row="true"]').forEach((row) => row.remove());
}

export default function RewardWheelPresentationEnhancer() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(decoratePresentation);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
