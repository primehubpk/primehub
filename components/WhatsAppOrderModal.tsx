'use client';

import { FormEvent, useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Loader2, MessageCircle, X } from 'lucide-react';
import { BASE_DELIVERY_CHARGE } from '@/lib/deliveryCharges';
import { db } from '@/lib/firebase';
import { useSettings } from '@/lib/useSettings';

export type WhatsAppOrderItem = { id?: string | number; productId?: string; name?: string; title?: string; price?: number; qty?: number; quantity?: number; image?: string; imageUrl?: string };
type Props = { items: WhatsAppOrderItem[]; onClose: () => void; onSaved?: () => void };
const titleOf = (item: WhatsAppOrderItem) => item.title || item.name || 'Product';
const quantityOf = (item: WhatsAppOrderItem) => Number(item.quantity || item.qty || 1);
const priceOf = (item: WhatsAppOrderItem) => Number(item.price || 0);

export default function WhatsAppOrderModal({ items, onClose, onSaved }: Props) {
  const { settings } = useSettings();
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [city, setCity] = useState('');
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + priceOf(item) * quantityOf(item), 0), [items]);
  const estimatedTotal = subtotal + BASE_DELIVERY_CHARGE;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const whatsappNumber = String(settings.whatsappNumber || '').replace(/\D/g, '');
    if (!whatsappNumber || !name.trim() || !phone.trim() || !city.trim() || !items.length) { setError('Enter your name, phone number, and city before continuing.'); return; }
    setSaving(true); setError('');
    try {
      const quoteResponse = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'quote', items }) });
      const quote = await quoteResponse.json();
      if (!quoteResponse.ok) throw new Error(quote.error || 'Unable to verify your cart.');
      const reference = await addDoc(collection(db, 'orders'), {
        customer: { name: name.trim(), phone: phone.trim(), email: '', address: '', city: city.trim(), notes: 'WhatsApp order request.' },
        items: quote.items, totalItems: quote.totalItems, subtotal: quote.subtotal, baseDelivery: quote.baseDelivery,
        wholesaleItems: quote.wholesaleItems, wholesaleSurcharge: quote.wholesaleSurcharge,
        deliveryCharge: quote.deliveryCharge, total: quote.total,
        currency: 'PKR', status: 'pending', source: 'WhatsApp', createdAt: serverTimestamp(),
      });
      const lines = quote.items.map((item: any, index: number) => `${index + 1}. ${item.title} x ${item.quantity} — Rs. ${(Number(item.price) * Number(item.quantity)).toLocaleString()}`);
      const wholesaleLine = Number(quote.wholesaleItems || 0) ? `Wholesale surcharge (${quote.wholesaleItems} × Rs. 30): Rs. ${Number(quote.wholesaleSurcharge).toLocaleString()}` : '';
      const text = ['PrimeHub Deals WhatsApp Order', `Order ID: ${reference.id}`, '', ...lines, '', `Customer: ${name.trim()}`, `Phone: ${phone.trim()}`, `City: ${city.trim()}`, '', `Subtotal: Rs. ${Number(quote.subtotal).toLocaleString()}`, `Base delivery: Rs. ${Number(quote.baseDelivery).toLocaleString()}`, wholesaleLine, `Grand Total: Rs. ${Number(quote.total).toLocaleString()}`].filter(Boolean).join('\n');
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      onSaved?.(); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Your order could not be saved. Please try again.'); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-[200] flex items-end bg-black/55 p-3 sm:items-center sm:justify-center"><button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" /><form onSubmit={submit} className="relative w-full max-w-md rounded-[30px] bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">WhatsApp order</p><h2 className="mt-1 text-xl font-black">A few delivery details</h2></div><button type="button" onClick={onClose} className="rounded-full bg-[#F4F4F1] p-2"><X size={16} /></button></div>{error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<div className="mt-4 rounded-2xl bg-[#F4F4F1] p-3 text-xs"><div className="flex justify-between"><span>Subtotal</span><strong>Rs. {subtotal.toLocaleString()}</strong></div><div className="mt-1 flex justify-between"><span>Delivery starts from</span><strong>Rs. {BASE_DELIVERY_CHARGE}</strong></div><div className="mt-2 flex justify-between border-t border-black/10 pt-2"><span>Estimated total</span><strong>Rs. {estimatedTotal.toLocaleString()}+</strong></div><p className="mt-1 text-[9px] text-black/45">Wholesale items add Rs. 30 each. Exact total is verified before WhatsApp opens.</p></div><div className="mt-4 space-y-3"><input required value={name} onChange={event => setName(event.target.value)} placeholder="Your name" className="w-full rounded-2xl bg-[#F4F4F1] px-4 py-3 text-sm outline-none" /><input required value={phone} onChange={event => setPhone(event.target.value)} placeholder="Phone / WhatsApp number" type="tel" className="w-full rounded-2xl bg-[#F4F4F1] px-4 py-3 text-sm outline-none" /><input required value={city} onChange={event => setCity(event.target.value)} placeholder="City" className="w-full rounded-2xl bg-[#F4F4F1] px-4 py-3 text-sm outline-none" /></div><button disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F6A5F] py-4 text-xs font-black text-white disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}{saving ? 'Verifying order...' : 'Save order & open WhatsApp'}</button></form></div>;
}
