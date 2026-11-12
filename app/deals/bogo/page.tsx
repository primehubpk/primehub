import Header from '@/components/home/HomeHeader';
import BogoDeals from '@/components/home/BogoDeals';
import { SettingsProvider } from '@/lib/useSettings';
import { compactPublicCatalogSnapshot, getPublicCatalogSnapshot, getStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import '@/components/home/home.css';

export const revalidate = 300;
export const metadata = { title: 'Buy 1 Get 1 Free | PrimeHubMall', description: 'Daily double delights. Choose a design and size: one paid pack plus one identical free pack. Renews daily, while stocks last.' };
export default async function BogoPage() {
  const [catalog, settingsResult] = await Promise.allSettled([getPublicCatalogSnapshot(), getStorefrontSettingsSnapshot()]);
  const snapshot = catalog.status === 'fulfilled' ? compactPublicCatalogSnapshot(catalog.value) : { products: [], categories: [] };
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : {};
  return <SettingsProvider initialSettings={settings}><div className="home-storefront"><Header categories={snapshot.categories}/><main><BogoDeals products={snapshot.products} landing/></main></div></SettingsProvider>;
}
