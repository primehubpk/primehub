// lib/useSettings.ts
// Shared storefront settings reader. Phase 4 routes reads through the server-side dual backend layer.
'use client';

import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SiteSettings } from '@/lib/types';
import { bigDealConfiguredSlotCount, bigDealRotationIndex } from '@/lib/bigDealRotation';

const DEFAULT_SETTINGS: SiteSettings = {
  announcementText: 'PrimeHub Deals', whatsappNumber: '', freeShippingCount: 5,
  heroTitle: 'Flash Sale', heroDiscountText: 'Up to 70% Off', heroCountdownEndTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
  heroImageUrl: '', heroButtonText: "Shop Today's Deal", heroButtonLink: '#',
  dailyDeal: { productId: '', productIds: [], imageUrl: '', imageUrls: [], titles: [], categoryIds: [], originalPrices: [], dealPrices: [], rotationStartedAt: '', title: '', originalPrice: 0, dealPrice: 0, startAt: '', endAt: '', buttonText: 'View Big Deal', buttonLink: '/deals/big', active: false },
  youtubeGuide: { enabled: true, title: 'How To Order & List Products on PrimeHub Deals', videoId: 'dQw4w9WgXcQ', description: 'Watch this quick guide to order and list products on PrimeHub Deals.' },
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

  const images = Array.isArray(dailyDeal.imageUrls) ? dailyDeal.imageUrls.map((value: unknown) => String(value || '').trim()).slice(0, 7) : [];
  const productIds = Array.isArray(dailyDeal.productIds) ? dailyDeal.productIds.map((value: unknown) => String(value || '').trim()).slice(0, 7) : [];
  const titles = Array.isArray(dailyDeal.titles) ? dailyDeal.titles.map((value: unknown) => String(value || '').trim()).slice(0, 7) : [];
  const originalPrices = Array.isArray(dailyDeal.originalPrices) ? dailyDeal.originalPrices.slice(0, 7) : [];
  const dealPrices = Array.isArray(dailyDeal.dealPrices) ? dailyDeal.dealPrices.slice(0, 7) : [];
  if (!images.length && !productIds.length && !titles.length && !originalPrices.length && !dealPrices.length) return settings;

  const slotCount = bigDealConfiguredSlotCount(dailyDeal);
  const index = bigDealRotationIndex(String(dailyDeal.rotationStartedAt || ''), new Date(), slotCount);
  const imageUrl = images[index] || dailyDeal.imageUrl || images[0] || '';
  const productId = productIds[index] || dailyDeal.productId || productIds[0] || '';
  const title = titles[index] || dailyDeal.title || titles[0] || '';
  const originalPrice = Number(originalPrices[index] ?? dailyDeal.originalPrice ?? 0);
  const dealPrice = Number(dealPrices[index] ?? dailyDeal.dealPrice ?? 0);

  return {
    ...settings,
    dailyDeal: {
      ...dailyDeal,
      imageUrl,
      productId,
      title,
      originalPrice: Number.isFinite(originalPrice) ? originalPrice : Number(dailyDeal.originalPrice || 0),
      dealPrice: Number.isFinite(dealPrice) ? dealPrice : Number(dailyDeal.dealPrice || 0),
    },
  };
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

const SettingsSeedContext = createContext<SiteSettings | null>(null);

export function SettingsProvider({ initialSettings, children }: { initialSettings?: Partial<SiteSettings>; children: ReactNode }) {
  const seed = useMemo(
    () => buildSettings(initialSettings && Object.keys(initialSettings).length > 0 ? { main: initialSettings } : {}),
    [initialSettings],
  );

  return createElement(SettingsSeedContext.Provider, { value: seed }, children);
}

export function useSettings() {
  const seededSettings = useContext(SettingsSeedContext);
  const [settings, setSettings] = useState<SiteSettings>(() => seededSettings || DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!seededSettings);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/storefront/read?type=settings', { cache: 'no-store' });
        if (!response.ok) throw new Error(`settings read ${response.status}`);
        const data = await response.json();
        const documents = data?.documents || {};
        if (!cancelled && Object.keys(documents).length > 0) setSettings(buildSettings(documents));
      } catch (error) {
        // Keep the server-provided last good settings instead of flashing blank weekly deals.
        console.warn('storefront settings dual read unavailable', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const resolvedSettings = resolveRotatingBigDeal(settings) as SiteSettings;
  return { settings: resolvedSettings, loading, policy: resolvedSettings.policies, contact: resolvedSettings.contact };
}
