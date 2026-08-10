'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot } from 'firebase/firestore';
import { Heart, MoreHorizontal, Search, ShoppingCart, Tag, UserRound } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import LiveSearchBar from '@/components/LiveSearchBar';

type StoreCategory = { id: string; title: string; slug?: string; iconUrl?: string };

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

function AnnouncementBar({ text }: { text: string }) {
  return <div className="hidden overflow-hidden whitespace-nowrap bg-[#090909] py-2 text-white md:block"><div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 text-[11px] font-bold"><div className="flex items-center gap-7 opacity-95"><span>🛡️ 100% Original Products</span><span className="text-white/20">|</span><span>🚚 Fast &amp; Free Delivery</span><span className="text-white/20">|</span><span>📦 Cash on Delivery</span></div><span className="text-[#FFB020]">{text || 'PrimeHub Deals'}</span></div></div>;
}

export default function Header() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const { settings } = useSettings();
  const cartCount = useCartStore((s) => s.getCartCount());
  const cartItemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.qty, 0));
  const openDrawer = useCartStore((s) => s.openDrawer);
  const deliveryThreshold = Math.max(1, Number(settings.freeDelivery?.itemThreshold ?? settings.freeShippingCount ?? 5));
  const itemsToGo = Math.max(0, deliveryThreshold - cartItemCount);
  const deliveryProgress = Math.min(100, Math.round((cartItemCount / deliveryThreshold) * 100));

  useEffect(() => onSnapshot(collection(db, 'categories'), (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as StoreCategory)), () => setCategories([])), []);
  const visibleCategories = useMemo(() => categories.filter((category) => category.title.trim()).slice(0, 12), [categories]);
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const query = searchQuery.trim(); router.push(query ? `/shop?q=${encodeURIComponent(query)}` : '/shop'); };
  const openCategory = (category: StoreCategory) => router.push(`/category/${encodeURIComponent(category.slug || slugify(category.title))}`);

  return <>
    <AnnouncementBar text={settings.announcementText} />
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[#F8F7F3]/95 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 lg:gap-8">
          <button type="button" onClick={() => router.push('/')} className="shrink-0 text-left" aria-label="PrimeHub Deals home"><div className="text-2xl font-black tracking-[-0.07em] sm:text-3xl">ph<span className="text-[#E1352B]">deals</span></div><div className="mt-0.5 text-center text-[7px] font-black tracking-[0.35em] text-[#B77900]">PRIME HUB</div></button>
          <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 items-center rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-[0_8px_25px_rgba(20,20,15,0.06)] md:flex"><Search className="mr-2 h-5 w-5 shrink-0 text-black/35" aria-hidden="true" /><LiveSearchBar value={searchQuery} onChange={setSearchQuery} /><button type="submit" aria-label="Search" className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D99A17] text-white shadow-md"><Search size={16} /></button></form>
          <nav className="hidden items-center gap-5 lg:flex"><button type="button" onClick={() => router.push('/shop?wishlist=1')} className="flex flex-col items-center gap-1 text-[10px] font-bold"><Heart size={22} /><span>Wishlist</span></button><button type="button" onClick={() => router.push('/shop?offers=1')} className="flex flex-col items-center gap-1 text-[10px] font-bold"><Tag size={22} /><span>Offers</span></button><button type="button" onClick={() => router.push('/account')} className="flex flex-col items-center gap-1 text-[10px] font-bold"><UserRound size={22} /><span>Account</span></button><button type="button" onClick={openDrawer} className="relative flex flex-col items-center gap-1 text-[10px] font-bold"><ShoppingCart size={24} /><span>Cart</span>{cartCount > 0 && <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E1352B] text-[9px] text-white">{cartCount}</span>}</button></nav>
          <button type="button" onClick={openDrawer} className="relative ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#14140F] text-white lg:hidden" aria-label={`Cart, ${cartCount} items`}><ShoppingCart size={18} />{cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E1352B] text-[9px] font-bold">{cartCount}</span>}</button>
        </div>
        <form onSubmit={submitSearch} className="mt-3 flex items-center rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-sm md:hidden"><Search className="mr-2 h-4 w-4 text-black/35" aria-hidden="true" /><LiveSearchBar value={searchQuery} onChange={setSearchQuery} /></form>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"><button type="button" onClick={() => router.push('/shop')} className="flex shrink-0 items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-[10px] font-black"><MoreHorizontal size={15} />All Categories</button>{visibleCategories.map((category) => <button key={category.id} type="button" onClick={() => openCategory(category)} className="flex min-w-[74px] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-black text-black/75 transition hover:bg-white">{category.iconUrl ? <img src={category.iconUrl} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF0C9] text-[#B77900]">✦</span>}<span className="max-w-[82px] truncate">{category.title}</span></button>)}{categories.length > 12 && <button type="button" onClick={() => router.push('/shop')} className="flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-black"><MoreHorizontal className="h-7 w-7 rounded-full bg-[#FFF0C9] p-1.5 text-[#B77900]" /><span>More</span></button>}</div>
        <div className="mt-2 md:hidden"><div className="mb-1 flex items-center justify-between text-[10px] font-bold"><span className="text-[#0F6A5F]">{itemsToGo === 0 ? 'Free delivery unlocked!' : `Add ${itemsToGo} more items for FREE delivery`}</span><span className="text-black/40">{cartItemCount}/{deliveryThreshold}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[#0F6A5F] transition-all" style={{ width: `${deliveryProgress}%` }} /></div></div>
      </div>
    </header>
  </>;
}
