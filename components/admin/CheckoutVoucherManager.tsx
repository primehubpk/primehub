'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import type { CheckoutVoucher } from '@/lib/checkoutVouchersServer';

export default function CheckoutVoucherManager() {
  const [vouchers, setVouchers] = useState<CheckoutVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/admin/checkout-vouchers', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not load vouchers.'); return d; })
      .then(d => { if (active) setVouchers(d.vouchers || []); })
      .catch(e => { if (active) setMessage(e.message || 'Could not load vouchers.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function update(id: string, patch: Partial<CheckoutVoucher>) {
    setVouchers(current => current.map(v => v.id === id ? { ...v, ...patch } : v));
  }
  async function save() {
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/admin/checkout-vouchers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vouchers: vouchers.map(v => ({ ...v, code: v.code.trim().toUpperCase() })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save vouchers.');
      setVouchers(data.vouchers || []);
      setMessage('Vouchers saved. Active codes can now be used at checkout.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save.'); }
    finally { setSaving(false); }
  }
  return <section className="mx-auto mt-5 max-w-6xl rounded-[26px] bg-white p-4 shadow-sm sm:p-6">
    <h2 className="text-lg font-black">Checkout Vouchers</h2>
    <p className="mt-1 text-xs leading-5 text-black/55">Discount vouchers reduce the bill immediately. Cash vouchers credit the customer’s Cash Wallet only after Admin marks their real order Delivered. Big Deal and Weekly Deal items are excluded from both vouchers.</p>
    {loading ? <p className="mt-5 text-xs">Loading secure voucher settings…</p> : (
      <div className="mt-5 space-y-3">
        {vouchers.map(v => <div key={v.id} className="grid gap-3 rounded-2xl border border-black/10 bg-[#FAF9F5] p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <label className="text-[10px] font-bold">Code<input aria-label="Voucher code" maxLength={24} value={v.code} onChange={e => update(v.id, { code: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm uppercase"/></label>
          <label className="text-[10px] font-bold">Type<select value={v.kind} onChange={e => update(v.id, { kind: e.target.value as CheckoutVoucher['kind'] })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"><option value="discount">Checkout Discount</option><option value="cash">Cash Wallet after Delivery</option></select></label>
          <label className="text-[10px] font-bold">Amount (Rs.)<input type="number" min={1} max={100000} value={v.amount} onChange={e => update(v.id, { amount: Number(e.target.value) })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"/></label>
          <label className="text-[10px] font-bold">Expires (optional)<input type="date" value={v.expiresAt || ''} onChange={e => update(v.id, { expiresAt: e.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm"/></label>
          <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={v.active} onChange={e => update(v.id, { active: e.target.checked })}/> Active</label><button type="button" aria-label="Delete voucher" onClick={() => setVouchers(x => x.filter(y => y.id !== v.id))} className="rounded-xl p-2 text-rose-600"><Trash2 size={17}/></button></div>
        </div>)}
        {!vouchers.length && <p className="py-4 text-xs text-black/50">No vouchers configured. No voucher discount will be given.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setVouchers(v => [...v, { id: crypto.randomUUID(), code: '', kind: 'discount', amount: 100, active: false }])} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold"><Plus size={16}/> Add Voucher</button>
          <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-[#0F6A5F] px-5 py-3 text-xs font-bold text-white disabled:opacity-50"><Save size={16}/>{saving ? 'Saving…' : 'Save Vouchers'}</button>
        </div>
      </div>
    )}
    {message && <p role="status" className="mt-4 rounded-xl bg-[#E7F6F3] p-3 text-xs font-bold text-[#0F6A5F]">{message}</p>}
  </section>;
}
