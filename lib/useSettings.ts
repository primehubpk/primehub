// lib/useSettings.ts
// Shared storefront settings reader. Phase 4 routes reads through the server-side dual backend layer.
'use client';

import { useEffect, useState } from 'react';
import { SiteSettings } from '@/lib/types';

const DEFAULT_SETTINGS: SiteSettings = {
  announcementText: 'PrimeHub Deals', whatsappNumber: '', freeShippingCount: 5,
  heroTitle: 'Flash Sale', heroDiscountText: 'Up to 70% Off', heroCountdownEndTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
  heroImageUrl: '', heroButtonText: "Shop Today's Deal", heroButtonLink: '#',
  dailyDeal: { productId: '', imageUrl: '', imageUrls: [], title: '', originalPrice: 0, dealPrice: 0, startAt: '', endAt: '', buttonText: 'View Big Deal', buttonLink: '/deals/big', active: false },
  youtubeGuide: { enabled: true, title: 'How To Order & List Products on PrimeHub Deals', videoId: 'dQw4w9WgXcQ', description: 'Watch this quick guide to learn how to order and list products on PrimeHub Deals.' },
  policies: { privacyPolicy: { title: 'Privacy Policy', content: '' }, terms: { title: 'Terms of Service', content: '' }, returnPolicy: { title: 'Return Policy', content: '' } },
  contact: { whatsappNumber: '', email: '', physicalAddress: '' },
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
type RawPolicy = { privacyPolicy?: string; returnPolicy?: string; terms?: string } & Record<string, any>;
type RawContact = { whatsappNumber?: string; email?: string; physicalAddress?: string } & Record<string, any>;

function resolveAnnouncement(mainData: RawSettings, legacyData?: RawSettings): string {
  const candidates = [mainData.announcementText, mainData.topAnnouncement, mainData.topAnnouncementText, mainData.announcement, mainData.announcementBarText, legacyData?.announcementText, legacyData?.topAnnouncement, legacyData?.topAnnouncementText, legacyData?.announcement, legacyData?.announcementBarText];
  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return typeof match === 'string' ? match.trim() : DEFAULT_SETTINGS.announcementText;
}

function resolveRotatingBigDeal(settings: RawSettings): RawSettings {
  const dailyDeal = settings.dailyDeal;
  if (!dailyDeal) return settings;
  const images = Array.isArray(dailyDeal.imageUrls) ? dailyDeal.imageUrls.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())) : [];
  if (!images.length) return settings;
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase();
  const index = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weekday);
  const imageUrl = images[index >= 0 ? index % images.length : 0] || dailyDeal.imageUrl || images[0];
  return { ...settings, dailyDeal: { ...dailyDeal, imageUrl } };
}

function buildSettings(documents: Record<string, any>): SiteSettings {
  const mainData = (documents.main || {}) as RawSettings;
  const legacyData = (documents.general || {}) as RawSettings;
  const policyData = (documents.policy || {}) as RawPolicy;
  const contactData = (documents.contact || {}) as RawContact;
  const merged: RawSettings = resolveRotatingBigDeal({ ...DEFAULT_SETTINGS, ...legacyData, ...mainData });
  const mainWhatsApp = typeof mainData.whatsappNumber === 'string' ? mainData.whatsappNumber : '';
  const contactWhatsApp = typeof contactData.whatsappNumber === 'string' ? contactData.whatsappNumber : '';
  const privacyPolicy = typeof policyData.privacyPolicy === 'string' ? policyData.privacyPolicy : DEFAULT_SETTINGS.policies?.privacyPolicy?.content || '';
  const returnPolicy = typeof policyData.returnPolicy === 'string' ? policyData.returnPolicy : DEFAULT_SETTINGS.policies?.returnPolicy?.content || '';

  return {
    ...merged,
    announcementText: resolveAnnouncement(mainData, legacyData),
    whatsappNumber: contactWhatsApp || mainWhatsApp || DEFAULT_SETTINGS.whatsappNumber,
    contact: {
      whatsappNumber: contactWhatsApp || mainWhatsApp || '',
      email: typeof contactData.email === 'string' ? contactData.email : '',
      physicalAddress: typeof contactData.physicalAddress === 'string' ? contactData.physicalAddress : '',
    },
    policies: {
      ...DEFAULT_SETTINGS.policies,
      ...(merged.policies || {}),
      privacyPolicy: { title: 'Privacy Policy', content: privacyPolicy },
      returnPolicy: { title: 'Return Policy', content: returnPolicy },
    },
  } as SiteSettings;
}

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/storefront/read?type=settings', { cache: 'no-store' });
        if (!response.ok) throw new Error(`settings read ${response.status}`);
        const data = await response.json();
        if (!cancelled) setSettings(buildSettings(data?.documents || {}));
      } catch (error) {
        console.warn('storefront settings dual read unavailable', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  return { settings, loading, policy: settings.policies, contact: settings.contact };
}
