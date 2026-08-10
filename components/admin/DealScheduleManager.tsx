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

function pakistanDay(): Weekday {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toLowerCase() as Weekday;
}

export default function DealScheduleManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Row[]>(EMPTY_ROWS);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const today = pakistanDay();

  useEffect(() => onSnapshot(adminCollection('products'), (snapshot) => setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Product)), () => setProducts([])), []);
  useEffect(() => { getAdminDocument('settings', 'main').then((snapshot) => { const deals = snapshot.exists() ? ((snapshot.data().weeklyDeals || []) as WeeklyDeal[]) : []; setRows(DAYS.map(({ key }) => { const deal = deals.find((item) => item.day === key); return { day: key, productId: deal?.productId || '', dealPrice: deal?.dealPrice ? String(deal.dealPrice) : '', active: deal?.active ?? true }; })); }); }, []);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const updateRow = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setToast('');
    try {
      const weeklyDeals: WeeklyDeal[] = rows.filter((row) => row.productId && Number(row.dealPrice) > 0).map((row) => {
        const product = productMap.get(row.productId);
        const originalPrice = Number(product?.originalPrice || product?.price || 0);
        const dealPrice = Number(row.dealPrice);
        if (!product) throw new Error(`Missing product for ${row.day}`);
        if (dealPrice >= originalPrice) throw new Error(`${row.day}: deal price must be lower than the regular price.`);
        return { id: `weekly-${row.day}`, day: row.day, label: 'One Day Deal', productId: row.productId, imageUrl: product.imageUrl || product.images?.[0] || '', title: product.title || '', originalPrice, dealPrice, startAt: '', endAt: '', buttonText: 'Shop Deal', buttonLink: `/product/${row.productId}`, active: row.active };
      });
      await setAdminDocument('settings', 'main', { weeklyDeals });
      setToast('Weekly deal schedule saved. Future prices stay preview-only until their day starts (Pakistan time).');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Unable to save the weekly deal schedule.'); } finally { setSaving(false); }
  }

  return <section className="mx-auto max-w-6xl px-4 py-6">
    <div className="flex items-end justify-between gap-3"><div><div className="flex items-center gap-2"><CalendarClock size={20} className="text-[#D99A17]" /><h2 className="text-2xl font-black">One Day Deals</h2></div><p className="mt-1 text-sm text-black/55">Set one product and its special price for every day. Customers can preview future deals, but the special price becomes active only on that day in Pakistan.</p></div></div>
    <form onSubmit={save} className="mt-5 space-y-3">{rows.map((row, index) => { const label = DAYS.find((day) => day.key === row.day)?.label || row.day; const product = productMap.get(row.productId); const invalid = product && Number(row.dealPrice) >= Number(product.originalPrice || product.price || 0); const isToday = row.day === today; return <div key={row.day} className={`grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[120px_1fr_180px_90px] md:items-center ${isToday ? 'border-[#FFB020] shadow-[0_0_24px_rgba(255,176,32,0.12)]' : 'border-black/10'}`}><div><div className="flex items-center gap-2"><p className="text-sm font-black">{label}</p>{isToday && <span className="rounded-full bg-[#FFB020] px-2 py-0.5 text-[8px] font-black uppercase">Today</span>}</div><p className="text-[10px] uppercase tracking-wider text-black/40">{row.productId ? row.active ? isToday ? 'Active now' : 'Scheduled / preview' : 'Disabled' : 'No deal'}</p></div><select value={row.productId} onChange={(event) => updateRow(index, { productId: event.target.value })} className="rounded-xl bg-[#F4F4F1] p-3 text-sm"><option value="">No deal</option>{products.map((item) => <option key={item.id} value={item.id}>{item.title} — Rs. {Number(item.price).toLocaleString()}</option>)}</select><div><input type="number" min="1" value={row.dealPrice} onChange={(event) => updateRow(index, { dealPrice: event.target.value })} placeholder="Deal price" className={`w-full rounded-xl bg-[#F4F4F1] p-3 text-sm ${invalid ? 'ring-2 ring-[#E1352B]' : ''}`} />{invalid && <p className="mt-1 text-[9px] font-bold text-[#E1352B]">Must be below regular price.</p>}</div><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={row.active} onChange={(event) => updateRow(index, { active: event.target.checked })} /> Active</label></div>; })}<button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-3 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles size={15} />}{saving ? 'Saving...' : 'Save Weekly Deals'}</button></form>{toast && <div role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 size={16} />{toast}</div>}</section>;
}
