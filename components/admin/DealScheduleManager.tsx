'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { CalendarClock, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { adminCollection, getAdminDocument, setAdminDocument, type Product } from './shared';
import type { Weekday, WeeklyDeal } from '@/lib/types';

const DAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'monday', label: 'Monday' }, { key: 'tuesday', label: 'Tuesday' }, { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' }, { key: 'friday', label: 'Friday' }, { key: 'saturday', label: 'Saturday' }, { key: 'sunday', label: 'Sunday' },
];
type Row = { day: Weekday; productId: string; dealPrice: string; active: boolean };
const EMPTY_ROWS = DAYS.map(({ key }) => ({ day: key, productId: '', dealPrice: '', active: true }));
function pakistanDay(): Weekday { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase() as Weekday; }
function imageOf(product?: Product) { return product?.imageUrl || product?.images?.[0] || ''; }

export default function DealScheduleManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Row[]>(EMPTY_ROWS);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const today = pakistanDay();
  useEffect(() => onSnapshot(adminCollection('products'), snapshot => setProducts(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Product)), () => setProducts([])), []);
  useEffect(() => { getAdminDocument('settings', 'main').then(snapshot => { const deals = snapshot.exists() ? ((snapshot.data().weeklyDeals || []) as WeeklyDeal[]) : []; setRows(DAYS.map(({ key }) => { const deal = deals.find(item => item.day === key); return { day: key, productId: deal?.productId || '', dealPrice: deal?.dealPrice ? String(deal.dealPrice) : '', active: deal?.active ?? true }; })); }).catch(() => setRows(EMPTY_ROWS)); }, []);
  const productMap = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const updateRow = (index: number, patch: Partial<Row>) => setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setToast('');
    try {
      const weeklyDeals: WeeklyDeal[] = rows.filter(row => row.productId && Number(row.dealPrice) > 0).map(row => {
        const product = productMap.get(row.productId); const originalPrice = Number((product as any)?.originalPrice || product?.price || 0); const dealPrice = Number(row.dealPrice);
        if (!product) throw new Error(`Missing product for ${row.day}`); if (dealPrice >= originalPrice) throw new Error(`${row.day}: deal price must be lower than the regular price.`);
        return { id: `weekly-${row.day}`, day: row.day, label: 'One Day Deal', productId: row.productId, imageUrl: imageOf(product), title: product.title || '', originalPrice, dealPrice, startAt: '', endAt: '', buttonText: 'Shop Deal', buttonLink: `/product/${row.productId}`, active: row.active };
      });
      await setAdminDocument('settings', 'main', { weeklyDeals });
      setToast('One Day Deals schedule saved successfully.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Unable to save the weekly deal schedule.'); }
    finally { setSaving(false); }
  }
  return <section className="mx-auto max-w-6xl px-4 py-6">
    <div className="flex items-end justify-between gap-3"><div><div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF4D6]"><CalendarClock size={20} className="text-[#D99A17]" /></span><div><h2 className="text-2xl font-black">One Day Deals</h2><p className="mt-1 text-sm text-black/50">Manage Monday–Sunday offers with product visuals, regular pricing and scheduled status.</p></div></div></div></div>
    <form onSubmit={save} className="mt-5 grid gap-3 sm:grid-cols-2">
      {rows.map((row, index) => { const label = DAYS.find(day => day.key === row.day)?.label || row.day; const product = productMap.get(row.productId); const normal = Number((product as any)?.originalPrice || product?.price || 0); const invalid = Boolean(product && row.dealPrice && Number(row.dealPrice) >= normal); const isToday = row.day === today; return <article key={row.day} className={`rounded-3xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${isToday ? 'border-[#FFB020] ring-1 ring-[#FFB020]/20' : 'border-black/8'}`}>
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-black/35">{label}</p><div className="mt-1 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${row.active && row.productId ? 'bg-[#0F6A5F]' : 'bg-black/15'}`}/><span className="text-xs font-bold text-black/55">{isToday ? 'Today' : row.active && row.productId ? 'Scheduled' : 'Inactive'}</span></div></div><label className="flex cursor-pointer items-center gap-2 text-[10px] font-black"><span>{row.active ? 'Active' : 'Off'}</span><input type="checkbox" checked={row.active} onChange={e => updateRow(index, { active: e.target.checked })} className="sr-only"/><span className={`relative h-6 w-11 rounded-full p-1 transition ${row.active ? 'bg-[#0F6A5F]' : 'bg-black/15'}`}><span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${row.active ? 'translate-x-5' : ''}`}/></span></label></div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#F8F8F5] p-3">{product ? <img src={imageOf(product)} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-black/5"/> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-black/15"><CalendarClock size={20}/></div>}<div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{product?.title || 'No product selected'}</p>{product ? <p className="mt-1 text-[11px] text-black/45">Normal: <b className="text-black/70">Rs. {normal.toLocaleString()}</b></p> : <p className="mt-1 text-[10px] text-black/35">Choose a product below</p>}</div></div>
        <div className="mt-3"><label className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/35">Product</label><select value={row.productId} onChange={e => updateRow(index, { productId: e.target.value, dealPrice: '' })} className="w-full rounded-xl border border-black/8 bg-white p-3 text-xs font-semibold"><option value="">No deal</option>{products.map(item => <option key={item.id} value={item.id}>{item.title} — Rs. {Number((item as any).originalPrice || item.price || 0).toLocaleString()}</option>)}</select></div>
        <div className="mt-3"><label className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/35">Deal Price</label><div className={`flex items-center rounded-xl border bg-white ${invalid ? 'border-[#E1352B]' : 'border-black/8'}`}><span className="pl-3 text-xs font-black text-black/35">Rs.</span><input type="number" min="1" value={row.dealPrice} onChange={e => updateRow(index, { dealPrice: e.target.value })} placeholder="2,799" className="w-full bg-transparent p-3 text-sm font-black outline-none"/></div>{invalid && <p className="mt-1 text-[9px] font-bold text-[#E1352B]">Deal price must be below normal price.</p>}</div>
      </article>; })}
      <button type="submit" disabled={saving} className="sm:col-span-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14140F] py-4 text-sm font-black text-white shadow-sm disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles size={15}/>} {saving ? 'Saving…' : 'Save One Day Deals'}</button>
    </form>{toast && <div role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 size={16}/>{toast}</div>}
  </section>;
}
