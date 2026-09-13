'use client';

import Link from 'next/link';
import { PackageCheck, Search, ShoppingCart, UserRound, X } from 'lucide-react';
import VoiceSearchButton from '@/components/VoiceSearchButton';
import { useCartStore } from '@/lib/cartStore';

type Props = {
  search: string;
  count: number;
  setSearch: (value: string) => void;
  title?: string;
  setFiltersOpen: (value: boolean) => void;
  onlyDeals: boolean;
  setOnlyDeals: (value: boolean | ((current: boolean) => boolean)) => void;
};

export default function CatalogHeader({ search, count, setSearch }: Props) {
  const cartCount = useCartStore((state) => state.getCartCount());
  const openDrawer = useCartStore((state) => state.openDrawer);

  const searchField = (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#E5DED4] bg-white px-3.5 shadow-[0_7px_24px_rgba(43,36,27,0.06)] sm:h-12 sm:px-4">
      <Search size={17} className="shrink-0 text-black/35" />
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search for bangles, jewellery, accessories..."
        className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-[#1D1A16] outline-none placeholder:text-black/35 sm:text-xs"
      />
      {search ? (
        <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="rounded-full p-1 hover:bg-black/5">
          <X size={14} className="text-black/40" />
        </button>
      ) : null}
      <VoiceSearchButton onTranscript={setSearch} />
    </label>
  );

  return (
    <header className="rounded-[24px] border border-[#EAE3D8] bg-[#FFFEFB]/95 px-3 py-3 shadow-[0_12px_36px_rgba(46,37,25,0.06)] backdrop-blur sm:px-4 lg:rounded-[28px] lg:px-5">
      <div className="flex items-center gap-3 lg:gap-5">
        <Link href="/" prefetch className="shrink-0" aria-label="PrimeHubPK home">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#F7E8C8] text-[#A86D13] shadow-inner sm:h-11 sm:w-11">
              <ShoppingCart size={21} strokeWidth={2.2} />
            </span>
            <span className="hidden sm:block">
              <span className="block text-[23px] font-black leading-none tracking-[-0.055em] text-[#0D594E] lg:text-[27px]">
                PrimeHub<span className="text-[#C69235]">PK</span>
              </span>
              <span className="mt-1 block text-[7px] font-bold uppercase tracking-[0.15em] text-black/45">Bangles · Jewellery · Accessories</span>
            </span>
          </div>
        </Link>

        <div className="hidden min-w-0 flex-1 md:flex">{searchField}</div>

        <nav className="ml-auto flex items-center gap-1.5 sm:gap-2" aria-label="Shop quick links">
          <Link href="/orders" prefetch className="group flex h-10 items-center gap-2 rounded-full px-2.5 text-[#1F1C18] transition hover:bg-[#F5F1EA] sm:h-11 sm:px-3" aria-label="Orders">
            <PackageCheck size={20} />
            <span className="hidden text-[10px] font-bold lg:inline">Orders</span>
          </Link>
          <Link href="/account" prefetch className="group flex h-10 items-center gap-2 rounded-full px-2.5 text-[#1F1C18] transition hover:bg-[#F5F1EA] sm:h-11 sm:px-3" aria-label="Account">
            <UserRound size={20} />
            <span className="hidden text-[10px] font-bold lg:inline">Account</span>
          </Link>
          <button
            type="button"
            onClick={openDrawer}
            className="relative flex h-10 items-center gap-2 rounded-full px-2.5 text-[#1F1C18] transition hover:bg-[#F5F1EA] sm:h-11 sm:px-3"
            aria-label={`Cart, ${cartCount} items`}
          >
            <span className="relative">
              <ShoppingCart size={21} />
              {cartCount > 0 && (
                <span className="absolute -right-2.5 -top-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#0F6A5F] px-1 text-[8px] font-black text-white ring-2 ring-[#FFFEFB]">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </span>
            <span className="hidden text-[10px] font-bold lg:inline">Cart</span>
          </button>
        </nav>
      </div>

      <div className="mt-3 md:hidden">{searchField}</div>

      <div className="mt-2 flex items-center justify-between px-1 text-[8px] font-bold text-black/40 sm:hidden">
        <span>{count.toLocaleString()} products</span>
        <span className="text-[#0F6A5F]">PrimeHub Shop</span>
      </div>
    </header>
  );
}
