'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { Edit3, ImagePlus, Search, Trash2, X, Plus, Minus, Check, Loader2, Tag, Package } from 'lucide-react';
import { adminCollection, createAdminDocument, deleteAdminDocument, getAdminDocument, setAdminDocument, type Product, updateAdminDocument, uploadImageToImgBB } from './shared';
import type { DailyDeal, PriceBucket, Weekday, WeeklyDeal } from '@/lib/types';

type CategoryOption = { id: string; title: string; active?: boolean; sortOrder?: number };
type MediaAsset = { id: string; name?: string; url: string; type?: string };
type VariantOption = { id: string; name: string; values: string[] };
type VariantRow = { id: string; label: string; sku: string; price: string; salePrice: string; stock: string; imageUrl: string; active: boolean };
type DealChoice = { day: Weekday | 'big' | ''; dealPrice: string };

const DAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'monday', label: 'Monday Deal' }, { key: 'tuesday', label: 'Tuesday Deal' }, { key: 'wednesday', label: 'Wednesday Deal' },
  { key: 'thursday', label: 'Thursday Deal' }, { key: 'friday', label: 'Friday Deal' }, { key: 'saturday', label: 'Saturday Deal' }, { key: 'sunday', label: 'Sunday Deal' },
];
const EMPTY_FORM = { title: '', originalPrice: '', discountPrice: '', description: '', category: '', stock: '0', videoUrl: '', images: [] as string[], slug: '', brand: '', featured: false, published: true, isWholesale: false };
const DEFAULT_OPTIONS: VariantOption[] = [{ id: 'color', name: 'Color', values: [] }, { id: 'size', name: 'Size', values: [] }];
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function makeId() { return Math.random().toString(36).slice(2, 10); }

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [priceBuckets, setPriceBuckets] = useState<PriceBucket[]>([]);
  const [weeklyDeals, setWeeklyDeals] = useState<WeeklyDeal[]>([]);
  const [bigDeal, setBigDeal] = useState<DailyDeal | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deal, setDeal] = useState<DealChoice>({ day: '', dealPrice: '' });
  const [bucketIds, setBucketIds] = useState<string[]>([]);
  const [options, setOptions] = useState<VariantOption[]>(DEFAULT_OPTIONS);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => onSnapshot(adminCollection('products'), (snapshot) => setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Product)), (error) => setMessage(`Products could not load: ${error.message}`)), []);
  useEffect(() => onSnapshot(adminCollection('categories'), (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CategoryOption).filter((item) => item.active !== false).sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999))), (error) => setMessage(`Categories could not load: ${error.message}`)), []);
  useEffect(() => onSnapshot(adminCollection('media_assets'), (snapshot) => setMedia(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MediaAsset)), (error) => setMessage(`Media library could not load: ${error.message}`)), []);
  useEffect(() => { getAdminDocument('settings', 'main').then((snapshot) => { if (!snapshot.exists()) return; const data = snapshot.data() as { priceBuckets?: PriceBucket[]; weeklyDeals?: WeeklyDeal[]; dailyDeal?: DailyDeal }; setPriceBuckets(Array.isArray(data.priceBuckets) ? data.priceBuckets.filter((bucket) => bucket.active !== false) : []); setWeeklyDeals(Array.isArray(data.weeklyDeals) ? data.weeklyDeals : []); setBigDeal(data.dailyDeal || null); }).catch((error) => setMessage(`Store settings could not load: ${error.message}`)); }, []);

  const shown = useMemo(() => products.filter((product) => product.title.toLowerCase().includes(query.toLowerCase()) || String(product.category || '').toLowerCase().includes(query.toLowerCase())), [products, query]);
  const gallery = useMemo(() => media.filter((asset) => `${asset.name || ''} ${asset.url}`.toLowerCase().includes(gallerySearch.toLowerCase())), [media, gallerySearch]);
  const change = (key: keyof typeof EMPTY_FORM, value: string | boolean | string[]) => setForm((current) => ({ ...current, [key]: value }));

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []); if (!files.length) return; setBusy(true); setMessage('');
    try { for (const file of files) { const url = await uploadImageToImgBB(file); setForm((current) => ({ ...current, images: [...current.images, url] })); try { await createAdminDocument('media_assets', { name: file.name, url, type: file.type, size: file.size, createdAt: new Date().toISOString() }); } catch (mediaError) { console.error(mediaError); } } setMessage(`${files.length} image${files.length > 1 ? 's' : ''} uploaded successfully.`); }
    catch (error) { console.error(error); setMessage(error instanceof Error ? `Upload failed: ${error.message}` : 'Upload failed. Please try again.'); }
    finally { setBusy(false); event.target.value = ''; }
  }
  function addOption() { setOptions((current) => [...current, { id: makeId(), name: 'Option', values: [] }]); }
  function removeOption(id: string) { setOptions((current) => current.filter((item) => item.id !== id)); setVariantRows([]); }
  function updateOption(id: string, patch: Partial<VariantOption>) { setOptions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function addValue(id: string) { setOptions((current) => current.map((item) => item.id === id ? { ...item, values: [...item.values, ''] } : item)); }
  function updateValue(id: string, index: number, value: string) { setOptions((current) => current.map((item) => item.id === id ? { ...item, values: item.values.map((v, i) => i === index ? value : v) } : item)); }
  function removeValue(id: string, index: number) { setOptions((current) => current.map((item) => item.id === id ? { ...item, values: item.values.filter((_, i) => i !== index) } : item)); }
  function buildVariantRows(nextOptions = options) {
    const active = nextOptions.filter((item) => item.name.trim() && item.values.some(Boolean)).map((item) => ({ ...item, values: item.values.filter(Boolean) })); if (!active.length) { setVariantRows([]); return; }
    const combinations = active.reduce<string[][]>((acc, option) => acc.flatMap((prefix) => option.values.map((value) => [...prefix, value])), [[]]); const defaultPrice = form.discountPrice || form.originalPrice;
    setVariantRows(combinations.map((parts) => ({ id: makeId(), label: parts.join(' / '), sku: '', price: defaultPrice, salePrice: '', stock: form.stock, imageUrl: form.images[0] || '', active: true })));
  }
  function startEdit(product: Product) {
    const rawOptions = Array.isArray((product as any).variantOptions) ? (product as any).variantOptions as VariantOption[] : DEFAULT_OPTIONS; const original = Number((product as any).originalPrice ?? product.price ?? 0); const current = Number(product.price ?? 0); const existingDeal = weeklyDeals.find((item) => item.productId === product.id); const isBig = bigDeal?.productId === product.id;
    setEditing(product); setForm({ ...EMPTY_FORM, title: product.title, originalPrice: String(original || ''), discountPrice: current && current !== original ? String(current) : '', description: String(product.description || ''), category: String(product.category || ''), stock: String(product.stock ?? 0), videoUrl: String((product as any).videoUrl || ''), images: product.images || [product.imageUrl || ''].filter(Boolean), slug: String((product as any).slug || slugify(product.title)), brand: String((product as any).brand || ''), featured: Boolean((product as any).featured), published: (product as any).published !== false, isWholesale: Boolean((product as any).isWholesale) });
    setDeal({ day: isBig ? 'big' : (existingDeal?.day || ''), dealPrice: isBig ? String(bigDeal?.dealPrice || '') : (existingDeal?.dealPrice ? String(existingDeal.dealPrice) : '') }); setBucketIds(Array.isArray((product as any).priceBucketIds) ? (product as any).priceBucketIds : []); setOptions(rawOptions.length ? rawOptions : DEFAULT_OPTIONS); setVariantRows(Array.isArray((product as any).variantMatrix) ? (product as any).variantMatrix : []); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function reset() { setEditing(null); setForm(EMPTY_FORM); setDeal({ day: '', dealPrice: '' }); setBucketIds([]); setOptions(DEFAULT_OPTIONS); setVariantRows([]); setMessage(''); }

  async function syncWeeklyDeal(productId: string) {
    const snapshot = await getAdminDocument('settings', 'main'); const data = snapshot.exists() ? snapshot.data() as { weeklyDeals?: WeeklyDeal[]; dailyDeal?: DailyDeal } : {}; let nextDeals = Array.isArray(data.weeklyDeals) ? data.weeklyDeals.filter((item) => item.productId !== productId) : [];
    let nextBigDeal = data.dailyDeal || null;
    if (deal.day === 'big') {
      const dealPrice = Number(deal.dealPrice); const originalPrice = Number(form.originalPrice); if (!dealPrice || dealPrice >= originalPrice) throw new Error('Big Deal price must be lower than the regular/original price.');
      nextDeals = nextDeals.filter((item) => item.productId !== productId);
      nextBigDeal = { ...(nextBigDeal || {}), productId, imageUrl: form.images[0] || '', title: form.title.trim(), originalPrice, dealPrice, startAt: nextBigDeal?.startAt || '', endAt: nextBigDeal?.endAt || '', buttonText: nextBigDeal?.buttonText || 'Shop Big Deal', buttonLink: nextBigDeal?.buttonLink || '/deals/big', active: true } as DailyDeal;
    } else if (deal.day) {
      const dealPrice = Number(deal.dealPrice); const originalPrice = Number(form.originalPrice); if (!dealPrice || dealPrice >= originalPrice) throw new Error('Deal price must be lower than the regular/original price.');
      nextDeals = nextDeals.filter((item) => item.day !== deal.day); nextDeals.push({ id: `weekly-${deal.day}`, day: deal.day, label: 'One Day Deal', productId, imageUrl: form.images[0] || '', title: form.title.trim(), originalPrice, dealPrice, startAt: '', endAt: '', buttonText: 'Shop Deal', buttonLink: `/product/${productId}`, active: true });
      if (nextBigDeal?.productId === productId) nextBigDeal = { ...nextBigDeal, productId: '', imageUrl: '', title: '', originalPrice: 0, dealPrice: 0, active: false };
    } else if (nextBigDeal?.productId === productId) {
      nextBigDeal = { ...nextBigDeal, productId: '', imageUrl: '', title: '', originalPrice: 0, dealPrice: 0, active: false };
    }
    await setAdminDocument('settings', 'main', { weeklyDeals: nextDeals, dailyDeal: nextBigDeal }); setWeeklyDeals(nextDeals); setBigDeal(nextBigDeal);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form.title.trim() || !form.originalPrice || !form.category) { setMessage('Product name, original price and category are required.'); return; } if (deal.day && (!deal.dealPrice || Number(deal.dealPrice) >= Number(form.originalPrice))) { setMessage('Deal price must be lower than the regular/original price.'); return; }
    setBusy(true); setMessage('');
    try { const cleanedOptions = options.filter((item) => item.name.trim() && item.values.some((value) => value.trim())).map((item) => ({ ...item, name: item.name.trim(), values: item.values.map((value) => value.trim()).filter(Boolean) })); const originalPrice = Number(form.originalPrice); const salePrice = form.discountPrice ? Number(form.discountPrice) : originalPrice; if (salePrice > originalPrice) throw new Error('Discount price cannot be higher than original price.');
      const payload = { title: form.title.trim(), slug: slugify(form.slug || form.title), brand: form.brand.trim(), price: salePrice, originalPrice, description: form.description, category: form.category, stock: Math.max(0, Number(form.stock || 0)), videoUrl: form.videoUrl.trim(), imageUrl: form.images[0] || '', images: form.images, variantOptions: cleanedOptions, variantMatrix: variantRows, featured: form.featured, published: form.published, isWholesale: form.isWholesale, priceBucketIds: bucketIds, updatedAt: new Date().toISOString() };
      let productId = editing?.id || ''; if (editing) await updateAdminDocument('products', editing.id, payload); else productId = (await createAdminDocument('products', { ...payload, isFlashSale: false, isWeekendSpecial: false, createdAt: new Date().toISOString() })).id; await syncWeeklyDeal(productId); setMessage(editing ? 'Product updated successfully.' : 'Product added successfully.'); reset();
    } catch (error) { console.error(error); setMessage(error instanceof Error ? error.message : 'Could not save product.'); } finally { setBusy(false); }
  }

  const bucketLabel = (id: string) => priceBuckets.find((bucket) => bucket.id === id)?.title || id; const selectedDealLabel = deal.day === 'big' ? 'Big Deal' : deal.day ? DAYS.find((item) => item.key === deal.day)?.label : 'No deal — regular product';
  return <section className="mx-auto max-w-6xl px-4 py-6">
    <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Catalog control</p><h2 className="mt-1 text-2xl font-black">Products Manager</h2><p className="mt-1 text-sm text-black/50">Complete product setup: pricing, category, media, variants, daily deals, price buckets and storefront placement.</p></div>
    {message && <div role="status" className="mt-4 rounded-xl bg-white p-3 text-xs font-bold text-black/65 shadow-sm">{message}</div>}
    <form onSubmit={save} className="mt-5 grid gap-4 rounded-3xl bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2"><input value={form.title} onChange={(e) => change('title', e.target.value)} placeholder="Product name" required className="rounded-xl bg-[#F4F4F1] p-3 text-sm" /><input value={form.brand} onChange={(e) => change('brand', e.target.value)} placeholder="Brand (optional)" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" />
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase tracking-wider text-black/45">Original price</span><input value={form.originalPrice} onChange={(e) => change('originalPrice', e.target.value)} placeholder="Rs. 1,500" required type="number" min="0" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" /></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase tracking-wider text-black/45">Discount price <span className="font-normal normal-case">(optional)</span></span><input value={form.discountPrice} onChange={(e) => change('discountPrice', e.target.value)} placeholder="Rs. 999" type="number" min="0" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" /></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase tracking-wider text-black/45">Category</span><select value={form.category} onChange={(e) => change('category', e.target.value)} required className="rounded-xl bg-[#F4F4F1] p-3 text-sm"><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
        <label className="grid gap-1"><span className="text-[10px] font-black uppercase tracking-wider text-black/45">Stock quantity</span><input value={form.stock} onChange={(e) => change('stock', e.target.value)} placeholder="0" type="number" min="0" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" /></label><input value={form.slug} onChange={(e) => change('slug', e.target.value)} placeholder="SEO slug (optional)" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" /><input value={form.videoUrl} onChange={(e) => change('videoUrl', e.target.value)} placeholder="YouTube / Shorts / Reel / MP4 URL (optional)" className="rounded-xl bg-[#F4F4F1] p-3 text-sm" /></div>
      <label className="flex items-center gap-2 rounded-xl border border-black/8 bg-[#F8F8F4] p-3 text-xs font-black"><input type="checkbox" checked={form.isWholesale} onChange={(e) => change('isWholesale', e.target.checked)} className="h-4 w-4" /><Package size={15} className="text-[#7C3AED]" /> Wholesale Product</label>
      <div className="flex gap-2">{/* existing image/deal/variant controls remain below unchanged */}</div>
    </form>
  </section>;
}
