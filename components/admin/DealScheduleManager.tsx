'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { adminCollection, getAdminDocument, setAdminDocument, type Product } from './shared';
import type { Weekday, WeeklyDeal } from '@/lib/types';

const DAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'monday', label: 'Monday' }, { key: 'tuesday', label: 'Tuesday' }, { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' }, { key: 'friday', label: 'Friday' }, { key: 'saturday', label: 'Saturday' }, { key: 'sunday', label: 'Sunday' },
];
type Row = { day: Weekday; productId: string; dealPrice: string; active: boolean };
const EMPTY_ROWS = DAYS.map(({ key }) => ({ day: key, productId: '', dealPrice: '', active: true }));

export default function DealScheduleManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Row[]>(EMPTY_ROWS);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => onSnapshot(adminCollection('products'), (snapshot) => setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Product)), []), []);
  useEffect(() => { getAdminDocument('settings', 'main').then((snapshot) => { const deals = snapshot.exists() ? ((snapshot.data().weeklyDeals || []) as WeeklyDeal[]) : []; setRows(DAYS.map(({ key }) => { const deal = deals.find((item) => item.day === key); return { day: key, productId: deal?.productId || '', dealPrice: deal?.dealPrice ? String(deal.dealPrice) : '', active: deal?.active ?? true }; })); }); }, []);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const updateRow = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setToast('');
    try {
      const weeklyDeals: WeeklyDeal[] = rows.filter((row) => row.productId && Number(row.dealPrice) > 0).map((row) => { const product = productMap.get(row.productId); return { id: `weekly-${row.day}`, day: row.day, label: 'One Day Deal', productId: row.productId, imageUrl: product?.imageUrl || product?.images?.[0] || '', title: product?.title || '', originalPrice: Number(product?.originalPrice || product?.price || 0), dealPrice: Number(row.dealPrice), startAt: '', endAt: '', buttonText: 'Shop Deal', buttonLink: `/product/${row.productId}`, active: row.active }; });
      await setAdminDocument('settings', 'main', { weeklyDeals }); setToast('Weekly deal schedule saved.');
    } catch { setToast('Unable to save the weekly deal schedule.'); } finally { setSaving(false); }
  }

  return <section className="mx-auto max-w-6xl px-4 py-6"><h2 className="text-2xl font-black">One Day Deals</h2><p className="mt-1 text-sm text-black/55">Set one product and its special price for each day. Future deals can be previewed; active pricing will follow the day/time rules.</p><form onSubmit={save} className="mt-5 space-y-3">{rows.map((row, index) => { const label = DAYS.find((day) => day.key === row.day)?.label || row.day; return <div key={row.day} className="grid gap-3 rounded-2xl border border-black/10 bg-white p-4 md:grid-cols-[120px_1fr_180px_90px] md:items-center"><div><p className="text-sm font-black">{label}</p><p className="text-[10px] uppercase tracking-wider text-black/40">Daily schedule</p></div><select value={row.productId} onChange={(event) => updateRow(index, { productId: event.target.value })} className="rounded-xl bg-[#F4F4F1] p-3 text-sm"><option value="">No deal</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title} — Rs. {Number(product.price).toLocaleString()}</option>)}</select><input type="number" min="1" value={row.dealPrice} onChange={(event) => updateRow(index, { dealPrice: event.target.value })} placeholder="Deal price" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" /><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={row.active} onChange={(event) => updateRow(index, { active: event.target.checked })} /> Active</label></div>; })}<button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-3 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? 'Saving...' : 'Save Weekly Deals'}</button></form>{toast && <div role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 size={16} />{toast}</div>}</section>;
}
