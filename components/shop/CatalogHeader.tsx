import { Search, SlidersHorizontal, X } from 'lucide-react';

type Props = {
  search: string;
  count: number;
  setSearch: (value: string) => void;
  title?: string;
  setFiltersOpen: (value: boolean) => void;
  onlyDeals: boolean;
  setOnlyDeals: (value: boolean | ((current: boolean) => boolean)) => void;
};

export default function CatalogHeader({
  search,
  count,
  setSearch,
  title,
  setFiltersOpen,
  onlyDeals,
  setOnlyDeals,
}: Props) {
  return (
    <div className="space-y-3">
      {title ? (
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-xl font-black tracking-tight text-[#14140F] md:text-2xl">{title}</h1>
          <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-black/45 shadow-sm ring-1 ring-black/5">{count}</span>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/80 px-3.5 py-2.5 shadow-[0_8px_24px_rgba(20,20,15,0.06)] ring-1 ring-black/5 backdrop-blur-md">
          <Search size={16} className="shrink-0 text-black/30" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products or categories..."
            className="min-w-0 flex-1 bg-transparent text-xs font-bold text-[#14140F] outline-none placeholder:text-black/30"
          />
          {search ? (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
              <X size={15} className="text-black/30" />
            </button>
          ) : null}
        </label>
        {!title ? (
          <span className="hidden rounded-full bg-white/80 px-2.5 py-2 text-[9px] font-black text-black/45 ring-1 ring-black/5 sm:inline">
            {count}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex h-11 items-center gap-1.5 rounded-full bg-white/80 px-3 text-[10px] font-black text-[#14140F] shadow-sm ring-1 ring-black/5 backdrop-blur-md"
        >
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Filters</span>
        </button>
        <button
          type="button"
          onClick={() => setOnlyDeals((current) => !current)}
          className={`h-11 rounded-full px-3 text-[10px] font-black shadow-sm ring-1 ${onlyDeals ? 'bg-[#E1352B] text-white ring-[#E1352B]' : 'bg-white/80 text-[#14140F] ring-black/5 backdrop-blur-md'}`}
        >
          Deals
        </button>
      </div>
    </div>
  );
}
