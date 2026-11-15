import { redirect } from 'next/navigation';

export function generateStaticParams() {
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => ({ day }));
}
export const dynamicParams = false;
export default function LegacyDayDealPage() { redirect('/deals'); }
