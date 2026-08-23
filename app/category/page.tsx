import { Suspense } from 'react';
import ShopCatalog from '@/components/ShopCatalog';

export default function CategoriesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F4F4F1] p-8 text-center text-xs text-black/50">Loading shop...</div>}>
      <ShopCatalog />
    </Suspense>
  );
}
