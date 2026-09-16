'use client';

import { CSSProperties, useEffect, useState } from 'react';
import SalarWidget from '@/components/salar/SalarWidget';
import SalarInteractionEnhancer from '@/components/salar/SalarInteractionEnhancer';

type VisualBox = { height: number; top: number };

type SalarShellStyle = CSSProperties & {
  '--salar-viewport-height': string;
  '--salar-viewport-top': string;
};

function currentVisualBox(): VisualBox {
  if (typeof window === 'undefined') return { height: 800, top: 0 };
  const viewport = window.visualViewport;
  return {
    height: Math.max(320, Math.round(viewport?.height || window.innerHeight)),
    top: Math.max(0, Math.round(viewport?.offsetTop || 0)),
  };
}

export default function SalarViewportShell() {
  const [visualBox, setVisualBox] = useState<VisualBox>({ height: 800, top: 0 });

  useEffect(() => {
    const update = () => setVisualBox(currentVisualBox());
    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const style: SalarShellStyle = {
    '--salar-viewport-height': `${visualBox.height}px`,
    '--salar-viewport-top': `${visualBox.top}px`,
  };

  return (
    <div id="salar-viewport-shell" style={style}>
      <SalarWidget />
      <SalarInteractionEnhancer />
      <style jsx global>{`
        #salar-viewport-shell > div:has(button[aria-label="Close Salar"]) {
          position: fixed !important;
          top: var(--salar-viewport-top) !important;
          right: 0 !important;
          bottom: auto !important;
          left: 0 !important;
          z-index: 80 !important;
          display: flex !important;
          height: var(--salar-viewport-height) !important;
          align-items: flex-end !important;
          justify-content: flex-end !important;
          padding: 8px !important;
          pointer-events: none !important;
        }

        #salar-viewport-shell > div:has(button[aria-label="Close Salar"]) > div {
          pointer-events: auto !important;
          max-height: calc(var(--salar-viewport-height) - 16px) !important;
        }

        #salar-viewport-shell > div:has(button[aria-label="Open full chat"]) > div {
          width: min(390px, calc(100vw - 16px)) !important;
          height: min(620px, calc(var(--salar-viewport-height) - 16px)) !important;
        }

        #salar-viewport-shell > div:has(button[aria-label="Make chat smaller"]) {
          padding: 0 !important;
        }

        #salar-viewport-shell > div:has(button[aria-label="Make chat smaller"]) > div {
          width: 100vw !important;
          height: var(--salar-viewport-height) !important;
          max-height: var(--salar-viewport-height) !important;
          border-radius: 0 !important;
        }

        @media (min-width: 640px) {
          #salar-viewport-shell > div:has(button[aria-label="Open full chat"]) {
            padding: 20px !important;
          }
          #salar-viewport-shell > div:has(button[aria-label="Open full chat"]) > div {
            max-height: calc(var(--salar-viewport-height) - 40px) !important;
          }
        }
      `}</style>
    </div>
  );
}
