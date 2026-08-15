'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot } from 'firebase/firestore';
import { Heart, MoreHorizontal, Search, ShoppingCart, Tag, UserRound, ShieldCheck, Sparkles, CalendarDays } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import LiveSearchBar from '@/components/LiveSearchBar';

type StoreCategory = { id: string; title: string; slug?: string; iconUrl?: string; sortOrder?: number; active?: boolean };
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function AnnouncementBar({ text }: { text: string }) {
  const announcement = text?.trim() || 'PrimeHub Deals';
  return <div className="overflow-hidden bg-[#090909] py-2.5 text-white" role="region" aria-label="Announcement">
    <div className="relative overflow-hidden whitespace-nowrap">
      <div className="inline-flex min-w-full animate-[ph-marquee_18s_linear_infinite] items-center justify-center gap-10 px-4 text-[10px] font-black uppercase tracking-[0.16em] sm:text-[11px]">
        <span className="inline-flex shrink-0 items-center gap-2"><ShieldCheck size={13} className="text-white/70" />{announcement}</span>
        <span className="inline-flex shrink-0 items-center gap-2"><ShieldCheck size={13} className="text-white/70" />{announcement}</span>
        <span className="inline-flex shrink-0 items-center gap-2"><ShieldCheck size={13} className="text-white/70" />{announcement}</span>
      </div>
    </div>
    <style jsx>{`@keyframes ph-marquee{from{transform:translateX(0)}to{transform:translateX(-33.333%)}}`}</style>
  </div>;
}

export default function Header() {
  const router = useRouter(); const [searchQuery, setSearchQuery] = useState(''); const [categories, setCategories] = useState<StoreCategory[]>([]); const { settings } = useSettings();
  const cartCount = useCartStore((s) => s.getCartCount()); const cartItemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.qty, 0)); const openDrawer = useCartStore((s) => s.openDrawer);
  const deliveryThreshold = Math.max(1, Number(settings.freeDelivery?.itemThreshold ?? settings.freeShippingCount ?? 5)); const itemsToGo = Math.max(0, deliveryThreshold - cartItemCount); const deliveryProgress = Math.min(100, Math.round((cartItemCount / deliveryThreshold) * 100));
  useEffect(() => onSnapshot(collection(db, 'categories'), (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as StoreCategory)), () => setCategories([])), []);
  const visibleCategories = useMemo(() => categories.filter((category) => (category.active ?? true) && category.title.trim()).sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || a.title.localeCompare(b.title)).slice(0, 12), [categories]);
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const query = searchQuery.trim(); router.push(query ? `/shop?q=${encodeURIComponent(query)}` : '/shop'); };
  const openCategory = (category: StoreCategory) => router.push(`/category/${encodeURIComponent(category.slug || slugify(category.title))}`);
  const scrollToWeeklyDeals = () => { const section = document.getElementById('weekly-deals'); if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return <>
    <AnnouncementBar text={settings.announcementText} />
    <header className="border-b border-black/10 bg-[#F8F7F3] shadow-[0_8px_30px_rgba(20,20,15,0.04)]">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 lg:gap-7">
          <button type="button" onClick={() => router.push('/')} className="shrink-0 text-left" aria-label="PrimeHub Deals home"><div className="text-2xl font-black tracking-[-0.07em] sm:text-3xl">ph<span className="text-[#E1352B]">deals</span></div><div className="mt-0.5 text-center text-[7px] font-black tracking-[0.35em] text-[#B77900]">PRIME HUB</div></button>
          <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 items-center rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-[0_8px_25px_rgba(20,20,15,0.06)] md:flex"><Search className="mr-2 h-5 w-5 shrink-0 text-black/35" /><LiveSearchBar value={searchQuery} onChange={setSearchQuery} /><button type="submit" aria-label="Search" className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#14140F] text-white shadow-md"><Search size={16} /></button></form>
          <nav className="hidden items-center gap-4 lg:flex"><button type="button" onClick={() => router.push('/shop?wishlist=1')} className="group flex flex-col items-center gap-1 text-[10px] font-bold"><Heart size={21}/><span>Wishlist</span></button><button type="button" onClick={() => router.push('/shop?offers=1')} className="group flex flex-col items-center gap-1 text-[10px] font-bold"><Tag size={21}/><span>Offers</span></button><button type="button" onClick={() => router.push('/account')} className="group flex flex-col items-center gap-1 text-[10px] font-bold"><UserRound size={21}/><span>Account</span></button><button type="button" onClick={openDrawer} className="group relative flex flex-col items-center gap-1 text-[10px] font-bold"><ShoppingCart size={23}/><span>Cart</span>{cartCount > 0 && <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E1352B] text-[9px] text-white">{cartCount}</span>}</button></nav>
          <button type="button" onClick={openDrawer} className="relative ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#14140F] text-white shadow-lg lg:hidden" aria-label={`Cart, ${cartCount} items`}><ShoppingCart size={18}/>{cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E1352B] text-[9px] font-bold">{cartCount}</span>}</button>
        </div>
        <form onSubmit={submitSearch} className="mt-3 flex items-center rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-[0_5px_18px_rgba(20,20,15,0.05)] md:hidden"><Search className="mr-2 h-4 w-4 shrink-0 text-black/35"/><LiveSearchBar value={searchQuery} onChange={setSearchQuery}/><button type="submit" aria-label="Search" className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14140F] text-white"><Search size={14}/></button></form>
        <div className="mt-2 md:hidden"><div className="mb-1 flex items-center justify-between text-[10px] font-bold"><span className="text-[#0F6A5F]">{itemsToGo === 0 ? 'Free delivery unlocked!' : `Add ${itemsToGo} more item${itemsToGo === 1 ? '' : 's'} for FREE delivery`}</span><span className="text-black/40">{cartItemCount}/{deliveryThreshold}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[#0F6A5F]" style={{ width: `${deliveryProgress}%` }}/></div></div>
      </div>
    </header>
    <div className="border-b border-black/8 bg-[#F8F7F3]"><div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 lg:px-8"><div className="flex items-center gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]"><button type="button" onClick={() => router.push('/shop')} className="flex shrink-0 items-center gap-2 rounded-2xl border border-black/10 bg-[#14140F] px-3 py-2 text-[10px] font-black text-white shadow-sm"><MoreHorizontal size={15}/>All Categories</button><button type="button" onClick={scrollToWeeklyDeals} className="flex shrink-0 items-center gap-2 rounded-2xl border border-[#0F6A5F]/20 bg-[#E8F3F0] px-3 py-2 text-[10px] font-black text-[#0F6A5F] shadow-sm"><CalendarDays size={15}/>Weekly Deals</button>{visibleCategories.map((category) => <button key={category.id} type="button" onClick={() => openCategory(category)} className="group flex min-w-[88px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-2 py-1.5 text-[9px] font-black text-black/75"><span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFF0C9] text-[#B77900] ring-1 ring-black/5"><span className="block h-full w-full overflow-hidden rounded-full">{category.iconUrl ? <img src={category.iconUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center"><Sparkles size={18}/></span>}</span></span><span className="max-w-[96px] truncate">{category.title}</span></button>)}{categories.filter((category) => (category.active ?? true) && category.title.trim()).length > 12 && <button type="button" onClick={() => router.push('/shop')} className="flex shrink-0 flex-col items-center gap-1.5 rounded-2xl px-2 py-1.5 text-[9px] font-black"><MoreHorizontal className="h-14 w-14 rounded-full bg-[#FFF0C9] p-2.5 text-[#B77900]"/><span>More</span></button>}</div></div></div>
  </>;
}
