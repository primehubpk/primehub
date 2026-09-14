import { PackageCheck, SlidersHorizontal, Tag, X } from 'lucide-react';
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

export function ShopFilterPanel({
  categories,
  category,
  setCategory,
  maxPrice,
  setMaxPrice,
  onlyDeals,
  setOnlyDeals,
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
          <p>Filters</p>
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
          const value = slugifyCategory(item.slug || item.title || item.name || item.id || '');
          return (
            <button
              key={item.id || value}
              type="button"
              onClick={() => {
                setWholesaleOnly(false);
                setCategory(value);
              }}
              className={category === value && !wholesaleOnly ? 'is-selected' : ''}
            >
              <span className="shop-check" />
              <span>{labelOf(item)}</span>
            </button>
          );
        })}
      </fieldset>

      <fieldset className="shop-filter-group">
        <legend>Price range</legend>
        <div className="shop-price-options">
          {[['all', 'Any price'], ['99', 'Under Rs. 99'], ['299', 'Under Rs. 299'], ['999', 'Under Rs. 999']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setWholesaleOnly(false);
                setMaxPrice(value);
              }}
              className={maxPrice === value && !wholesaleOnly ? 'is-selected' : ''}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="shop-filter-group">
        <legend>Deal type</legend>
        <button type="button" onClick={() => setOnlyDeals((value) => !value)} className={onlyDeals ? 'is-selected' : ''}>
          <span className="shop-check" />
          <Tag size={14} />
          <span>Flash deals</span>
        </button>
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
  if (!filtersOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] lg:hidden">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setFiltersOpen(false)} aria-label="Close filters" />
      <div className="absolute bottom-0 left-0 right-0 max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-[#fffdf8] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Refine results</p>
            <h2 className="mt-1 text-lg font-black">Shop filters</h2>
          </div>
          <button type="button" onClick={() => setFiltersOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5" aria-label="Close filters"><X size={17} /></button>
        </div>
        <ShopFilterPanel {...panelProps} />
        <button type="button" onClick={() => setFiltersOpen(false)} className="mt-4 w-full rounded-2xl bg-[#005448] py-3.5 text-xs font-black text-white">Show {panelProps.productCount} products</button>
      </div>
    </div>
  );
}

type BarProps = {
  setFiltersOpen: (value: boolean) => void;
  onlyDeals: boolean;
  setOnlyDeals: (value: boolean | ((current: boolean) => boolean)) => void;
};

export default function CatalogFilters({ setFiltersOpen, onlyDeals, setOnlyDeals }: BarProps) {
  return (
    <div className="mt-5 flex items-center justify-between gap-2">
      <button type="button" onClick={() => setFiltersOpen(true)} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[10px] font-black shadow-sm ring-1 ring-black/5"><SlidersHorizontal size={14} /> Filters</button>
      <button type="button" onClick={() => setOnlyDeals((value) => !value)} className={`rounded-2xl px-4 py-3 text-[10px] font-black shadow-sm ring-1 ring-black/5 ${onlyDeals ? 'bg-[#E1352B] text-white' : 'bg-white text-[#14140F]'}`}>Flash deals only</button>
    </div>
  );
}
