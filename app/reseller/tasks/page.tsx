import { redirect } from 'next/navigation';

// Old Reseller Tasks URL is only a compatibility entry point.
// All customer tasks now live in the single Prime Family dashboard.
export default function ResellerTasksPage() {
  redirect('/reseller/dashboard?tab=tasks');
}
