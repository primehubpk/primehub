// lib/useSettings.ts
// Shared live storefront settings reader. The admin panel writes settings/main,
// while this hook also tolerates older announcement field names so a previously
// saved admin announcement never silently disappears from the header.

'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SiteSettings } from '@/lib/types';

const DEFAULT_SETTINGS: SiteSettings = {
  announcementText: 'PrimeHub Deals',
  whatsappNumber: '923001234567',
  freeShippingCount: 5,
  heroTitle: 'Flash Sale',
  heroDiscountText: 'Up to 70% Off',
  heroCountdownEndTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
  heroImageUrl: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?q=80&w=1200&auto=format&fit=crop',
  heroButtonText: "Shop Today's Deal",
  heroButtonLink: '#',
  dailyDeal: { productId: '', imageUrl: '', title: '', originalPrice: 0, dealPrice: 0, startAt: '', endAt: '', buttonText: 'Shop Deal', buttonLink: '#', active: false },
  youtubeGuide: { enabled: true, title: 'How To Order & List Products on PrimeHub Deals', videoId: 'dQw4w9WgXcQ', description: 'Watch this quick guide to learn how to order and list products on PrimeHub Deals.' },
  policies: {
    privacyPolicy: { title: 'Privacy Policy', content: 'This page explains how PrimeHub Deals handles customer information and order-related data.' },
    terms: { title: 'Terms of Service', content: 'By using PrimeHub Deals, you agree to use the website for lawful shopping and communication.' },
    returnPolicy: { title: 'Return Policy', content: 'Please contact the PrimeHub Deals team for return or order assistance.' },
  },
  weeklyDeals: [],
  freeDelivery: { enabled: true, itemThreshold: 5, message: 'Add {remaining} more item{plural} to unlock FREE DELIVERY', unlockedMessage: 'FREE DELIVERY UNLOCKED 🎉' },
  priceBuckets: [
    { id: 'under-99', title: 'Under 99', amount: 99, iconUrl: '', accent: '#E1352B', sortOrder: 1, active: true },
    { id: 'under-300', title: 'Under 300', amount: 300, iconUrl: '', accent: '#0F6A5F', sortOrder: 2, active: true },
    { id: 'under-500', title: 'Under 500', amount: 500, iconUrl: '', accent: '#FFB020', sortOrder: 3, active: true },
    { id: 'under-1000', title: 'Under 1000', amount: 1000, iconUrl: '', accent: '#14140F', sortOrder: 4, active: true },
  ],
};

type RawSettings = Partial<SiteSettings> & Record<string, unknown>;

function resolveAnnouncement(data: RawSettings): string {
  const candidates = [
    data.announcementText,
    data.topAnnouncement,
    data.topAnnouncementText,
    data.announcement,
    data.announcementBarText,
  ];
  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return typeof match === 'string' ? match.trim() : DEFAULT_SETTINGS.announcementText;
}

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'main'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as RawSettings;
          setSettings({ ...DEFAULT_SETTINGS, ...data, announcementText: resolveAnnouncement(data) });
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  return { settings, loading };
}
