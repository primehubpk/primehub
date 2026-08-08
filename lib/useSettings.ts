// lib/useSettings.ts
// Small shared hook so every storefront component (Header, HeroFlashBanner,
// ProductGrid, etc.) can read the live `settings/main` Firestore document
// without each one duplicating its own listener + fallback logic.

'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SiteSettings } from '@/lib/types';

// Fallback values used until Firestore responds, or if the settings
// document hasn't been created yet from the admin panel.
const DEFAULT_SETTINGS: SiteSettings = {
  announcementText:
    'Worldwide delivery available | Apni product hamain WhatsApp send karein, aapki product apni website pe live karenge aur duniya bhar se order hasil karein!',
  whatsappNumber: '923001234567',
  freeShippingCount: 8,
  heroTitle: 'Flash Sale',
  heroDiscountText: 'Up to 70% Off',
  heroCountdownEndTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
};

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'main'), (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<SiteSettings>) });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { settings, loading };
}
