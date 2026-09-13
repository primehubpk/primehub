import { SlidersHorizontal, X } from 'lucide-react';

type Props = {
  filtersOpen: boolean;
  setFiltersOpen: (value: boolean) => void;
  maxPrice: string;
  setMaxPrice: (value: string) => void;
  onlyDeals: boolean;
  setOnlyDeals: (value: boolean | ((v: boolean) => boolean)) => void;
  clearAll: () => void;
};

export function FilterDrawer({ filtersOpen, setFiltersOpen, maxPrice, setMaxPrice, onlyDeals, setOnlyDeals, clearAll }: Props) {
  if (!filtersOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] lg:hidden">
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" onClick={() => setFiltersOpen(false)} aria-label="Close filters" />
      <div className="absolute bottom-0 left-0 right-0 rounded-t-[28px] border-t border-[#E6DDD0] bg-[#FFFEFB] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Refine products</p>
            <h2 className="mt-1 text-lg font-black text-[#28231D]">Shop Filters</h2>
          </div>
          <button type="button" onClick={() => setFiltersOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2EEE8]" aria-label="Close filters"><X size={15} /></button>
        </div>

        <div className="mt-6">
          <p className="text-[10px] font-black uppercase tracking-wider text-black/45">Price</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[
              ['all', 'Any'],
              ['99', 'Under 99'],
              ['299', 'Under 299'],
              ['999', 'Under 999'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMaxPrice(value)}
                className={`rounded-2xl px-2 py-3 text-[9px] font-black ${maxPrice === value ? 'bg-[#0F6A5F] text-white' : 'bg-[#F2EEE8] text-[#28231D]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOnlyDeals((v) => !v)}
          className={`mt-4 flex w-full items-center justify-between rounded-2xl p-4 text-left ${onlyDeals ? 'bg-[#E53935] text-white' : 'bg-[#F2EEE8] text-[#28231D]'}`}
        >
          <span>
            <span className="block text-[11px] font-black">Deals only</span>
            <span className="mt-0.5 block text-[9px] opacity-60">Show products marked as live deals</span>
          </span>
          <span className="text-[10px] font-black">{onlyDeals ? 'ON' : 'OFF'}</span>
        </button>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={clearAll} className="rounded-full border border-[#DCD2C4] bg-white py-3 text-[10px] font-black text-[#28231D]">Clear all</button>
          <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-full bg-[#0F6A5F] py-3 text-[10px] font-black text-white">Show products</button>
        </div>
      </div>
    </div>
  );
}

type BarProps = {
  setFiltersOpen: (value: boolean) => void;
  onlyDeals: boolean;
  setOnlyDeals: (value: boolean | ((v: boolean) => boolean)) => void;
};

export default function CatalogFilters({ setFiltersOpen, onlyDeals, setOnlyDeals }: BarProps) {
  return (
    <div className="mt-5 flex items-center justify-between gap-2">
      <button type="button" onClick={() => setFiltersOpen(true)} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[10px] font-black shadow-sm ring-1 ring-black/5"><SlidersHorizontal size={14} /> Filters</button>
      <button type="button" onClick={() => setOnlyDeals((v) => !v)} className={`rounded-2xl px-4 py-3 text-[10px] font-black shadow-sm ring-1 ring-black/5 ${onlyDeals ? 'bg-[#E53935] text-white' : 'bg-white text-[#28231D]'}`}>Deals only</button>
    </div>
  );
}
