'use client';

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import RewardsManager from './RewardsManager';
import { adminCollection, type Category, type Product } from './shared';

export default function RewardsManagerCatalogBridge() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState('');

  useEffect(() => {
    const stopProducts = onSnapshot(adminCollection('products'), snapshot => {
      setProducts(snapshot.docs.map(row => ({ id: row.id, ...row.data() }) as Product));
    });
    const stopCategories = onSnapshot(adminCollection('categories'), snapshot => {
      setCategories(snapshot.docs.map(row => ({ id: row.id, ...row.data() }) as Category));
    });
    return () => { stopProducts(); stopCategories(); };
  }, []);

  const categoryOptions = useMemo(() => {
    const byId = new Map(categories.map(item => [item.id, item.title]));
    const values = new Map<string, string>();
    products.forEach(product => {
      const raw = String(product.category || '').trim();
      if (!raw) return;
      values.set(raw, byId.get(raw) || raw);
    });
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [categories, products]);

  const filteredProducts = useMemo(() => category ? products.filter(product => String(product.category || '').trim() === category) : [], [category, products]);

  return (
    <>
      <section className="mx-auto mt-4 max-w-6xl px-4 md:px-6">
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#E1352B]">Free Product Picker</p>
          <h3 className="mt-1 text-sm font-black">1. Select category → 2. Select product inside the prize slot</h3>
          <select value={category} onChange={event => setCategory(event.target.value)} className="mt-3 w-full rounded-xl border border-black/10 bg-[#F7F7F2] px-3 py-3 text-xs font-black outline-none">
            <option value="">Select category first</option>
            {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="mt-2 text-[10px] font-bold text-black/40">{category ? `${filteredProducts.length} product(s) available in this category.` : `${products.length} products loaded. Choose a category to show only its products.`}</p>
        </div>
      </section>
      <RewardsManager products={filteredProducts} />
    </>
  );
}
