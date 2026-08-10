'use client';

// ==================== PRODUCT CATALOG MANAGEMENT ====================
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Edit3, ImagePlus, Search, Trash2, X } from 'lucide-react';
import { adminCollection, createAdminDocument, deleteAdminDocument, type Product, updateAdminDocument, uploadImageToImgBB } from './shared';

const DEAL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const EMPTY_FORM = { title: '', price: '', originalPrice: '', description: '', category: '', stock: '50', dealDay: '', variants: '', videoUrl: '', images: [] as string[] };

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(adminCollection('products'), (snapshot) => {
    setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Product));
  }), []);

  const shown = useMemo(() => products.filter((product) => product.title.toLowerCase().includes(query.toLowerCase()) || product.category.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const change = (key: keyof typeof EMPTY_FORM, value: string) => setForm((current) => ({ ...current, [key]: value }));

  // ==================== PRODUCT IMAGE UPLOAD ====================
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImageToImgBB(file);
      setForm((current) => ({ ...current, images: [...current.images, url] }));
    } finally {
      setBusy(false);
    }
  }

  // ==================== PRODUCT SAVE ACTION ====================
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      title: form.title,
      price: Number(form.price),
      originalPrice: Number(form.originalPrice || form.price),
      description: form.description,
      category: form.category,
      stock: Math.max(0, Number(form.stock || 0)),
      dealDay: form.dealDay,
      variants: form.variants.split(',').map((value) => value.trim()).filter(Boolean),
      videoUrl: form.videoUrl,
      imageUrl: form.images[0] || '',
      images: form.images,
      updatedAt: serverTimestamp(),
    };
    if (editing) await updateAdminDocument('products', editing.id, payload);
    else await createAdminDocument('products', { ...payload, isFlashSale: false, isWeekendSpecial: false, createdAt: serverTimestamp() });
    setForm(EMPTY_FORM);
    setEditing(null);
  }

  // ==================== PRODUCT MANAGER UI ====================
  return <section className="mx-auto max-w-6xl px-4 py-6"><h2 className="text-2xl font-black">Products Manager</h2><form onSubmit={save} className="mt-5 grid gap-3 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-2">{[['title', 'Title'], ['price', 'Price'], ['originalPrice', 'Discount / Original Price'], ['category', 'Category'], ['stock', 'Stock'], ['videoUrl', 'Video / Reel URL']].map(([key, label]) => <input key={key} required={key === 'title' || key === 'price' || key === 'category'} value={form[key as keyof typeof EMPTY_FORM] as string} onChange={(event) => change(key as keyof typeof EMPTY_FORM, event.target.value)} placeholder={label} type={key === 'price' || key === 'originalPrice' || key === 'stock' ? 'number' : 'text'} className="rounded-xl bg-[#F4F4F1] p-3 text-sm" />)}<select value={form.dealDay} onChange={(event) => change('dealDay', event.target.value)} className="rounded-xl bg-[#F4F4F1] p-3 text-sm"><option value="">None</option>{DEAL_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}</select><textarea value={form.description} onChange={(event) => change('description', event.target.value)} placeholder="Description" className="rounded-xl bg-[#F4F4F1] p-3 text-sm md:col-span-2" /><input value={form.variants} onChange={(event) => change('variants', event.target.value)} placeholder="Variants, comma separated (Red, Blue, Large)" className="rounded-xl bg-[#F4F4F1] p-3 text-sm md:col-span-2" /><label className="flex items-center gap-2 text-xs font-bold"><ImagePlus size={16} /><input type="file" accept="image/*" onChange={upload} /></label><div className="flex gap-2 overflow-x-auto">{form.images.map((url) => <img key={url} src={url} alt="Upload" className="h-12 w-12 rounded-lg object-cover" />)}</div><button disabled={busy} className="rounded-xl bg-[#14140F] py-3 text-xs font-black text-white md:col-span-2">{editing ? 'Save product' : 'Add product'}</button></form><div className="mt-6 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="w-full bg-transparent text-sm outline-none" /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map((product) => <article key={product.id} className="rounded-2xl bg-white p-3 shadow-sm">{product.imageUrl && <img src={product.imageUrl} alt={product.title} className="h-32 w-full rounded-xl object-cover" />}<p className="mt-2 font-black">{product.title}</p><p className="text-xs text-[#E1352B]">Rs. {Number(product.price).toLocaleString()} · Stock {product.stock}</p><p className="mt-1 text-[11px] text-black/45">Big Deal: {String(product.dealDay || 'None')}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setEditing(product); setForm({ ...EMPTY_FORM, title: product.title, price: String(product.price), originalPrice: String(product.originalPrice || ''), description: String(product.description || ''), category: product.category, stock: String(product.stock), dealDay: String(product.dealDay || ''), variants: Array.isArray(product.variants) ? product.variants.join(', ') : '', videoUrl: String(product.videoUrl || ''), images: product.images || [product.imageUrl || ''].filter(Boolean) }); }} className="rounded-lg bg-black/5 p-2"><Edit3 size={14} /></button><button type="button" onClick={() => confirm(`Delete ${product.title}?`) && deleteAdminDocument('products', product.id)} className="rounded-lg bg-red-50 p-2 text-[#E1352B]"><Trash2 size={14} /></button></div></article>)}</div>{editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY_FORM); }} className="fixed bottom-6 right-6 rounded-full bg-[#E1352B] p-3 text-white"><X /></button>}</section>;
}
