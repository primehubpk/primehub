// lib/useSettings.ts
// Shared live storefront settings reader. The admin panel writes settings/main.
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SiteSettings } from '@/lib/types';

const DEFAULT_SETTINGS: SiteSettings = {
  announcementText: 'PrimeHub Deals', whatsappNumber: '923001234567', freeShippingCount: 5,
  heroTitle: 'Flash Sale', heroDiscountText: 'Up to 70% Off', heroCountdownEndTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
  heroImageUrl: '', heroButtonText: "Shop Today's Deal", heroButtonLink: '#',
  dailyDeal: { productId: '', imageUrl: '', title: '', originalPrice: 0, dealPrice: 0, startAt: '', endAt: '', buttonText: 'Shop Deal', buttonLink: '#', active: false },
  youtubeGuide: { enabled: true, title: 'How To Order & List Products on PrimeHub Deals', videoId: 'dQw4w9WgXcQ', description: 'Watch this quick guide to learn how to order and list products on PrimeHub Deals.' },
  policies: { privacyPolicy: { title: 'Privacy Policy', content: '' }, terms: { title: 'Terms of Service', content: '' }, returnPolicy: { title: 'Return Policy', content: '' } },
  weeklyDeals: [],
  freeDelivery: { enabled: true, itemThreshold: 5, message: 'Add {remaining} more item{plural} to unlock FREE DELIVERY', unlockedMessage: 'FREE DELIVERY UNLOCKED 🎉' },
  priceBuckets: [
    { id: 'under-99', title: 'Under 99', amount: 99, iconUrl: '', accent: '#E1352B', sortOrder: 1, active: true },
    { id: 'under-300', title: 'Under 300', amount: 300, iconUrl: '', accent: '#0F6A5F', sortOrder: 2, active: true },
    { id: 'under-500', title: 'Under 500', amount: 500, iconUrl: '', accent: '#FFB020', sortOrder: 3, active: true },
    { id: 'under-1000', title: 'Under 1000', amount: 1000, iconUrl: '', accent: '#14140F', sortOrder: 4, active: true },
  ],
};

type RawSettings = Partial<SiteSettings> & Record<string, any>;

function resolveAnnouncement(mainData: RawSettings, legacyData?: RawSettings): string {
  const candidates = [mainData.announcementText, mainData.topAnnouncement, mainData.topAnnouncementText, mainData.announcement, mainData.announcementBarText, legacyData?.announcementText, legacyData?.topAnnouncement, legacyData?.topAnnouncementText, legacyData?.announcement, legacyData?.announcementBarText];
  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return typeof match === 'string' ? match.trim() : DEFAULT_SETTINGS.announcementText;
}

function currentPakistanDay() {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase();
}

function resolveTodayDeal(mainData: RawSettings) {
  const weeklyDeals = Array.isArray(mainData.weeklyDeals) ? mainData.weeklyDeals : [];
  const today = currentPakistanDay();
  const scheduled = weeklyDeals.find((deal: any) => deal.day === today && deal.active !== false && Number(deal.dealPrice) > 0);
  if (!scheduled) return mainData.dailyDeal ?? DEFAULT_SETTINGS.dailyDeal;
  return { ...scheduled, active: true, startAt: scheduled.startAt || '', endAt: scheduled.endAt || '' };
}

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mainData: RawSettings = {}; let legacyData: RawSettings = {}; let mainReady = false;
    const publish = () => {
      const merged: RawSettings = { ...DEFAULT_SETTINGS, ...legacyData, ...mainData };
      const resolved = { ...merged, announcementText: resolveAnnouncement(mainData, legacyData), dailyDeal: resolveTodayDeal(mainData) } as SiteSettings;
      setSettings(resolved); if (mainReady) setLoading(false);
    };
    const unsubscribeMain = onSnapshot(doc(db, 'settings', 'main'), (snap) => { mainReady = true; mainData = snap.exists() ? (snap.data() as RawSettings) : {}; publish(); }, () => { mainReady = true; publish(); });
    const unsubscribeLegacy = onSnapshot(doc(db, 'settings', 'general'), (snap) => { legacyData = snap.exists() ? (snap.data() as RawSettings) : {}; publish(); }, () => publish());
    return () => { unsubscribeMain(); unsubscribeLegacy(); };
  }, []);
  return { settings, loading };
}
