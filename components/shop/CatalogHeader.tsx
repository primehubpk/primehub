import { Search, X } from 'lucide-react';

type Props = { search: string; count: number; setSearch: (value: string) => void };
export default function CatalogHeader({ search, count, setSearch }: Props) {
  return <div className="rounded-[28px] bg-white p-5 shadow-[0_12px_40px_rgba(20,20,15,0.07)] ring-1 ring-black/5 md:p-7">
    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#E1352B]">PrimeHub Picks</p>
    <div className="mt-1 flex items-end justify-between gap-4"><div><h1 className="text-3xl font-black tracking-tight text-[#14140F] md:text-4xl">Discover deals</h1><p className="mt-1 max-w-xl text-xs leading-5 text-black/45">Browse live products and prices from your PrimeHub store.</p></div><span className="rounded-full bg-[#F8F7F3] px-3 py-1.5 text-[9px] font-black text-black/50">{count} products</span></div>
    <div className="mt-5 flex items-center gap-2 rounded-2xl bg-[#F8F7F3] px-3 py-2.5 ring-1 ring-black/5"><Search size={17} className="shrink-0 text-black/30" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products or categories..." className="min-w-0 flex-1 bg-transparent py-2 text-xs font-bold text-[#14140F] outline-none placeholder:text-black/30" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={16} className="text-black/30" /></button>}</div>
  </div>;
}
