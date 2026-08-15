'use client';

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { CheckCircle2, Loader2, Save, Tag } from 'lucide-react';
import { adminCollection, getAdminDocument, setAdminDocument, type Product } from './shared';
import type { DailyDeal, Weekday, WeeklyDeal } from '@/lib/types';

type DealDay = Weekday | 'big' | '';
type CardState = { day: DealDay; dealPrice: string; saving: boolean };

const DEAL_OPTIONS: Array<{ value: DealDay; label: string }> = [
  { value: '', label: 'None — Regular Product' },
  { value: 'monday', label: 'Monday Deal' },
  { value: 'tuesday', label: 'Tuesday Deal' },
  { value: 'wednesday', label: 'Wednesday Deal' },
  { value: 'thursday', label: 'Thursday Deal' },
  { value: 'friday', label: 'Friday Deal' },
  { value: 'saturday', label: 'Saturday Deal' },
  { value: 'sunday', label: 'Sunday Deal' },
  { value: 'big', label: 'Big Deal' },
];

const DAY_LABELS: Record<Exclude<DealDay, ''>, string> = {
  monday: 'Monday Deal', tuesday: 'Tuesday Deal', wednesday: 'Wednesday Deal', thursday: 'Thursday Deal',
  friday: 'Friday Deal', saturday: 'Saturday Deal', sunday: 'Sunday Deal', big: 'Big Deal',
};

function imageOf(product: Product) { return product.imageUrl || product.images?.[0] || ''; }
function normalPrice(product: Product) { return Number(product.originalPrice ?? product.price ?? 0); }
function emptyCard(): CardState { return { day: '', dealPrice: '', saving: false }; }

