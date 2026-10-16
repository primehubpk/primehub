'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { onSnapshot } from 'firebase/firestore';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Loader2, Save, Search, Tag } from 'lucide-react';
import { adminCollection, getAdminDocument, setAdminDocument, type Category, type Product } from './shared';
import type { Weekday, WeeklyDeal } from '@/lib/types';
import { getPakistanDay } from '@/lib/dealPricing';

type DealDay = Weekday | '';
type CardState = { day: DealDay; dealPrice: string };
const DAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'monday', label: 'Monday' }, { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' }, { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' }, { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

function imageOf(product: Product | null | undefined): string {
  if (!product) return '';
  const image = product.images?.[0];
  if (typeof image === 'string') return image;
  if (image && typeof image === 'object' && typeof image.url === 'string') return image.url;
  return String(product.imageUrl || '');
}
function priceOf(product: Product) {
  // Regular selling price—not the crossed-out marketing comparison price.
  const price = Number(product.price ?? product.originalPrice ?? 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}
function keyOf(value: unknown) { return String(value || '').trim().toLowerCase(); }
function fromDeal(deal?: WeeklyDeal): CardState {
  return { day: deal?.day || '', dealPrice: deal?.dealPrice ? String(deal.dealPrice) : '' };
}

export default function DealScheduleManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [deals, setDeals] = useState<WeeklyDeal[]>([]);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [visibleCount, setVisibleCount] = useState(24);
  const [savingId, setSavingId] = useState('');
  const [settingsReady, setSettingsReady] = useState(false);
  const [message, setMessage] = useState('');
  const catalogRef = useRef<HTMLDivElement>(null);

  useEffect(() => onSnapshot(adminCollection('products'),
    snapshot => setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Product)),
    () => setMessage('Products could not load. Please refresh this page.')), []);
  useEffect(() => onSnapshot(adminCollection('categories'),
    snapshot => setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Category)),
    () => setCategories([])), []);
  useEffect(() => {
    let active = true;
    getAdminDocument('settings', 'main')
      .then(snapshot => {
        if (!active) return;
        const saved = snapshot.exists() ? snapshot.data() as { weeklyDeals?: WeeklyDeal[] } : {};
        setDeals(Array.isArray(saved.weeklyDeals) ? saved.weeklyDeals : []);
        setSettingsReady(true);
      })
      .catch(() => { if (active) setMessage('One Day Deals settings could not load. Refresh before editing.'); });
    return () => { active = false; };
  }, []);

  const productById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const currentDay = getPakistanDay().toLowerCase();
  const activeDeals = deals.filter(item => item.active !== false && item.productId);
  const assignedIds = new Set(deals.map(deal => deal.productId));
  const assignedByProduct = useMemo(() => {
    const lookup = new Map<string, WeeklyDeal>();
    deals.forEach(deal => { if (deal.productId) lookup.set(deal.productId, deal); });
    return lookup;
  }, [deals]);

  // Categories are sourced from the Admin catalog; product category strings are
  // added only when needed so category filters work with both old and new items.
  const categoryItems = useMemo(() => {
    const known = new Map<string, { id: string; title: string; aliases: string[] }>();
    categories.filter(category => category.active !== false).forEach(category => {
      known.set(keyOf(category.id), {
        id: category.id, title: category.title || category.slug || category.id,
        aliases: [category.id, category.slug || '', category.title || ''].map(keyOf),
      });
    });
    for (const product of products) {
      const category = String(product.category || '').trim();
      const categoryId = String(product.categoryId || '').trim();
      const matching = [...known.values()].some(item => item.aliases.includes(keyOf(category)) || item.aliases.includes(keyOf(categoryId)));
      if (!matching && category) known.set(keyOf(category), { id: category, title: category, aliases: [keyOf(category), keyOf(categoryId)] });
    }
    return [...known.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [categories, products]);

  const filteredProducts = useMemo(() => {
    const category = categoryItems.find(item => item.id === activeCategory);
    const text = keyOf(search);
    return [...products].filter(product => {
      if (category && !category.aliases.includes(keyOf(product.category)) &&
        !category.aliases.includes(keyOf(product.categoryId))) return false;
      if (filterDay && !deals.some(deal => deal.day === filterDay && deal.productId === product.id)) return false;
      if (text && !keyOf(product.title).includes(text) && !keyOf(product.id).includes(text)) return false;
      return true;
    }).sort((a, b) => Number(assignedIds.has(b.id)) - Number(assignedIds.has(a.id)) ||
      String(a.title || '').localeCompare(String(b.title || '')));
  }, [products, categoryItems, activeCategory, filterDay, search, deals, assignedIds]);

  const shownProducts = filteredProducts.slice(0, visibleCount);

  function updateCard(productId: string, patch: Partial<CardState>) {
    setCards(current => ({
      ...current,
      [productId]: { ...(current[productId] || fromDeal(assignedByProduct.get(productId))), ...patch },
    }));
  }

  function focusDay(day: Weekday) {
    const existing = deals.find(deal => deal.day === day && deal.productId);
    setActiveCategory('');
    // An empty day must show products available for assignment, not a blank list.
    setFilterDay(existing ? day : '');
    setSearch('');
    setVisibleCount(24);
    if (!existing) {
      setMessage(`No ${day} deal is configured. Choose any category and product below, select ${day}, then Save deal.`);
    } else setMessage('');
    window.setTimeout(() => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }

  async function saveDeal(product: Product) {
    if (!settingsReady || savingId) return;
    const currentDeal = assignedByProduct.get(product.id);
    const state = cards[product.id] || fromDeal(currentDeal);
    const regular = priceOf(product), special = Number(state.dealPrice);
    if (state.day && (!Number.isSafeInteger(special) || special <= 0 || special >= regular)) {
      setMessage(`For ${product.title}, enter a deal price less than the regular price Rs. ${regular.toLocaleString()}.`);
      return;
    }
    if (state.day) {
      const occupant = deals.find(deal => deal.day === state.day && deal.productId !== product.id);
      if (occupant && !window.confirm(`Replace ${occupant.title || 'the current product'} on ${state.day}? The other six deals will stay unchanged.`)) return;
    }
    setSavingId(product.id);
    setMessage('');
    try {
      // Refresh immediately before writing and change only weeklyDeals. The
      // independent seven-slot Big Deal rotation must never be reset here.
      const snapshot = await getAdminDocument('settings', 'main');
      if (!snapshot.exists()) throw new Error('Settings not available. Please retry.');
      const saved = snapshot.data() as { weeklyDeals?: WeeklyDeal[] };
      let next = Array.isArray(saved.weeklyDeals) ? saved.weeklyDeals : [];
      next = next.filter(deal => deal.productId !== product.id && (!state.day || deal.day !== state.day));
      if (state.day) {
        next.push({
          id: `weekly-${state.day}`, day: state.day, label: 'One Day Deal',
          productId: product.id, imageUrl: imageOf(product), title: product.title,
          originalPrice: regular, dealPrice: special,
          startAt: '', endAt: '', buttonText: 'Shop Deal',
          buttonLink: `/product/${product.id}`, active: true,
        });
      }
      await setAdminDocument('settings', 'main', { weeklyDeals: next });
      setDeals(next);
      setCards(current => ({ ...current, [product.id]: fromDeal(next.find(item => item.productId === product.id)) }));
      setMessage(`${product.title}: ${state.day ? state.day + ' deal' : 'deal removed'} saved. Big Deal rotation unchanged.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save deal. Try again.');
    } finally { setSavingId(''); }
  }

  return <section className="mx-auto max-w-7xl px-3 py-5 sm:px-6">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-[#0F6A5F]"><CalendarDays size={16}/> One Day Deals Manager</span><h2 className="mt-1 text-2xl font-black">7 days. 7 deal slots.</h2><p className="mt-1 max-w-xl text-xs leading-5 text-black/50">Tap a day to see its product below. The live day uses its special price; future days keep regular prices until their day.</p></div>
      <Link href="/admin/big-deal" className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-black text-amber-950">Big Deal rotation <ArrowRight size={14}/></Link>
    </header>
    {message && <p role="status" className="mb-4 rounded-xl border border-[#0F6A5F]/20 bg-[#E8F7F3] px-4 py-3 text-xs font-bold text-[#0F6A5F]">{message}</p>}

    <div className="rounded-[26px] border border-[#C9DDCF] bg-gradient-to-b from-[#EFF8F3] to-white p-3 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black">Weekly schedule</h3><span className="rounded-full bg-[#0F6A5F] px-3 py-1.5 text-[10px] font-bold text-white">{activeDeals.length}/7 configured · Pakistan time</span></div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {DAYS.map(({ key, label }) => {
          const deal = deals.find(item => item.day === key && item.active !== false);
          const product = deal ? productById.get(deal.productId) : null;
          const picture = imageOf(product) || deal?.imageUrl || '';
          const isLive = Boolean(deal && key === currentDay);
          return <button type="button" key={key} onClick={() => focusDay(key)}
            aria-label={`View ${label} deal`} aria-pressed={filterDay === key}
            className={`min-w-0 overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F6A5F] ${filterDay===key?'border-[#0F6A5F] ring-2 ring-[#0F6A5F]/20':isLive?'border-emerald-500':'border-black/10'}`}>
            <span className="flex items-center justify-between gap-1 px-2 py-1.5 text-[9px] font-black sm:text-xs"><span className="truncate">{label}</span><span className={`shrink-0 rounded px-1 py-0.5 text-[7px] ${isLive?'bg-emerald-100 text-emerald-700':'bg-[#F1F1EB] text-black/45'}`}>{isLive?'LIVE':deal?'SET':'—'}</span></span>
            <span className="relative block aspect-square overflow-hidden bg-[#F2F3EE]">{picture ? <img src={picture} loading="lazy" alt="" className="h-full w-full object-cover"/> : <span className="flex h-full items-center justify-center text-[9px] font-bold text-black/30">Not set</span>}</span>
            <span className="block px-2 py-2"><span className="block truncate text-[9px] font-semibold text-black/70" title={deal?.title || ''}>{deal?.title || 'Choose product'}</span><span className="mt-0.5 block text-[10px] font-black text-[#0F6A5F]">{deal ? `Rs. ${Number(deal.dealPrice).toLocaleString()}` : 'No deal'}</span></span>
          </button>;
        })}
      </div>
      <p className="mt-3 text-[10px] text-black/50">First row: Monday–Thursday (4). Second row: Friday–Sunday (3). A grey SET label means scheduled; LIVE is today’s active deal only.</p>
    </div>

    <div ref={catalogRef} className="mt-6 scroll-mt-20 rounded-[26px] bg-white p-3 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><Tag size={15} className="text-[#0F6A5F]"/><h3 className="text-lg font-black">Choose a category</h3></div><p className="mt-1 text-[11px] text-black/45">Category select karein, neeche sirf uske products nazar aayenge.</p></div><span className="text-[11px] font-bold text-black/40">{filteredProducts.length} products</span></div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
        <button type="button" onClick={() => {setActiveCategory('');setFilterDay('');setVisibleCount(24);}} aria-pressed={!activeCategory&&!filterDay} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${!activeCategory&&!filterDay?'bg-[#0F6A5F] text-white':'bg-[#F2F1EC] text-black/70'}`}>All products</button>
        {categoryItems.map(item => <button key={item.id} type="button"
          onClick={() => {setActiveCategory(item.id);setFilterDay('');setSearch('');setVisibleCount(24);}} aria-pressed={activeCategory===item.id}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${activeCategory===item.id?'bg-[#0F6A5F] text-white':'bg-[#F2F1EC] text-black/70'}`}>{item.title}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="relative block min-w-0 flex-1"><Search size={15} className="absolute left-3 top-3 text-black/35"/><input value={search} onChange={event=>{setSearch(event.target.value);setVisibleCount(24);}} placeholder="Search products or ID" className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#0F6A5F]"/></label>
        {filterDay && <button type="button" onClick={()=>setFilterDay('')} className="rounded-xl bg-amber-100 px-4 py-2.5 text-xs font-bold text-amber-900">{filterDay} ×</button>}
      </div>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
      {shownProducts.map(product => {
        const saved = assignedByProduct.get(product.id);
        const state = cards[product.id] || fromDeal(saved);
        const regular = priceOf(product);
        const invalid = Boolean(state.day && (!state.dealPrice || Number(state.dealPrice) <= 0 || Number(state.dealPrice) >= regular));
        return <article key={product.id} className="min-w-0 overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-sm">
          <div className="relative aspect-square overflow-hidden bg-[#F3F2ED]">{imageOf(product) ? <img src={imageOf(product)} alt={product.title} loading="lazy" className="h-full w-full object-cover"/> : <span className="flex h-full items-center justify-center text-xs text-black/35">No image</span>}{saved && <span className="absolute left-2 top-2 rounded-full bg-[#0F6A5F] px-2 py-1 text-[8px] font-bold text-white">{saved.day.toUpperCase()} DEAL</span>}</div>
          <div className="p-3">
            <h4 className="line-clamp-2 min-h-9 text-xs font-extrabold sm:text-sm">{product.title}</h4><p className="mt-1 text-[11px] font-black text-[#0F6A5F]">Regular Rs. {regular.toLocaleString()}</p>
            <label className="mt-3 block text-[10px] font-bold text-black/50">Assign day</label>
            <div className="relative"><select value={state.day} onChange={event=>updateCard(product.id,{day:event.target.value as DealDay})} className="mt-1 w-full appearance-none rounded-xl border border-black/10 bg-white p-2.5 pr-6 text-[11px] font-bold focus:border-[#0F6A5F] focus:outline-none"><option value="">No deal</option>{DAYS.map(({key,label})=><option key={key} value={key}>{label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2 top-3.5 text-black/40"/></div>
            <label className="mt-3 block text-[10px] font-bold text-black/50">Special price (Rs.)<input type="number" min="1" step="1" value={state.dealPrice} onChange={event=>updateCard(product.id,{dealPrice:event.target.value})} disabled={!state.day} placeholder="Deal price" className={`mt-1 block w-full rounded-xl border bg-white px-3 py-2.5 text-xs font-bold focus:outline-none ${invalid?'border-red-400':'border-black/10'}`}/></label>
            <button type="button" disabled={Boolean(savingId)||!settingsReady||invalid||(!state.day&&!saved)}
              onClick={()=>void saveDeal(product)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F6A5F] px-3 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {savingId===product.id?<Loader2 size={14} className="animate-spin"/>:state.day?<Save size={14}/>:<CheckCircle2 size={14}/>}
              {savingId===product.id?'Saving…':!state.day?'Remove deal':'Save deal'}
            </button>
          </div>
        </article>;
      })}
    </div>
    {!filteredProducts.length && <p className="mt-4 rounded-2xl bg-white p-6 text-center text-xs text-black/50">No products for these filters.</p>}
    {filteredProducts.length > visibleCount && <div className="mt-5 text-center"><button type="button" onClick={()=>setVisibleCount(value=>value+24)} className="rounded-xl bg-[#14140F] px-6 py-3 text-xs font-black text-white">Show more products ({filteredProducts.length-visibleCount} remaining)</button></div>}
  </section>;
}
