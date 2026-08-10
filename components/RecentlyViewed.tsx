'use client';

// ==================== RECENTLY VIEWED PRODUCTS ====================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Product = { id: string; title?: string; price?: number; imageUrl?: string };
export function rememberProduct(id: string) { const ids = JSON.parse(localStorage.getItem('phdeals-recent') || '[]').filter((value: string) => value !== id); localStorage.setItem('phdeals-recent', JSON.stringify([id, ...ids].slice(0, 8))); }
export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => { const ids: string[] = JSON.parse(localStorage.getItem('phdeals-recent') || '[]').filter((id: string) => id !== excludeId); Promise.all(ids.map(async (id) => { const snap = await getDoc(doc(db, 'products', id)); return snap.exists() ? ({ id: snap.id, ...snap.data() } as Product) : null; })).then((items) => setProducts(items.filter(Boolean) as Product[])); }, [excludeId]);
  if (!products.length) return null;
  return <section className="mx-auto mt-8 max-w-6xl px-4"><h2 className="text-lg font-black">Recently Viewed</h2><div className="mt-3 flex gap-3 overflow-x-auto pb-2">{products.map((product) => <Link key={product.id} href={`/product/${product.id}`} className="w-32 shrink-0 overflow-hidden rounded-2xl bg-white p-2 shadow-sm">{product.imageUrl && <img src={product.imageUrl} alt="" className="h-24 w-full rounded-xl object-cover"/>}<p className="mt-2 line-clamp-2 text-[10px] font-black">{product.title}</p><p className="mt-1 text-xs font-black text-[#E1352B]">Rs. {Number(product.price || 0).toLocaleString()}</p></Link>)}</div></section>;
}
