import HomePageClient from '@/components/HomePageClient';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { compactPublicCatalogSnapshot, getPrimeSkillsSnapshot, getPublicCatalogSnapshot, getStorefrontSettingsResultSnapshot } from '@/lib/publicCatalogServer';
import { getCachedWholesaleVideosSnapshot } from '@/lib/wholesaleVideosServer';
import { pakistanNowWeekday } from '@/lib/weeklyDealUtils';
import type { Category, SiteSettings } from '@/lib/types';
import type { Product } from '@/components/shop/ShopTypes';

// Admin changes invalidate catalog/settings; the unified collection is open every day.
// The catalog snapshots remain cached independently. Only the HTML ordering is
// per request, so the first visible product never flashes an old static rail.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const requestCookies = await cookies();
  const previousFirst: Record<string, string> = {};
  for (const entry of requestCookies.getAll()) {
    if (!entry.name.startsWith('ph-vis-')) continue;
    try {
      const name = decodeURIComponent(entry.name.slice('ph-vis-'.length));
      const id = decodeURIComponent(entry.value);
      if (name.length < 100 && id.length < 100) previousFirst[name] = id;
    } catch { /* Ignore malformed non-sensitive display cookies. */ }
  }
  const visitSeed = randomBytes(4).readUInt32LE(0);
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
        visitSeed={visitSeed}
        previousFirst={previousFirst}
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
