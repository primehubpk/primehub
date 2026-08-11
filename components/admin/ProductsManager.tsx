'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { Edit3, ImagePlus, Search, Trash2, X, Plus, Minus, Video, Check } from 'lucide-react';
import { adminCollection, createAdminDocument, deleteAdminDocument, type Product, updateAdminDocument, uploadImageToImgBB } from './shared';

type CategoryOption = { id: string; title: string; active?: boolean; sortOrder?: number };
type MediaAsset = { id: string; name?: string; url: string; type?: string };
type VariantOption = { id: string; name: string; values: string[] };
type VariantRow = { id: string; label: string; sku: string; price: string; salePrice: string; stock: string; imageUrl: string; active: boolean };

const EMPTY_FORM = {
  title: '', price: '', originalPrice: '', description: '', shortDescription: '', category: '', stock: '0',
  videoUrl: '', images: [] as string[], slug: '', brand: '', featured: false, published: true,
};
const DEFAULT_OPTIONS: VariantOption[] = [
  { id: 'color', name: 'Color', values: [] },
  { id: 'size', name: 'Size', values: [] },
];

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function makeId() { return Math.random().toString(36).slice(2, 10); }

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [options, setOptions] = useState<VariantOption[]>(DEFAULT_OPTIONS);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');

  useEffect(() => onSnapshot(adminCollection('products'), (snapshot) => setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Product))), []);
  useEffect(() => onSnapshot(adminCollection('categories'), (snapshot) => {
    setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CategoryOption).filter((item) => item.active !== false).sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999)));
  }), []);
  useEffect(() => onSnapshot(adminCollection('media_assets'), (snapshot) => setMedia(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MediaAsset))), []);

  const shown = useMemo(() => products.filter((product) => product.title.toLowerCase().includes(query.toLowerCase()) || String(product.category || '').toLowerCase().includes(query.toLowerCase())), [products, query]);
  const gallery = useMemo(() => media.filter((asset) => `${asset.name || ''} ${asset.url}`.toLowerCase().includes(gallerySearch.toLowerCase())), [media, gallerySearch]);
  const change = (key: keyof typeof EMPTY_FORM, value: string | boolean | string[]) => setForm((current) => ({ ...current, [key]: value }));

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); if (!files.length) return;
    setBusy(true);
    try { for (const file of files) { const url = await uploadImageToImgBB(file); setForm((current) => ({ ...current, images: [...current.images, url] })); } }
    finally { setBusy(false); event.target.value = ''; }
  }

  function addOption() { setOptions((current) => [...current, { id: makeId(), name: 'Option', values: [] }]); }
  function removeOption(id: string) { setOptions((current) => current.filter((item) => item.id !== id)); setVariantRows([]); }
  function updateOption(id: string, patch: Partial<VariantOption>) { setOptions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function addValue(id: string) { setOptions((current) => current.map((item) => item.id === id ? { ...item, values: [...item.values, ''] } : item)); }
  function updateValue(id: string, index: number, value: string) { setOptions((current) => current.map((item) => item.id === id ? { ...item, values: item.values.map((v, i) => i === index ? value : v) } : item)); }
  function removeValue(id: string, index: number) { setOptions((current) => current.map((item) => item.id === id ? { ...item, values: item.values.filter((_, i) => i !== index) } : item)); }

  function buildVariantRows(nextOptions = options) {
    const active = nextOptions.filter((item) => item.name.trim() && item.values.some(Boolean)).map((item) => ({ ...item, values: item.values.filter(Boolean) }));
    if (!active.length) { setVariantRows([]); return; }
    const combinations = active.reduce<string[][]>((acc, option) => acc.flatMap((prefix) => option.values.map((value) => [...prefix, value])), [[]]);
    setVariantRows(combinations.map((parts) => ({ id: makeId(), label: parts.join(' / '), sku: '', price: form.price, salePrice: '', stock: form.stock, imageUrl: form.images[0] || '', active: true })));
  }

  function startEdit(product: Product) {
    const rawOptions = Array.isArray((product as any).variantOptions) ? (product as any).variantOptions as VariantOption[] : DEFAULT_OPTIONS;
    setEditing(product);
    setForm({ ...EMPTY_FORM, title: product.title, price: String(product.price ?? ''), originalPrice: String(product.originalPrice ?? ''), description: String(product.description || ''), shortDescription: String((product as any).shortDescription || ''), category: String(product.category || ''), stock: String(product.stock ?? 0), videoUrl: String((product as any).videoUrl || ''), images: product.images || [product.imageUrl || ''].filter(Boolean), slug: String((product as any).slug || slugify(product.title)), brand: String((product as any).brand || ''), featured: Boolean((product as any).featured), published: (product as any).published !== false });
    setOptions(rawOptions.length ? rawOptions : DEFAULT_OPTIONS);
    setVariantRows(Array.isArray((product as any).variantMatrix) ? (product as any).variantMatrix : []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() { setEditing(null); setForm(EMPTY_FORM); setOptions(DEFAULT_OPTIONS); setVariantRows([]); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.price || !form.category) return;
    setBusy(true);
    try {
      const cleanedOptions = options.filter((item) => item.name.trim() && item.values.some((value) => value.trim())).map((item) => ({ ...item, name: item.name.trim(), values: item.values.map((value) => value.trim()).filter(Boolean) }));
      const payload = {
        title: form.title.trim(), slug: slugify(form.slug || form.title), brand: form.brand.trim(), price: Number(form.price), originalPrice: Number(form.originalPrice || form.price),
        description: form.description, shortDescription: form.shortDescription, category: form.category, stock: Math.max(0, Number(form.stock || 0)), videoUrl: form.videoUrl.trim(), imageUrl: form.images[0] || '', images: form.images,
        variantOptions: cleanedOptions, variantMatrix: variantRows, featured: form.featured, published: form.published, updatedAt: new Date().toISOString(),
      };
      if (editing) await updateAdminDocument('products', editing.id, payload);
      else await createAdminDocument('products', { ...payload, isFlashSale: false, isWeekendSpecial: false, createdAt: new Date().toISOString() });
      reset();
    } finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-6xl px-4 py-6">
    <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Catalog control</p><h2 className="mt-1 text-2xl font-black">Products Manager</h2><p className="mt-1 text-sm text-black/50">Categories, gallery, video, variants, pricing and publishing are controlled from one place.</p></div>
    <form onSubmit={save} className="mt-5 grid gap-4 rounded-3xl bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <input value={form.title} onChange={(e) => change('title', e.target.value)} placeholder="Product title" required className="rounded-xl bg-[#F4F4F1] p-3 text-sm" />
        <input value={form.brand} onChange={(e) => change('brand', e.target.value)} placeholder="Brand (optional)" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" />
        <input value={form.price} onChange={(e) => change('price', e.target.value)} placeholder="Regular price" required type="number" min="0" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" />
        <input value={form.originalPrice} onChange={(e) => change('originalPrice', e.target.value)} placeholder="Compare/original price" type="number" min="0" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" />
        <select value={form.category} onChange={(e) => change('category', e.target.value)} required className="rounded-xl bg-[#F4F4F1] p-3 text-sm"><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select>
        <input value={form.stock} onChange={(e) => change('stock', e.target.value)} placeholder="Stock" type="number" min="0" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" />
        <input value={form.slug} onChange={(e) => change('slug', e.target.value)} placeholder="SEO slug" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" />
        <input value={form.videoUrl} onChange={(e) => change('videoUrl', e.target.value)} placeholder="YouTube / Shorts / Reel / MP4 URL" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" />
      </div>
      <input value={form.shortDescription} onChange={(e) => change('shortDescription', e.target.value)} placeholder="Short description" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" />
      <textarea value={form.description} onChange={(e) => change('description', e.target.value)} placeholder="Full product description" className="min-h-28 rounded-xl bg-[#F4F4F1] p-3 text-sm" />

      <div className="rounded-2xl border border-black/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-black">Product gallery</p><p className="text-[11px] text-black/45">Choose existing Media Library images or upload new ones.</p></div><div className="flex gap-2"><button type="button" onClick={() => setShowGallery(true)} className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-xs font-black"><ImagePlus size={14} /> Choose from gallery</button><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs font-black"><ImagePlus size={14} /> Upload<input type="file" accept="image/*" multiple onChange={upload} className="hidden" /></label></div></div>
        <div className="mt-3 flex gap-2 overflow-x-auto">{form.images.map((url, index) => <div key={`${url}-${index}`} className="relative shrink-0"><img src={url} alt="Product" className="h-20 w-20 rounded-xl object-cover" /><button type="button" onClick={() => change('images', form.images.filter((_, i) => i !== index))} className="absolute -right-1 -top-1 rounded-full bg-red-600 p-1 text-white"><X size={11} /></button>{index === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-black text-white">MAIN</span>}</div>)}{!form.images.length && <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#F4F4F1] text-black/30"><ImagePlus /></div>}</div>
      </div>

      <div className="rounded-2xl border border-black/10 p-4">
        <div className="flex items-center justify-between"><div><p className="text-sm font-black">Variants</p><p className="text-[11px] text-black/45">Add Color, Size or any custom option. Each combination can have its own SKU, price and stock.</p></div><button type="button" onClick={addOption} className="inline-flex items-center gap-1 rounded-lg bg-black/5 px-3 py-2 text-xs font-black"><Plus size={13} /> Add option</button></div>
        <div className="mt-3 space-y-3">{options.map((option) => <div key={option.id} className="rounded-xl bg-[#F4F4F1] p-3"><div className="flex gap-2"><input value={option.name} onChange={(e) => updateOption(option.id, { name: e.target.value })} placeholder="Option name (Color / Size)" className="w-40 rounded-lg bg-white p-2 text-xs font-bold" />{option.id !== 'color' && option.id !== 'size' && <button type="button" onClick={() => removeOption(option.id)} className="rounded-lg bg-red-50 p-2 text-[#E1352B]"><Trash2 size={13} /></button>}</div><div className="mt-2 space-y-2">{option.values.map((value, index) => <div key={`${option.id}-${index}`} className="flex gap-2"><input value={value} onChange={(e) => updateValue(option.id, index, e.target.value)} placeholder={`${option.name} value`} className="flex-1 rounded-lg bg-white p-2 text-xs" /><button type="button" onClick={() => removeValue(option.id, index)} className="rounded-lg bg-white p-2"><Minus size={13} /></button></div>)}<button type="button" onClick={() => addValue(option.id)} className="text-[11px] font-black text-[#0F6A5F]">+ Add {option.name || 'value'}</button></div></div>)}</div>
        <button type="button" onClick={() => buildVariantRows()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-4 py-2.5 text-xs font-black text-white"><Check size={13} /> Generate combinations</button>
        {!!variantRows.length && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead><tr className="border-b border-black/10 text-black/45"><th className="p-2">Combination</th><th className="p-2">SKU</th><th className="p-2">Price</th><th className="p-2">Sale</th><th className="p-2">Stock</th><th className="p-2">Active</th></tr></thead><tbody>{variantRows.map((row, index) => <tr key={row.id} className="border-b border-black/5"><td className="p-2 font-bold">{row.label}</td><td className="p-2"><input value={row.sku} onChange={(e) => setVariantRows((r) => r.map((x, i) => i === index ? { ...x, sku: e.target.value } : x))} className="w-28 rounded-lg bg-[#F4F4F1] p-2" /></td><td className="p-2"><input type="number" value={row.price} onChange={(e) => setVariantRows((r) => r.map((x, i) => i === index ? { ...x, price: e.target.value } : x))} className="w-24 rounded-lg bg-[#F4F4F1] p-2" /></td><td className="p-2"><input type="number" value={row.salePrice} onChange={(e) => setVariantRows((r) => r.map((x, i) => i === index ? { ...x, salePrice: e.target.value } : x))} className="w-24 rounded-lg bg-[#F4F4F1] p-2" /></td><td className="p-2"><input type="number" value={row.stock} onChange={(e) => setVariantRows((r) => r.map((x, i) => i === index ? { ...x, stock: e.target.value } : x))} className="w-20 rounded-lg bg-[#F4F4F1] p-2" /></td><td className="p-2"><input type="checkbox" checked={row.active} onChange={(e) => setVariantRows((r) => r.map((x, i) => i === index ? { ...x, active: e.target.checked } : x))} /></td></tr>)}</tbody></table></div>}
      </div>

      <div className="flex flex-wrap gap-5 text-xs font-bold"><label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(e) => change('featured', e.target.checked)} /> Featured product</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.published} onChange={(e) => change('published', e.target.checked)} /> Published on storefront</label></div>
      <button disabled={busy} className="rounded-xl bg-[#14140F] py-3 text-xs font-black text-white disabled:opacity-50">{editing ? 'Save product' : 'Add product'}</button>
    </form>

    <div className="mt-6 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" className="w-full bg-transparent text-sm outline-none" /></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map((product) => <article key={product.id} className="rounded-2xl bg-white p-3 shadow-sm">{product.imageUrl && <img src={product.imageUrl} alt={product.title} className="h-32 w-full rounded-xl object-cover" />}<p className="mt-2 font-black">{product.title}</p><p className="text-xs text-[#E1352B]">Rs. {Number(product.price).toLocaleString()} · Stock {product.stock}</p><p className="mt-1 text-[11px] text-black/45">{String(product.category || '')}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => startEdit(product)} className="rounded-lg bg-black/5 p-2"><Edit3 size={14} /></button><button type="button" onClick={() => confirm(`Delete ${product.title}?`) && deleteAdminDocument('products', product.id)} className="rounded-lg bg-red-50 p-2 text-[#E1352B]"><Trash2 size={14} /></button></div></article>)}</div>

    {showGallery && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-3xl bg-[#F4F4F1] p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xl font-black">Choose from Media Gallery</h3><p className="text-xs text-black/45">Select one or multiple images.</p></div><button type="button" onClick={() => setShowGallery(false)} className="rounded-full bg-white p-2"><X /></button></div><div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2"><Search size={15} /><input value={gallerySearch} onChange={(e) => setGallerySearch(e.target.value)} placeholder="Search gallery" className="w-full bg-transparent text-sm outline-none" /></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{gallery.map((asset) => { const selected = form.images.includes(asset.url); return <button key={asset.id} type="button" onClick={() => change('images', selected ? form.images.filter((url) => url !== asset.url) : [...form.images, asset.url])} className={`overflow-hidden rounded-xl border-2 bg-white text-left ${selected ? 'border-[#0F6A5F]' : 'border-transparent'}`}><img src={asset.url} alt={asset.name || 'Media'} className="aspect-square w-full object-cover" /><span className="block truncate p-2 text-[10px] font-bold">{selected ? '✓ Selected' : asset.name || 'Image'}</span></button>; })}</div><div className="mt-4 flex justify-end"><button type="button" onClick={() => setShowGallery(false)} className="rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white">Done</button></div></div></div>}
    {editing && <button type="button" onClick={reset} className="fixed bottom-6 right-6 rounded-full bg-[#E1352B] p-3 text-white"><X /></button>}
  </section>;
}
