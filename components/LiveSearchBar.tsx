'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { smartSearchProducts } from '@/lib/smartSearch';

type Product = {
  id: string;
  title?: string;
  name?: string;
  price?: number;
  imageUrl?: string;
  image?: string;
  category?: string;
  categoryId?: string;
  description?: string;
  tags?: string[] | string;
  keywords?: string[] | string;
  published?: boolean;
};

type Props = { value: string; onChange: (value: string) => void; className?: string };

export default function LiveSearchBar({ value, onChange, className = '' }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => onSnapshot(
    collection(db, 'products'),
    (snap) => setProducts(snap.docs.map((item) => ({ id: item.id, ...item.data() } as Product)).filter((p) => p.published !== false)),
    () => setProducts([]),
  ), []);

  const results = useMemo(() => {
    const query = value.trim();
    if (!query) return [];
    return smartSearchProducts(products, query).slice(0, 6);
  }, [products, value]);

  const showPanel = focused && value.trim().length > 0;

  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        autoComplete="off"
        spellCheck="false"
        aria-label="Search products"
        placeholder="Search products, categories..."
        className="block w-full min-w-0 bg-transparent text-sm outline-none"
      />
      {showPanel && (
        <div className="absolute left-[-36px] right-[-42px] top-full z-[70] mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_18px_55px_rgba(20,20,15,0.18)] sm:left-0 sm:right-0">
          {results.length > 0 ? (
            <>
              <div className="border-b border-black/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-black/40">Suggestions</div>
              {results.map((product) => (
                <Link key={product.id} href={`/product/${product.id}`} className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-black/[0.04]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F4F4F1]">
                    {product.imageUrl || product.image ? <img src={product.imageUrl || product.image || ''} alt="" className="h-full w-full object-cover" /> : <Search size={15} className="text-black/25" />}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-[#14140F]">{product.title || product.name}</span>
                    {product.category && <span className="mt-0.5 block truncate text-[9px] font-bold text-black/40">{product.category}</span>}
                  </span>
                  <b className="shrink-0 text-xs text-[#E1352B]">Rs. {Number(product.price || 0).toLocaleString()}</b>
                </Link>
              ))}
              <Link href={`/shop?q=${encodeURIComponent(value.trim())}`} className="flex items-center justify-center gap-2 border-t border-black/5 bg-[#FAF9F6] px-3 py-3 text-[10px] font-black uppercase tracking-[0.09em] text-[#0F6A5F]">
                <Search size={13} /> View all results
              </Link>
            </>
          ) : (
            <div className="px-4 py-4 text-center">
              <p className="text-xs font-black text-[#14140F]">No exact suggestion yet</p>
              <p className="mt-1 text-[10px] text-black/45">Press search to see all matching results.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
