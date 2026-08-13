'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs } from 'firebase/firestore';
import { Search, SlidersHorizontal, X, ChevronRight, ShoppingBag, Check } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useSettings } from '@/lib/useSettings';
import { useCartStore } from '@/lib/cartStore';

type Product = {
  id: string;
  title?: string;
  name?: string;
  price?: number;
  compareAtPrice?: number;
  originalPrice?: number;
  imageUrl?: string;
  image?: string;
  images?: string[];
  category?: string;
  categoryId?: string;
  isFlashSale?: boolean;
  stock?: number;
  quantity?: number;
  [key: string]: any;
};

type Category = {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  iconUrl?: string;
  imageUrl?: string;
  image?: string;
  [key: string]: any;
};

function titleOf(p: Product) {
  return p.title || p.name || '';
}
function imageOf(p: Product) {
  return p.imageUrl || p.image || p.images?.[0] || '';
}
function priceOf(p: Product) {
  return Number(p.price || 0);
}
function originalOf(p: Product) {
  return Number(p.compareAtPrice ?? p.originalPrice ?? 0);
}
function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function ShopCatalog({
  initialCategory,
  initialQuery = '',
}: {
  initialCategory?: string;
  initialQuery?: string;
}) {
  const { settings } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory || 'all');
  const [maxPrice, setMaxPrice] = useState('all');
  const [onlyDeals, setOnlyDeals] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [productSnap, categorySnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'categories')),
        ]);
        if (cancelled) return;
        setProducts(productSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product)));
        setCategories(categorySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Category)));
      } finally {
        if (!cancelled) setFiltersOpen(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const buckets = useMemo(
    () => [...(settings.priceBuckets || [])].filter((bucket) => bucket.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [settings.priceBuckets]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const title = titleOf(p).toLowerCase();
      const cat = String(p.category || '').toLowerCase();
      const catId = String(p.categoryId || '').toLowerCase();
      const matchesSearch = !q || title.includes(q) || cat.includes(q) || catId.includes(q);
      const selectedCat = category === 'all' || cat === category.toLowerCase() || catId === category.toLowerCase() || slugify(cat) === category.toLowerCase();
      const price = priceOf(p);
      const matchesPrice = maxPrice === 'all' || price <= Number(maxPrice);
      const matchesDeal = !onlyDeals || Boolean(p.isFlashSale);
      return matchesSearch && selectedCat && matchesPrice && matchesDeal;
    });
  }, [products, search, category, maxPrice, onlyDeals]);

  const addProduct = (product: Product) => {
    const image = imageOf(product);
    addItem({
      id: product.id,
      name: titleOf(product),
      price: priceOf(product),
      originalPrice: originalOf(product) || priceOf(product),
      image,
      imageUrl: image,
    });
    setAddedId(product.id);
    window.setTimeout(() => setAddedId((current) => current === product.id ? null : current), 1400);
  };

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6">
        <div className="rounded-[28px] bg-white p-5 shadow-[0_12px_40px_rgba(20,20,15,0.07)] ring-1 ring-black/5 md:p-7">
          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#E1352B]">PrimeHub Picks</p>
          <div className="mt-1 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#14140F] md:text-4xl">Discover deals</h1>
              <p className="mt-1 max-w-xl text-xs leading-5 text-black/45">Browse live products and prices from your PrimeHub store.</p>
            </div>
            <span className="rounded-full bg-[#F8F7F3] px-3 py-1.5 text-[9px] font-black text-black/50">{filtered.length} products</span>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-[#F8F7F3] px-3 py-2.5 ring-1 ring-black/5">
            <Search size={17} className="shrink-0 text-black/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products or categories..." className="min-w-0 flex-1 bg-transparent py-2 text-xs font-bold text-[#14140F] outline-none placeholder:text-black/30" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={16} className="text-black/30" /></button>}
          </div>
        </div>

        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between">
            <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Smart shopping</p><h2 className="mt-0.5 text-base font-black text-[#14140F]">Shop by budget</h2></div>
            {maxPrice !== 'all' && <button type="button" onClick={() => setMaxPrice('all')} className="rounded-full bg-white px-3 py-1.5 text-[9px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5">Clear</button>}
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {buckets.map((bucket) => {
              const selected = maxPrice === String(bucket.amount);
              return <button key={bucket.id} type="button" onClick={() => setMaxPrice(selected ? 'all' : String(bucket.amount))} className={`relative min-w-[150px] shrink-0 overflow-hidden rounded-[22px] border p-3.5 text-left transition active:scale-[0.98] ${selected ? 'border-[#0F6A5F] bg-[#0F6A5F] text-white shadow-[0_14px_34px_rgba(15,106,95,0.18)]' : 'border-black/6 bg-white text-[#14140F] shadow-[0_10px_28px_rgba(20,20,15,0.06)]'}`}>
                <div className="flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider ${selected ? 'bg-white/12 text-white' : 'bg-[#FFF4F2] text-[#E1352B]'}`}>{bucket.title}</span><span className={`text-[9px] font-black ${selected ? 'text-white/70' : 'text-black/35'}`}>≤ Rs. {Number(bucket.amount).toLocaleString()}</span></div>
                <div className="mt-4 flex items-end justify-between gap-3"><div><p className={`text-[9px] font-bold ${selected ? 'text-white/60' : 'text-black/40'}`}>Best finds</p><p className="mt-0.5 text-lg font-black">Rs. {Number(bucket.amount).toLocaleString()}</p></div><ChevronRight className={`h-5 w-5 ${selected ? 'text-white/70' : 'text-black/20'}`} /></div>
              </button>;
            })}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">Browse the collection</p><h2 className="mt-0.5 text-base font-black text-[#14140F]">Shop by Category</h2></div><Link href="/category" className="flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-black text-[#0F6A5F] shadow-sm ring-1 ring-black/5">View all <ChevronRight size={14} /></Link></div>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
            {categories.map((cat) => {
              const value = cat.slug || slugify(cat.name || cat.title || cat.id);
              const label = cat.name || cat.title || cat.id;
              const icon = cat.iconUrl || cat.imageUrl || cat.image;
              const selected = category === value;
              return <button key={cat.id} type="button" onClick={() => setCategory(selected ? 'all' : value)} className="flex w-[78px] shrink-0 flex-col items-center gap-1.5 text-center"><span className={`flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-[22px] border bg-white p-1 shadow-[0_8px_22px_rgba(20,20,15,0.06)] ${selected ? 'border-[#0F6A5F] ring-2 ring-[#0F6A5F]/15' : 'border-black/6'}`}>{icon ? <img src={icon} alt={label} className="h-full w-full rounded-[18px] object-cover" /> : <span className="text-xl font-black text-[#0F6A5F]">{label.charAt(0)}</span>}</span><span className={`line-clamp-2 text-[10px] font-bold leading-3.5 ${selected ? 'text-[#0F6A5F]' : 'text-black/70'}`}>{label}</span></button>;
            })}
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-2"><button type="button" onClick={() => setFiltersOpen(true)} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[10px] font-black shadow-sm ring-1 ring-black/5"><SlidersHorizontal size={14} /> Filters</button><button type="button" onClick={() => setOnlyDeals((v) => !v)} className={`rounded-2xl px-4 py-3 text-[10px] font-black shadow-sm ring-1 ring-black/5 ${onlyDeals ? 'bg-[#E1352B] text-white' : 'bg-white text-[#14140F]'}`}>Flash deals only</button></div>

        <section className="mt-4">
          {filtered.length === 0 ? (
            <div className="rounded-[28px] bg-white p-10 text-center shadow-sm ring-1 ring-black/5"><h2 className="text-base font-black">No products found</h2><p className="mt-1 text-xs text-black/40">Try another search or clear the filters.</p></div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {filtered.map((product) => {
                const price = priceOf(product);
                const original = originalOf(product);
                const discount = original > price && price > 0 ? Math.round(((original - price) / original) * 100) : 0;
                const image = imageOf(product);
                const stock = Number(product.stock ?? product.quantity ?? 0);
                const unavailable = stock <= 0;
                const added = addedId === product.id;
                return (
                  <article key={product.id} className="group overflow-hidden rounded-[22px] border border-black/6 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                    <Link href={`/product/${product.id}`} className="block">
                      <div className="relative aspect-square overflow-hidden bg-[#F4F4F1]">
                        {image ? <img src={image} alt={titleOf(product)} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-[10px] font-bold text-black/25">No image</div>}
                        {discount > 0 && <span className="absolute left-2 top-2 rounded-full bg-[#E1352B] px-2 py-1 text-[8px] font-black text-white">-{discount}%</span>}
                        {product.isFlashSale && <span className="absolute right-2 top-2 rounded-full bg-[#14140F] px-2 py-1 text-[8px] font-black text-white">FLASH</span>}
                      </div>
                      <div className="p-3 pb-1"><p className="line-clamp-2 min-h-[30px] text-[11px] font-black leading-4">{titleOf(product)}</p><div className="mt-2 flex flex-wrap items-end gap-1.5"><span className="font-[family-name:var(--font-mono)] text-sm font-black text-[#E1352B]">Rs. {price.toLocaleString()}</span>{original > price && <span className="text-[9px] text-black/30 line-through">Rs. {original.toLocaleString()}</span>}</div></div>
                    </Link>
                    <div className="px-3 pb-3 pt-2">
                      <button type="button" disabled={unavailable} onClick={() => addProduct(product)} className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[9px] font-black transition active:scale-[0.98] ${unavailable ? 'cursor-not-allowed bg-black/5 text-black/25' : added ? 'bg-[#0F6A5F] text-white' : 'bg-[#14140F] text-white hover:bg-[#E1352B]'}`}>
                        {unavailable ? 'Unavailable' : added ? <><Check size={13} />Added to Cart</> : <><ShoppingBag size={13} />Add to Cart</>}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[100]"><button type="button" className="absolute inset-0 bg-black/50" onClick={() => setFiltersOpen(false)} aria-label="Close filters" /><div className="absolute bottom-0 left-0 right-0 rounded-t-[30px] bg-white p-5 shadow-2xl md:left-1/2 md:right-auto md:top-1/2 md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[30px]"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Refine</p><h2 className="mt-1 text-lg font-black">Shop Filters</h2></div><button type="button" onClick={() => setFiltersOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F1]"><X size={15} /></button></div><div className="mt-6"><p className="text-[10px] font-black uppercase tracking-wider text-black/40">Price</p><div className="mt-2 grid grid-cols-4 gap-2">{[['all','Any'],['99','Under 99'],['499','Under 499'],['999','Under 999']].map(([value,label]) => <button key={value} type="button" onClick={() => setMaxPrice(value)} className={`rounded-2xl px-2 py-3 text-[9px] font-black ${maxPrice === value ? 'bg-[#14140F] text-white' : 'bg-[#F4F4F1] text-[#14140F]'}`}>{label}</button>)}</div></div><button type="button" onClick={() => setOnlyDeals((v) => !v)} className={`mt-4 flex w-full items-center justify-between rounded-2xl p-4 text-left ${onlyDeals ? 'bg-[#E1352B] text-white' : 'bg-[#F4F4F1] text-[#14140F]'}`}><span><span className="block text-[11px] font-black">Flash Deals only</span><span className="mt-0.5 block text-[9px] opacity-60">Show products marked as flash sales</span></span><span className="text-[10px] font-black">{onlyDeals ? 'ON' : 'OFF'}</span></button><button type="button" onClick={() => { setSearch(''); setCategory('all'); setMaxPrice('all'); setOnlyDeals(false); setFiltersOpen(false); }} className="mt-4 w-full rounded-full bg-[#14140F] py-3 text-[10px] font-black text-white">Clear all filters</button></div></div>
      )}
    </main>
  );
}
