import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import CatalogProductCard from './CatalogProductCard';
import { Product } from './ShopTypes';

export type CategoryRail = {
  id: string;
  title: string;
  href: string;
  products: Product[];
};

type Props = {
  rails: CategoryRail[];
  addedId: string | null;
  addProduct: (product: Product) => void;
  loading?: boolean;
};

export default function CategoryRails({ rails, addedId, addProduct, loading }: Props) {
  if (loading) {
    return (
      <div className="mt-7 space-y-6">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="h-5 w-40 animate-pulse rounded-full bg-white" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((__, card) => (
                <div key={card} className="h-56 w-[168px] shrink-0 animate-pulse rounded-[22px] bg-white" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!rails.length) return null;

  return (
    <div className="mt-7 space-y-8">
      {rails.map((rail) => (
        <section key={rail.id}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-base font-black tracking-tight text-[#14140F]">✨ {rail.title}</h2>
            <Link
              href={rail.href}
              className="flex items-center gap-0.5 rounded-full bg-white/80 px-2.5 py-1.5 text-[10px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5 backdrop-blur"
            >
              View All <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex snap-x snap-mandatory flex-nowrap gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 scrollbar-hide">
            {rail.products.map((product) => (
              <CatalogProductCard key={product.id} product={product} addedId={addedId} addProduct={addProduct} compact />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
