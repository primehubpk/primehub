'use client';

import type { ChangeEvent, FormEvent } from 'react';
import type { DailyDeal, PriceBucket } from '@/lib/types';

export type Settings = {
  announcementText: string;
  whatsappNumber: string;
  freeDeliveryThreshold: number;
  storePolicyInfo: string;
  priceBuckets: PriceBucket[];
  dailyDeal: DailyDeal;
};

export type SiteSettingsState = {
  settings: Settings;
  loading: boolean;
  saving: boolean;
  uploading: boolean;
  toast: string;
  currentPassword: string;
  newPassword: string;
  showNewPassword: boolean;
  changingPassword: boolean;
};

export type SettingsUpdate = <K extends keyof Settings>(key: K, value: Settings[K]) => void;
export type DailyDealUpdate = (patch: Partial<DailyDeal>) => void;
export type BucketUpdate = (index: number, patch: Partial<PriceBucket>) => void;
export type BucketMove = (index: number, direction: -1 | 1) => void;
export type UploadBigDeal = (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
export type SaveSettings = (event: FormEvent<HTMLFormElement>) => Promise<void>;
export type ChangeAdminPassword = (event: FormEvent<HTMLFormElement>) => Promise<void>;

export const DEFAULT_BUCKETS: PriceBucket[] = [
  { id: 'under-99', title: 'Under 99', amount: 99, iconUrl: '', accent: '#E1352B', sortOrder: 1, active: true },
  { id: 'under-299', title: 'Under 299', amount: 299, iconUrl: '', accent: '#D99A17', sortOrder: 2, active: true },
  { id: 'under-999', title: 'Under 999', amount: 999, iconUrl: '', accent: '#0F6A5F', sortOrder: 3, active: true },
  { id: 'premium', title: 'Premium', amount: 999999, iconUrl: '', accent: '#14140F', sortOrder: 4, active: true },
];

export const DEFAULT_BIG_DEAL: DailyDeal = { productId: '', imageUrl: '', title: '', originalPrice: 0, dealPrice: 0, startAt: '', endAt: '', buttonText: 'Shop Big Deal', buttonLink: '/deals/big', active: false };
export const DEFAULT_SETTINGS: Settings = { announcementText: '', whatsappNumber: '', freeDeliveryThreshold: 5, storePolicyInfo: '', priceBuckets: DEFAULT_BUCKETS, dailyDeal: DEFAULT_BIG_DEAL };
