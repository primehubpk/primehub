'use client';

// ==================== PREDICTIVE LIVE SEARCH ====================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Product = { id: string; title?: string; name?: string; price?: number; imageUrl?: string; image?: string };
export default function LiveSearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => onSnapshot(collection(db, 'products'), (snap) => setProducts(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Product)))), []);
  const results = value.trim() ? products.filter((p) => (p.title || p.name || '').toLowerCase().includes(value.toLowerCase())).slice(0, 4) : [];
  return <div className="relative"><input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search products..." className="w-full bg-transparent text-sm outline-none" />{results.length > 0 && <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl bg-white shadow-xl">{results.map((product) => <Link key={product.id} href={`/product/${product.id}`} className="flex items-center gap-3 p-3 hover:bg-black/5"><img src={product.imageUrl || product.image || ''} alt="" className="h-10 w-10 rounded-lg object-cover"/><span className="min-w-0 flex-1 truncate text-xs font-bold">{product.title || product.name}</span><b className="text-xs text-[#E1352B]">Rs. {Number(product.price || 0).toLocaleString()}</b></Link>)}</div>}</div>;
}
