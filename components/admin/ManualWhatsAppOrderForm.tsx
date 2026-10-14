'use client';
import { FormEvent, useState } from 'react';
import { MessageCircle, Plus, X } from 'lucide-react';

type Item = { title: string; quantity: string; price: string; color: string; size: string; image: string };
function emptyItem(): Item { return { title: '', quantity: '1', price: '', color: '', size: '', image: '' }; }
export default function ManualWhatsAppOrderForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''), [phone, setPhone] = useState('');
  const [city, setCity] = useState(''), [address, setAddress] = useState(''), [notes, setNotes] = useState('');
  const [selfCollect, setSelfCollect] = useState(false);
  const [deliveryCharge, setDeliveryCharge] = useState('350');
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  function edit(index: number, key: keyof Item, value: string) {
    setItems(old => old.map((item, position) => position === index ? { ...item, [key]: value } : item));
  }
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!window.confirm('Confirm these details match an actual customer WhatsApp message?')) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record-whatsapp', customer: { name, phone, city, address, notes },
          selfCollect, deliveryCharge: Number(deliveryCharge),
          items: items.map(item => ({ ...item, quantity: Number(item.quantity), price: Number(item.price) })) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) throw new Error(data?.error || 'WhatsApp order could not be recorded.');
      setSuccess('Confirmed WhatsApp order recorded in Admin Orders.');
      setName(''); setPhone(''); setCity(''); setAddress(''); setNotes('');
      setItems([emptyItem()]); setOpen(false);
      await onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Save failed.'); }
    finally { setBusy(false); }
  }
  return <section className="mt-4 rounded-3xl border border-[#0F6A5F]/15 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-black"><MessageCircle size={17}/> Direct WhatsApp Customer Orders</h3>
        <p className="mt-1 text-[10px] leading-5 text-black/50">Customer messaged the shop outside the website? Enter the real chat details here. Orders created here count as manually confirmed purchases.</p></div>
      <button type="button" onClick={() => setOpen(v => !v)} className="rounded-xl bg-[#14140F] px-4 py-2.5 text-[11px] font-black text-white">{open ? 'Close Form' : 'Record WhatsApp Order'}</button>
    </div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {success && <p className="mt-3 rounded-xl bg-[#DDF5F0] p-3 text-xs text-[#0F6A5F]">{success}</p>}
    {open && <form onSubmit={submit} className="mt-4 space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input required value={name} onChange={event => setName(event.target.value)} placeholder="Customer name" className="rounded-xl border p-3 text-sm"/>
        <input required value={phone} type="tel" onChange={event => setPhone(event.target.value)} placeholder="Customer WhatsApp / phone" className="rounded-xl border p-3 text-sm"/>
        {!selfCollect && <><input required value={city} onChange={event => setCity(event.target.value)} placeholder="City" className="rounded-xl border p-3 text-sm"/>
        <input required value={address} onChange={event => setAddress(event.target.value)} placeholder="Full delivery address" className="rounded-xl border p-3 text-sm"/></>}
        <textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Customer notes / WhatsApp instructions" className="rounded-xl border p-3 text-sm sm:col-span-2"/>
      </div>
      <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={selfCollect} onChange={e => setSelfCollect(e.target.checked)}/> Customer collects from shop (no delivery)</label>
      {!selfCollect && <label className="block text-[11px] font-bold">Delivery charge (Rs.)<input type="number" required min="0" max="10000" value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} className="mt-2 block w-full rounded-xl border p-3 text-sm"/></label>}
      {items.map((item, index) => <div key={index} className="rounded-2xl border border-black/10 bg-[#F7F7F4] p-3">
        <div className="flex items-center justify-between"><strong className="text-xs">Product #{index + 1}</strong><button type="button" aria-label="Remove product" disabled={items.length === 1} onClick={() => setItems(items.filter((_, i) => i !== index))} className="rounded-full p-1 text-rose-700 disabled:opacity-30"><X size={17}/></button></div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input required placeholder="Product / design name" value={item.title} onChange={e => edit(index, 'title', e.target.value)} className="rounded-xl border p-3 text-sm sm:col-span-2"/>
          <input required type="number" min="1" max="100" placeholder="Quantity" value={item.quantity} onChange={e => edit(index, 'quantity', e.target.value)} className="rounded-xl border p-3 text-sm"/>
          <input required type="number" min="1" max="1000000" placeholder="Price per item (Rs.)" value={item.price} onChange={e => edit(index, 'price', e.target.value)} className="rounded-xl border p-3 text-sm"/>
          <input placeholder="Color (optional)" value={item.color} onChange={e => edit(index, 'color', e.target.value)} className="rounded-xl border p-3 text-sm"/>
          <input placeholder="Size (optional)" value={item.size} onChange={e => edit(index, 'size', e.target.value)} className="rounded-xl border p-3 text-sm"/>
          <input type="url" placeholder="Product photo URL (optional)" value={item.image} onChange={e => edit(index, 'image', e.target.value)} className="rounded-xl border p-3 text-sm sm:col-span-2"/>
        </div>
      </div>)}
      <button type="button" disabled={items.length >= 30} onClick={() => setItems([...items, emptyItem()])} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold"><Plus size={14}/> Add Another Product</button>
      <p className="text-sm font-black">Verified customer total: Rs. {(subtotal + (selfCollect ? 0 : Number(deliveryCharge) || 0)).toLocaleString()}</p>
      <button disabled={busy} type="submit" className="w-full rounded-xl bg-[#0F6A5F] px-4 py-3 text-xs font-black text-white disabled:opacity-50">{busy ? 'Saving Order…' : 'Save Confirmed WhatsApp Order'}</button>
    </form>}
  </section>;
}
