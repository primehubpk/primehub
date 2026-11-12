import HomePageClient from '@/components/HomePageClient';
import { compactPublicCatalogSnapshot, getPrimeSkillsSnapshot, getPublicCatalogSnapshot, getStorefrontSettingsResultSnapshot } from '@/lib/publicCatalogServer';
import { getCachedWholesaleVideosSnapshot } from '@/lib/wholesaleVideosServer';
import { pakistanNowWeekday } from '@/lib/weeklyDealUtils';
import type { Category, SiteSettings } from '@/lib/types';
import type { Product } from '@/components/shop/ShopTypes';

// Admin changes invalidate catalog/settings; the unified collection is open every day.
export const revalidate = 21600;

export default async function HomePage() {
  const [catalogResult, settingsResult, wholesaleResult, skillsResult] = await Promise.allSettled([
    getPublicCatalogSnapshot(),
    getStorefrontSettingsResultSnapshot(),
    getCachedWholesaleVideosSnapshot(),
    getPrimeSkillsSnapshot(),
  ]);

  const snapshot = catalogResult.status === 'fulfilled'
    ? compactPublicCatalogSnapshot(catalogResult.value)
    : { products: [], categories: [] };
  const settingsDocuments = settingsResult.status === 'fulfilled'
    ? (settingsResult.value.documents as Record<string, any>)
    : {};
  const rawSettings = {
    ...(settingsDocuments.general || {}),
    ...(settingsDocuments.main || {}),
  };
  const rewardSettings = settingsDocuments.rewards || {};
  const wholesaleVideos = wholesaleResult.status === 'fulfilled'
    ? wholesaleResult.value.videos
    : [];
  const initialSettings: Record<string, any> = {
    ...rawSettings,
    ...(wholesaleVideos.length ? { wholesaleVideos } : {}),
    homeRewardSettings: rewardSettings,
  };
  const initialSkills = skillsResult.status === 'fulfilled'
    ? skillsResult.value.skills
    : [];
  const initialSkillsPage = skillsResult.status === 'fulfilled'
    ? skillsResult.value.skillsPage
    : null;

  const today = pakistanNowWeekday(new Date());

  return (
    <>
      <HomePageClient
        initialProducts={snapshot.products as Product[]}
        initialCategories={snapshot.categories as Category[]}
        initialSettings={initialSettings as Partial<SiteSettings>}
        initialWeekday={today}
        initialSkills={initialSkills}
        initialSkillsPage={initialSkillsPage}
      />
    </>
  );
}
