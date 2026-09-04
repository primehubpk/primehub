'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReceiptText, Search, ShoppingBag, ShoppingCart, ShieldCheck } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import LiveSearchBar from '@/components/LiveSearchBar';
import { buildSmartSearchHref, interpretSearchQuery } from '@/lib/aiSearchClient';

function AnnouncementBar({ text }: { text: string }) {
  const announcement = text?.trim() || 'PrimeHubMall · Retail & Wholesale Deals';
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
  const router = useRouter(); const [searchQuery, setSearchQuery] = useState(''); const { settings } = useSettings();
  const cartCount = useCartStore((s) => s.getCartCount()); const cartItemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.qty, 0)); const openDrawer = useCartStore((s) => s.openDrawer);
  const deliveryThreshold = Math.max(1, Number(settings.freeDelivery?.itemThreshold ?? settings.freeShippingCount ?? 5)); const itemsToGo = Math.max(0, deliveryThreshold - cartItemCount); const deliveryProgress = Math.min(100, Math.round((cartItemCount / deliveryThreshold) * 100));
  const submitSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) { router.push('/shop'); return; }
    const intent = await interpretSearchQuery(query);
    setSearchQuery(intent.query || query);
    router.push(buildSmartSearchHref(intent));
  };

  return <>
    <AnnouncementBar text={settings.announcementText} />
    <header className="border-b border-black/10 bg-[#F8F7F3] shadow-[0_8px_30px_rgba(20,20,15,0.04)]">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 lg:gap-7">
          <button type="button" onClick={() => router.push('/')} className="shrink-0 text-left" aria-label="PrimeHubMall home"><div className="text-2xl font-black tracking-[-0.06em] sm:text-3xl">PrimeHub<span className="text-[#E1352B]">Mall</span></div><div className="mt-0.5 text-center text-[7px] font-black tracking-[0.28em] text-[#B77900]">PRIME HUB DEALS</div></button>
          <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 items-center rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-[0_8px_25px_rgba(20,20,15,0.06)] md:flex"><Search className="mr-2 h-5 w-5 shrink-0 text-black/35" /><LiveSearchBar value={searchQuery} onChange={setSearchQuery} /><button type="submit" aria-label="Search" className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#14140F] text-white shadow-md"><Search size={16} /></button></form>
          <nav className="hidden items-center gap-3 lg:flex"><button type="button" onClick={() => router.push('/orders')} className="group flex flex-col items-center gap-1 text-[10px] font-bold" aria-label="My Orders"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#14140F] text-white shadow-md transition group-hover:-translate-y-0.5"><ReceiptText size={18}/></span><span>My Orders</span></button><button type="button" onClick={() => router.push('/shop')} className="group flex flex-col items-center gap-1 text-[10px] font-bold" aria-label="Shop"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#14140F] text-white shadow-md transition group-hover:-translate-y-0.5"><ShoppingBag size={18}/></span><span>Shop</span></button><button type="button" onClick={openDrawer} className="group relative flex flex-col items-center gap-1 text-[10px] font-bold" aria-label={`Cart, ${cartCount} items`}><span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#14140F] text-white shadow-md transition group-hover:-translate-y-0.5"><ShoppingCart size={18}/>{cartCount > 0 && <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E1352B] text-[9px] text-white ring-2 ring-[#F8F7F3]">{cartCount}</span>}</span><span>Cart</span></button></nav>
          <div className="ml-auto flex items-start gap-2 lg:hidden"><button type="button" onClick={() => router.push('/orders')} className="group flex flex-col items-center gap-1" aria-label="My Orders"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#14140F] text-white shadow-md"><ReceiptText size={17}/></span><span className="text-[7px] font-black text-black/55">MY ORDERS</span></button><button type="button" onClick={() => router.push('/shop')} className="group flex flex-col items-center gap-1" aria-label="Shop"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#14140F] text-white shadow-md"><ShoppingBag size={18}/></span><span className="text-[7px] font-black text-black/55">SHOP</span></button><button type="button" onClick={openDrawer} className="group relative flex flex-col items-center gap-1" aria-label={`Cart, ${cartCount} items`}><span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#14140F] text-white shadow-md"><ShoppingCart size={18}/>{cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E1352B] text-[9px] font-bold text-white ring-2 ring-[#F8F7F3]">{cartCount}</span>}</span><span className="text-[7px] font-black text-black/55">CART</span></button></div>
        </div>
        <form onSubmit={submitSearch} className="mt-3 flex items-center rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-[0_5px_18px_rgba(20,20,15,0.05)] md:hidden"><Search className="mr-2 h-4 w-4 shrink-0 text-black/35"/><LiveSearchBar value={searchQuery} onChange={setSearchQuery}/><button type="submit" aria-label="Search" className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14140F] text-white"><Search size={14}/></button></form>
        <div className="mt-2 md:hidden"><div className="mb-1 flex items-center justify-between text-[10px] font-bold"><span className="text-[#0F6A5F]">{itemsToGo === 0 ? 'Free delivery unlocked!' : `Add ${itemsToGo} more item${itemsToGo === 1 ? '' : 's'} for FREE delivery`}</span><span className="text-black/40">{cartItemCount}/{deliveryThreshold}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[#0F6A5F]" style={{ width: `${deliveryProgress}%` }}/></div></div>
      </div>
    </header>
  </>;
}
