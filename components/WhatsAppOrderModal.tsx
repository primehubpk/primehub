'use client';

// ==================== WHATSAPP ORDER DETAILS MODAL ====================
// Captures customer details, saves a pending order, then opens WhatsApp.

import { FormEvent, useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Loader2, MessageCircle, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useSettings } from '@/lib/useSettings';

export type WhatsAppOrderItem = {
  id?: string | number;
  productId?: string;
  name?: string;
  title?: string;
  price?: number;
  qty?: number;
  quantity?: number;
  image?: string;
  imageUrl?: string;
};

type Props = { items: WhatsAppOrderItem[]; onClose: () => void; onSaved?: () => void };
const titleOf = (item: WhatsAppOrderItem) => item.title || item.name || 'Product';
const quantityOf = (item: WhatsAppOrderItem) => Number(item.quantity || item.qty || 1);
const priceOf = (item: WhatsAppOrderItem) => Number(item.price || 0);

export default function WhatsAppOrderModal({ items, onClose, onSaved }: Props) {
  const { settings } = useSettings();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + priceOf(item) * quantityOf(item), 0), [items]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const whatsappNumber = String(settings.whatsappNumber || '').replace(/\D/g, '');
    if (!whatsappNumber || !name.trim() || !phone.trim() || !city.trim() || !items.length) {
      setError('Enter your name, phone number, and city before continuing.');
      return;
    }
    setSaving(true); setError('');
    try {
      const reference = await addDoc(collection(db, 'orders'), {
        customer: { name: name.trim(), phone: phone.trim(), email: '', address: '', city: city.trim(), notes: 'WhatsApp order request.' },
        items: items.map((item) => ({ productId: String(item.productId || item.id || ''), title: titleOf(item), price: priceOf(item), quantity: quantityOf(item), image: item.image || item.imageUrl || '' })),
       totalItems: items.reduce<number>((sum, item) => sum + quantityOf(item), 0),
        currency: 'PKR', status: 'pending', source: 'WhatsApp', createdAt: serverTimestamp(),
      });
      const lines = items.map((item, index) => `${index + 1}. ${titleOf(item)} x ${quantityOf(item)} — Rs. ${(priceOf(item) * quantityOf(item)).toLocaleString()}`);
      const text = ['PrimeHub Deals WhatsApp Order', `Order ID: ${reference.id}`, '', ...lines, '', `Customer: ${name.trim()}`, `Phone: ${phone.trim()}`, `City: ${city.trim()}`, `Total: Rs. ${subtotal.toLocaleString()}`].join('\n');
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      onSaved?.(); onClose();
    } catch { setError('Your order could not be saved. Please try again.'); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-[200] flex items-end bg-black/55 p-3 sm:items-center sm:justify-center"><button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" /><form onSubmit={submit} className="relative w-full max-w-md rounded-[30px] bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]">WhatsApp order</p><h2 className="mt-1 text-xl font-black">A few delivery details</h2></div><button type="button" onClick={onClose} className="rounded-full bg-[#F4F4F1] p-2"><X size={16} /></button></div>{error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}<div className="mt-5 space-y-3"><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-2xl bg-[#F4F4F1] px-4 py-3 text-sm outline-none" /><input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone / WhatsApp number" type="tel" className="w-full rounded-2xl bg-[#F4F4F1] px-4 py-3 text-sm outline-none" /><input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-full rounded-2xl bg-[#F4F4F1] px-4 py-3 text-sm outline-none" /></div><button disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F6A5F] py-4 text-xs font-black text-white disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}{saving ? 'Saving order...' : 'Save order & open WhatsApp'}</button></form></div>;
}
