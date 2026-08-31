import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import CatalogProductCard from './CatalogProductCard';
import { Product } from './ShopTypes';

export type CategoryRail = {
  id: string;
  title: string;
  href: string;
  imageUrl?: string;
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
          <div key={index} className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((__, card) => (
              <div key={card} className="h-[300px] w-[168px] shrink-0 animate-pulse rounded-[22px] bg-white" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!rails.length) return null;

  return (
    <div className="mt-7 space-y-8">
      {rails.map((rail) => (
        <section key={rail.id} aria-label={rail.title}>
          <div className="flex snap-x snap-mandatory flex-nowrap gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 scrollbar-hide">
            <Link
              href={rail.href}
              className="group w-[168px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-black/6 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:w-[186px]"
              aria-label={`Open ${rail.title} category`}
            >
              <div className="relative aspect-square overflow-hidden bg-[#F4F4F1]">
                {rail.imageUrl ? (
                  <img src={rail.imageUrl} alt={rail.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-[#0F6A5F] to-[#14140F]" />
                )}
                <span className="absolute left-2 top-2 rounded-full bg-[#0F6A5F] px-2 py-1 text-[8px] font-black uppercase text-white">Category</span>
              </div>
              <div className="p-3 pb-1">
                <h2 className="line-clamp-2 min-h-[30px] text-[11px] font-black leading-4">{rail.title}</h2>
                <p className="mt-2 text-sm font-black text-[#0F6A5F]">View all items</p>
              </div>
              <div className="px-3 pb-3 pt-2">
                <span className="flex w-full items-center justify-center gap-1 rounded-xl bg-[#0F6A5F] py-2.5 text-[9px] font-black text-white">
                  Open category <ChevronRight size={13} />
                </span>
              </div>
            </Link>
            {rail.products.map((product) => (
              <CatalogProductCard key={product.id} product={product} addedId={addedId} addProduct={addProduct} compact />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