export default function DealScheduleManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [deals, setDeals] = useState<WeeklyDeal[]>([]);
  const [bigDeal, setBigDeal] = useState<DailyDeal | null>(null);
  const [cards, setCards] = useState<Record<string, CardState>>({});
  const [message, setMessage] = useState('');

  useEffect(() => onSnapshot(adminCollection('products'), snapshot => setProducts(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Product)), () => setProducts([])), []);
  useEffect(() => {
    getAdminDocument('settings', 'main').then(snapshot => {
      const data = snapshot.exists() ? snapshot.data() as { weeklyDeals?: WeeklyDeal[]; dailyDeal?: DailyDeal } : {};
      const weekly = Array.isArray(data.weeklyDeals) ? data.weeklyDeals : [];
      setDeals(weekly);
      setBigDeal(data.dailyDeal || null);
      const next: Record<string, CardState> = {};
      products.forEach(product => {
        const weeklyDeal = weekly.find(item => item.productId === product.id);
        const big = data.dailyDeal?.productId === product.id;
        next[product.id] = { day: big ? 'big' : (weeklyDeal?.day || ''), dealPrice: big ? String(data.dailyDeal?.dealPrice || '') : String(weeklyDeal?.dealPrice || ''), saving: false };
      });
      setCards(next);
    }).catch(() => undefined);
  }, [products.length]);

  const productList = useMemo(() => [...products].sort((a, b) => a.title.localeCompare(b.title)), [products]);
  const updateCard = (id: string, patch: Partial<CardState>) => setCards(current => ({ ...current, [id]: { ...(current[id] || emptyCard()), ...patch } }));

  async function saveDeal(product: Product) {
    const state = cards[product.id] || emptyCard();
    const regular = normalPrice(product);
    if (state.day && (!state.dealPrice || Number(state.dealPrice) <= 0)) { setMessage(`Enter a deal price for ${product.title}.`); return; }
    if (state.day && Number(state.dealPrice) >= regular) { setMessage(`${product.title}: deal price must be lower than Rs. ${regular.toLocaleString()}.`); return; }
    updateCard(product.id, { saving: true }); setMessage('');
    try {
      const snapshot = await getAdminDocument('settings', 'main');
      const data = snapshot.exists() ? snapshot.data() as { weeklyDeals?: WeeklyDeal[]; dailyDeal?: DailyDeal } : {};
      let nextWeekly = Array.isArray(data.weeklyDeals) ? [...data.weeklyDeals] : [];
      let nextBig = data.dailyDeal || null;

      // A product has one assignment at a time: remove its previous assignment first.
      nextWeekly = nextWeekly.filter(item => item.productId !== product.id && item.day !== state.day);
      if (nextBig?.productId === product.id) nextBig = null;

      if (state.day === 'big') {
        nextBig = { productId: product.id, imageUrl: imageOf(product), title: product.title, originalPrice: regular, dealPrice: Number(state.dealPrice), startAt: '', endAt: '', buttonText: 'Shop Big Deal', buttonLink: '/deals/big', active: true } as DailyDeal;
      } else if (state.day) {
        nextWeekly.push({ id: `weekly-${state.day}`, day: state.day, label: 'One Day Deal', productId: product.id, imageUrl: imageOf(product), title: product.title, originalPrice: regular, dealPrice: Number(state.dealPrice), startAt: '', endAt: '', buttonText: 'Shop Deal', buttonLink: `/product/${product.id}`, active: true });
      }

      await setAdminDocument('settings', 'main', { weeklyDeals: nextWeekly, dailyDeal: nextBig });
      setDeals(nextWeekly); setBigDeal(nextBig);
      setMessage(`${product.title}: ${state.day ? DAY_LABELS[state.day] : 'regular product'} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this deal.');
    } finally { updateCard(product.id, { saving: false }); }
  }

  return <section className="mx-auto max-w-7xl px-4 py-6">
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-[#0F6A5F]"><Tag size={16}/><span className="text-[10px] font-black uppercase tracking-[.22em]">Reward Store Style</span></div>
        <h2 className="mt-1 text-2xl font-black tracking-tight">One Day Deals</h2>
        <p className="mt-1 text-sm text-black/45">Assign a deal day directly to any product and save it independently.</p>
      </div>
      <span className="hidden rounded-full bg-white px-3 py-2 text-[10px] font-black text-black/45 shadow-sm ring-1 ring-black/5 sm:block">{productList.length} products</span>
    </div>

    {message && <div role="status" className="mb-5 flex items-center gap-2 rounded-2xl border border-[#0F6A5F]/10 bg-[#0F6A5F]/8 px-4 py-3 text-xs font-bold text-[#0F6A5F]"><CheckCircle2 size={16}/>{message}</div>}

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {productList.map(product => {
        const state = cards[product.id] || emptyCard();
        const regular = normalPrice(product);
        const invalid = Boolean(state.day && state.dealPrice && Number(state.dealPrice) >= regular);
        return <article key={product.id} className="overflow-hidden rounded-3xl border border-black/7 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="border-b border-black/5 bg-[#F8F8F5] p-3">
            <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[.16em] text-black/35">Assign Deal Day</label>
            <select value={state.day} onChange={e => updateCard(product.id, { day: e.target.value as DealDay })} className="w-full rounded-xl border border-black/8 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-[#0F6A5F]">
              {DEAL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div className="aspect-[4/3] w-full bg-[#F3F2ED] p-5">
            {imageOf(product) ? <img src={imageOf(product)} alt={product.title} className="h-full w-full rounded-2xl object-cover" loading="lazy"/> : <div className="flex h-full items-center justify-center rounded-2xl bg-white text-xs font-bold text-black/25">No product image</div>}
          </div>

          <div className="p-4">
            <h3 className="line-clamp-2 min-h-10 text-sm font-black leading-5">{product.title}</h3>
            <p className="mt-1 text-xs text-black/45">Normal: <span className="font-black text-black/70">Rs. {regular.toLocaleString()}</span></p>

            <label className="mt-4 mb-1.5 block text-[9px] font-black uppercase tracking-[.16em] text-black/35">Deal Price</label>
            <div className={`flex items-center rounded-xl border bg-[#F8F8F5] ${invalid ? 'border-red-400' : 'border-black/7'}`}>
              <span className="pl-3 text-xs font-black text-black/35">Rs.</span>
              <input type="number" min="1" value={state.dealPrice} onChange={e => updateCard(product.id, { dealPrice: e.target.value })} placeholder="2799" className="w-full bg-transparent px-2 py-3 text-sm font-black outline-none"/>
            </div>
            {invalid && <p className="mt-1 text-[10px] font-bold text-red-500">Must be below normal price.</p>}

            <button type="button" onClick={() => saveDeal(product)} disabled={state.saving || invalid} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-3 text-xs font-black text-white transition hover:bg-[#0F6A5F] disabled:cursor-not-allowed disabled:opacity-40">
              {state.saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} {state.saving ? 'Saving…' : 'Save Deal'}
            </button>
          </div>
        </article>;
      })}
    </div>

    {!productList.length && <div className="rounded-3xl border border-dashed border-black/10 bg-white p-12 text-center text-sm text-black/35">No products found.</div>}
  </section>;
}
