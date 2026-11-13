'use client';

import { useRef, type RefObject } from 'react';
import { categoryHref, productMatchesCategory } from '@/lib/categoryUtils';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { HomeProductCard } from '@/components/home/HomeCollections';
import { imageOf, type Product } from '@/components/shop/ShopTypes';
import type { Category } from '@/lib/types';
import { useContinuousHomeRail } from '@/lib/useContinuousHomeRail';
import { Commerce3DBanner } from './HomeCommerceRails';

function MovingCategoryProductRail({ products, railRef }: {
  products: Product[];
  railRef: RefObject<HTMLDivElement | null>;
}) {
  // Match the existing two-row continuous loop; no delayed client shuffle.
  const loopProducts = products.length > 1 && products.length % 2 === 1
    ? [...products, products[0]] : products;
  useContinuousHomeRail(railRef, { itemCount: loopProducts.length, speed: 23, startDelayMs: 8000 });

  return <div
    ref={railRef}
    data-home-category-rail
    className="overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    style={{
      display: 'grid',
      gridTemplateColumns: 'none',
      gridAutoFlow: 'column',
      gridTemplateRows: 'repeat(2, auto)',
      gridAutoColumns: 'min(calc((100% - 10px) / 2), 208px)',
      gap: '8px 10px',
      direction: 'ltr',
      overscrollBehaviorX: 'contain',
      scrollPaddingInlineStart: 0,
    }}
  >
    {(loopProducts.length > 1 ? [0, 1] : [0]).flatMap(copy =>
      loopProducts.map((product, index) => (
        <div key={copy + ':' + index + ':' + product.id} className="min-w-0"
          data-loop-original={copy === 0 && index === 0 ? '' : undefined}
          data-loop-copy={copy === 1 && index === 0 ? '' : undefined}>
          <HomeProductCard product={product}/>
        </div>
      )))}
  </div>;
}

function CategoryRailCard({ category, matches }: { category: Category; matches: Product[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const href = categoryHref(category) as Parameters<typeof Commerce3DBanner>[0]['href'];
  const iconImage = normalizeImageUrl(category.iconUrl || category.imageUrl || '');
  const move = (direction: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.dispatchEvent(new Event('click'));
    rail.scrollBy({ left: direction * (rail.clientWidth + 10), behavior: 'smooth' });
  };
  return <div className="home-category-3d-frame rounded-[20px] border border-[#DCCCA8]/60 bg-[#FFFCF7] pb-3 shadow-sm">
    <Commerce3DBanner kind="category" title={category.title} href={href}
      iconImage={iconImage} images={matches.map(product => normalizeImageUrl(imageOf(product)))}
      onMove={move}/>
    <MovingCategoryProductRail products={matches} railRef={railRef}/>
  </div>;
}

export default function HomeCategoryDeals({ products, categories }: { products: Product[]; categories: Category[] }) {
  const visible = [...categories]
    .filter(category => category.active !== false && String(category.title || '').trim())
    .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || a.title.localeCompare(b.title));

  return <section className="home-category-3d-list mt-2 space-y-2.5" aria-label="Shop products by category">
    {visible.map(category => {
      // Database order remains visible through SSR, hydration and client idle.
      const matches = products.filter(product =>
        product.published !== false && productMatchesCategory(category.title, product, categories));
      return matches.length
        ? <CategoryRailCard key={category.id} category={category} matches={matches}/>
        : null;
    })}
  </section>;
}
