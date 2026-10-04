'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { returnFromCommerceOverlay } from '@/lib/productOverlay';
import { readShoppingReturnPath } from '@/lib/shoppingReturn';

export default function ShoppingBackButton() {
  const router = useRouter();
  return <button type="button" aria-label="Back to your shopping" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm" onClick={() => {
    if (!returnFromCommerceOverlay()) router.replace(readShoppingReturnPath(), { scroll: false });
  }}><ArrowLeft size={17} /></button>;
}
