'use client';

import { useRef, useState, type TouchEvent } from 'react';
import { PackageCheck, SlidersHorizontal, X } from 'lucide-react';
import { slugifyCategory } from '@/lib/categoryUtils';
import type { Category } from './ShopTypes';

type FilterPanelProps = {
  categories: Category[];
  category: string;
  setCategory: (value: string) => void;
  maxPrice: string;
  setMaxPrice: (value: string) => void;
  onlyDeals: boolean;
  setOnlyDeals: (value: boolean | ((current: boolean) => boolean)) => void;
  wholesaleOnly: boolean;
  setWholesaleOnly: (value: boolean) => void;
  clearAll: () => void;
  productCount: number;
};

function labelOf(category: Category) {
  return category.title || category.name || category.id || 'Category';
}

const PRICE_OPTIONS = [
  ['all', 'Any price'],
  ['99', 'Rs. 1 – 298'],
  ['299', 'Rs. 299 – 998'],
  ['999', 'Rs. 999 & Above'],
] as const;

export function ShopFilterPanel({
  categories,
  category,
  setCategory,
  maxPrice,
  setMaxPrice,
  wholesaleOnly,
  setWholesaleOnly,
  clearAll,
  productCount,
}: FilterPanelProps) {
  const activeCategories = categories.filter((item) => item.active !== false);

  return (
    <div className="shop-filter-panel">
      <div className="shop-filter-heading">
        <div>
          <p>Shop By</p>
          <span>{productCount} products</span>
        </div>
        <button type="button" onClick={clearAll}>Clear all</button>
      </div>

      <fieldset className="shop-filter-group">
        <legend>Category</legend>
        <button
          type="button"
          onClick={() => {
            setWholesaleOnly(false);
            setCategory('all');
          }}
          className={category === 'all' && !wholesaleOnly ? 'is-selected' : ''}
        >
          <span className="shop-check" />
          <span>All products</span>
        </button>
        {activeCategories.map((item) => {
          const label = labelOf(item);
          const value =
            slugifyCategory(label) ||
            slugifyCategory(item.slug || item.id || '');
          const selected = category === value && !wholesaleOnly;
          return (
            <button
              key={item.id || value}
              type="button"
              onClick={() => {
                setWholesaleOnly(false);
                setCategory(selected ? 'all' : value);
              }}
              className={selected ? 'is-selected' : ''}
            >
              <span className="shop-check" />
              <span>{label}</span>
            </button>
          );
        })}
      </fieldset>

      <fieldset className="shop-filter-group">
        <legend>Price range</legend>
        <div className="shop-price-options">
          {PRICE_OPTIONS.map(([value, label]) => {
            const selected = maxPrice === value && !wholesaleOnly;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setWholesaleOnly(false);
                  setMaxPrice(value !== 'all' && selected ? 'all' : value);
                }}
                className={selected ? 'is-selected' : ''}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="shop-filter-group">
        <legend>Deal type</legend>
        <button
          type="button"
          onClick={() => {
            setWholesaleOnly(!wholesaleOnly);
            setMaxPrice('all');
          }}
          className={wholesaleOnly ? 'is-selected' : ''}
        >
          <span className="shop-check" />
          <PackageCheck size={14} />
          <span>Wholesale</span>
        </button>
      </fieldset>
    </div>
  );
}

type Props = FilterPanelProps & {
  filtersOpen: boolean;
  setFiltersOpen: (value: boolean) => void;
};

export function FilterDrawer({ filtersOpen, setFiltersOpen, ...panelProps }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  if (!filtersOpen) return null;

  const startDrag = (event: TouchEvent<HTMLDivElement>) => {
    dragStartY.current = event.touches[0]?.clientY ?? null;
    setDragging(dragStartY.current !== null);
  };

  const moveDrag = (event: TouchEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const currentY = event.touches[0]?.clientY;
    if (currentY == null) return;
    const nextOffset = Math.max(0, currentY - dragStartY.current);
    if (nextOffset > 0) event.preventDefault();
    setDragOffset(nextOffset);
  };

  const finishDrag = () => {
    const shouldClose = dragOffset >= 80;
    dragStartY.current = null;
    setDragging(false);
    setDragOffset(0);
    if (shouldClose) setFiltersOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] lg:hidden"
      style={{ overscrollBehavior: 'none' }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={() => setFiltersOpen(false)}
        aria-label="Close Shop By"
      />
      <div
        ref={drawerRef}
        className="absolute bottom-0 left-0 right-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] bg-[#fffdf8] shadow-2xl"
        style={{
          transform: `translateY(${dragOffset}px)`,
          transition: dragging ? 'none' : 'transform 180ms ease',
          overscrollBehaviorY: 'contain',
        }}
      >
        <div
          className="shrink-0 px-5 pt-4"
          style={{ touchAction: 'none' }}
          onTouchStart={startDrag}
          onTouchMove={moveDrag}
          onTouchEnd={finishDrag}
          onTouchCancel={finishDrag}
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/15" aria-hidden="true" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Find products</p>
              <h2 className="mt-1 text-lg font-black">Shop By</h2>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5"
              aria-label="Close Shop By"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-5"
          style={{ overscrollBehaviorY: 'contain' }}
        >
          <ShopFilterPanel {...panelProps} />
          <div className="sticky bottom-0 z-10 -mx-5 mt-4 border-t border-black/5 bg-[#fffdf8]/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="w-full rounded-2xl bg-[#005448] py-3.5 text-xs font-black text-white"
            >
              Show {panelProps.productCount} products
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type BarProps = {
  setFiltersOpen: (value: boolean) => void;
  onlyDeals: boolean;
  setOnlyDeals: (value: boolean | ((current: boolean) => boolean)) => void;
};

export default function CatalogFilters({ setFiltersOpen }: BarProps) {
  return (
    <div className="mt-5 flex items-center justify-between gap-2">
      <button type="button" onClick={() => setFiltersOpen(true)} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[10px] font-black shadow-sm ring-1 ring-black/5"><SlidersHorizontal size={14} /> Shop By</button>
    </div>
  );
}
