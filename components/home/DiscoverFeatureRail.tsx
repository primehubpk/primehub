'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ArrowRight,
  Crown,
  Gift,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Store,
  Tags,
  WalletCards,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { DEFAULT_RESELLER_TASKS, type ResellerTask } from '@/lib/resellerTasks';

const shopItems = [
  { label: 'All Products', icon: <PackageSearch size={16} />, href: '/shop' },
  { label: 'Categories', icon: <Tags size={16} />, href: '/shop' },
  { label: 'New Arrivals', icon: <Sparkles size={16} />, href: '/shop' },
  { label: 'Best Deals', icon: <Gift size={16} />, href: '/shop' },
];

export function ShopFeatureBanner() {
  return (
    <section className="col-span-full my-3 min-w-0 overflow-hidden rounded-[24px] border border-black/5 bg-[#FFFCF7] py-4 shadow-[0_12px_30px_rgba(20,20,15,0.07)] sm:rounded-[28px] sm:py-5">
      <div className="mb-3 flex items-center justify-between gap-3 px-4 sm:px-5">
        <Link href="/shop" className="group flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#14140F] text-white shadow-[0_8px_18px_rgba(20,20,15,0.16)]">
            <Store size={19} />
          </span>
          <span className="min-w-0">
            <span className="block text-[8px] font-black uppercase tracking-[.2em] text-[#B7791F]">Explore PrimeHub</span>
            <span className="mt-0.5 block truncate text-base font-black text-[#14140F] sm:text-lg">Shop</span>
          </span>
        </Link>
        <Link href="/shop" className="flex shrink-0 items-center gap-1 rounded-full bg-[#14140F] px-3 py-2 text-[9px] font-black text-white">
          View all <ArrowRight size={12} />
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 sm:px-5">
        {shopItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group flex w-[52vw] max-w-[190px] shrink-0 snap-start items-center gap-3 rounded-[18px] border border-black/5 bg-white p-3 shadow-sm sm:w-[180px] sm:rounded-[20px]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F1] text-[#0F6A5F]">
              {item.icon}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] font-black text-[#14140F]">{item.label}</span>
            <ArrowRight size={13} className="shrink-0 text-[#0F6A5F] transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function MemberFeatureRail() {
  const [tasks, setTasks] = useState<ResellerTask[]>(DEFAULT_RESELLER_TASKS);

  useEffect(
    () =>
      onSnapshot(doc(db, 'settings', 'main'), (snapshot) => {
        const data = snapshot.data() as { resellerTasks?: ResellerTask[] } | undefined;
        if (Array.isArray(data?.resellerTasks)) setTasks(data.resellerTasks);
      }),
    [],
  );

  const visibleTasks = useMemo(
    () => tasks.filter((task) => task.active !== false).slice(0, 8),
    [tasks],
  );

  return (
    <section className="col-span-full my-3 min-w-0 overflow-hidden rounded-[24px] border border-black/5 bg-[#F7FBFA] py-4 shadow-[0_12px_30px_rgba(20,20,15,0.07)] sm:rounded-[28px] sm:py-5">
      <div className="mb-3 flex items-center justify-between gap-3 px-4 sm:px-5">
        <Link href="/reseller" className="group flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0F6A5F] text-[#FFCF68] shadow-[0_8px_18px_rgba(15,106,95,0.22)]">
            <Crown size={19} />
          </span>
          <span className="min-w-0">
            <span className="block text-[8px] font-black uppercase tracking-[.2em] text-[#0F6A5F]">PrimeHub Exclusive</span>
            <span className="mt-0.5 block truncate text-base font-black text-[#14140F] sm:text-lg">Reseller Club</span>
          </span>
        </Link>
        <Link href="/reseller" className="flex shrink-0 items-center gap-1 rounded-full bg-[#14140F] px-3 py-2 text-[9px] font-black text-white">
          Open club <ArrowRight size={12} />
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 sm:px-5">
        {visibleTasks.length > 0 ? (
          visibleTasks.map((task, index) => (
            <Link
              key={task.id}
              href="/reseller"
              className="group w-[68vw] max-w-[250px] shrink-0 snap-start rounded-[18px] border border-black/5 bg-white p-3 shadow-sm sm:w-[230px] sm:rounded-[20px]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DDF5F0] text-[#0F6A5F]">
                  {index % 3 === 0 ? <WalletCards size={16} /> : index % 3 === 1 ? <Gift size={16} /> : <ShieldCheck size={16} />}
                </span>
                <span className="rounded-full bg-[#F4F4F1] px-2 py-1 text-[8px] font-black text-black/45">
                  {Number(task.reward || 0) > 0 ? `${Number(task.reward).toLocaleString()} reward` : 'Member task'}
                </span>
              </div>
              <p className="mt-3 line-clamp-1 text-[11px] font-black text-[#14140F] sm:text-xs">{task.title}</p>
              <p className="mt-1 line-clamp-2 min-h-[30px] text-[9px] leading-[15px] text-black/45">{task.description}</p>
              <div className="mt-2 flex items-center justify-between text-[9px] font-black text-[#0F6A5F]">
                <span>View task</span>
                <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))
        ) : (
          <Link href="/reseller" className="flex w-[68vw] max-w-[250px] shrink-0 items-center gap-3 rounded-[18px] border border-black/5 bg-white p-3 shadow-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DDF5F0] text-[#0F6A5F]"><Crown size={16} /></span>
            <span className="text-[11px] font-black">Login or join to view reseller benefits</span>
          </Link>
        )}
      </div>
    </section>
  );
}
