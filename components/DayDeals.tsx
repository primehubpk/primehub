'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase';

type ImageValue = string | { url?: string };
type WeekendProduct = { id: string; title?: string; name?: string; price?: number; originalPrice?: number; imageUrl?: string; image?: string; images?: ImageValue[] };
function isWeekend() { const day = new Date().getDay(); return day === 0 || day === 6; }
function titleOf(product: WeekendProduct) { return product.title || product.name || 'Weekend Deal'; }
function getDealImageUrl(deal: WeekendProduct) {
  if (!deal) return '/placeholder.png';
  const product = deal as any;
  const first = product.images?.[0];
  return (first?.url || first || product.imageUrl || product.image || (deal as any).imageUrl || (deal as any).image || (deal as any).images?.[0]?.url || (deal as any).images?.[0] || '/placeholder.png') as string;
}
function isImgBB(src: string) { try { const url = new URL(src); return url.protocol === 'https:' && (url.hostname === 'i.ibb.co' || url.hostname === 'ibb.co'); } catch { return false; } }

export default function DayDeals() {
  const [deals, setDeals] = useState<WeekendProduct[]>([]);
  const weekendActive = isWeekend();
  useEffect(() => { const weekendDealsQuery = query(collection(db, 'products'), where('isWeekendSpecial', '==', true)); return onSnapshot(weekendDealsQuery, snapshot => setDeals(snapshot.docs.map(item => ({ id: item.id, ...item.data() })) as WeekendProduct[]), () => setDeals([])); }, []);
  if (!deals.length) return null;
  return <section className="mx-auto mt-6 max-w-md px-4"><div className="mb-3 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-[#FFB020]" aria-hidden="true"/><h2 className="font-[family-name:var(--font-display)] text-base font-bold">{weekendActive ? 'Weekend Glow Deals — Live Now' : 'Weekend Glow Deals'}</h2></div><div className="grid grid-cols-3 gap-2.5">{deals.slice(0, 3).map(deal => { const price = Number(deal.price || 0); const original = Number(deal.originalPrice || 0); const discount = original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0; const image = getDealImageUrl(deal); return <Link key={deal.id} href={`/product/${deal.id}`} className="relative overflow-hidden rounded-xl border border-black/10 bg-white p-2 text-center"><div className="mb-2 aspect-square overflow-hidden rounded-lg bg-[#F4F4F1]"><Image src={image} alt={titleOf(deal)} width={300} height={300} unoptimized={isImgBB(image)} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = '/placeholder.png'; }} /></div><p className="truncate text-[9px] font-bold">{titleOf(deal)}</p>{discount > 0 && <span className="mt-1 inline-block rounded-full bg-[#E1352B] px-2 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>}</Link>; })}</div></section>;
}
