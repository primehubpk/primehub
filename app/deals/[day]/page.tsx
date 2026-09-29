import DayDealPageClient from '@/components/deals/DayDealPageClient';
import ShopCatalogBelow from '@/components/deals/ShopCatalogBelow';

// The seven deal URLs exist at build time; offer status and prices still update
// in the client according to Pakistan time and the current admin settings.
export function generateStaticParams() {
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    .map((day) => ({ day }));
}

export const dynamicParams = false;

export default function DayDealPage() {
  return <>
    <DayDealPageClient />
    <ShopCatalogBelow />
  </>;
}
