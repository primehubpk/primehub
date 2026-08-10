'use client';

// ==================== SUPPLIER PRODUCT INTAKE ====================
import { FormEvent, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function VendorPage() {
  const [form, setForm] = useState<Record<string, string>>({}); const [photos, setPhotos] = useState<string[]>([]); const [saved, setSaved] = useState(false);
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function upload(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const data = new FormData(); data.append('image', file); const response = await fetch('https://api.imgbb.com/1/upload?key=f38fa84b03c7eaaeda2a4d3a164b116f', { method: 'POST', body: data }); const result = await response.json(); if (result.success) setPhotos((current) => [...current, result.data.url]); }
  async function submit(event: FormEvent) { event.preventDefault(); await addDoc(collection(db, 'vendor_submissions'), { ...form, wholesalePrice: Number(form.wholesalePrice || 0), photos, status: 'pending', createdAt: serverTimestamp() }); setSaved(true); }
  const fields = [['supplierName','Supplier Name'],['businessName','Business Name'],['whatsappNumber','WhatsApp Number'],['city','City'],['productTitle','Product Title'],['wholesalePrice','Wholesale Price'],['category','Category']];
  return <main className="min-h-screen bg-[#F4F4F1] px-4 py-8 pb-28"><form onSubmit={submit} className="mx-auto max-w-xl rounded-[30px] bg-white p-6 shadow-sm"><p className="text-[9px] font-black uppercase tracking-wider text-[#E1352B]">Partner with PrimeHub</p><h1 className="mt-2 text-2xl font-black">Submit a product</h1>{saved ? <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">Submitted for moderation.</p> : <div className="mt-5 grid gap-3">{fields.map(([key,label]) => <input key={key} required type={key === 'wholesalePrice' ? 'number' : 'text'} placeholder={label} onChange={(e) => update(key,e.target.value)} className="rounded-xl bg-[#F4F4F1] p-3 text-sm"/>)}<textarea required placeholder="Product Description" onChange={(e) => update('description',e.target.value)} className="rounded-xl bg-[#F4F4F1] p-3 text-sm"/><input type="file" accept="image/*" onChange={upload}/><p className="text-xs text-black/40">{photos.length} photo(s) uploaded</p><button className="rounded-xl bg-[#14140F] py-4 text-xs font-black text-white">Submit for approval</button></div>}</form></main>;
}
