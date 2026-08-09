'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // PWA support is progressive; a registration failure must never
      // affect the shopping experience.
    });
  }, []);

  return null;
}
