'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { CheckCircle2, Edit3, ImagePlus, Loader2, Save, Search, Trash2, X } from 'lucide-react';
import { adminCollection, createAdminDocument, deleteAdminDocument, getAdminDocument, setAdminDocument, updateAdminDocument, uploadImageToImgBB, type Category } from './shared';
import type { PriceBucket } from '@/lib/types';

type CategoryWithMeta = Category & { slug?: string; active?: boolean; sortOrder?: number };
type MediaAsset = { id: string; name?: string; url: string };
type Tab = 'categories' | 'buckets';

const EMPTY_FORM = { title: '', slug: '', iconUrl: '', active: true };
const EMPTY_BUCKET = { id: '', title: '', amount: 0, iconUrl: '', accent: '#FFB020', sortOrder: 1, active: true };
const DEFAULT_BUCKETS: PriceBucket[] = [
  { id: 'under-99', title: 'Under 99', amount: 99, iconUrl: '', accent: '#E1352B', sortOrder: 1, active: true },
  { id: 'under-299', title: 'Under 299', amount: 299, iconUrl: '', accent: '#D99A17', sortOrder: 2, active: true },
  { id: 'under-999', title: 'Under 999', amount: 999, iconUrl: '', accent: '#0F6A5F', sortOrder: 3, active: true },
];

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

export default function CategoriesManager() {
  const [tab, setTab] = useState<Tab>('categories');
  const [categories, setCategories] = useState<CategoryWithMeta[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<PriceBucket[]>([]);
  const [bucketForm, setBucketForm] = useState<PriceBucket>(EMPTY_BUCKET);
  const [editingBucketId, setEditingBucketId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryTarget, setGalleryTarget] = useState<'category' | 'bucket'>('category');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => onSnapshot(adminCollection('categories'), (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CategoryWithMeta).sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999)))), []);
  useEffect(() => onSnapshot(adminCollection('media_assets'), (snapshot) => setMedia(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MediaAsset))), []);
  useEffect(() => {
    getAdminDocument('settings', 'main').then((snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : {};
      const saved = Array.isArray(data.priceBuckets) ? data.priceBuckets as PriceBucket[] : [];
      setBuckets(saved.length ? saved.sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder)) : DEFAULT_BUCKETS);
    });
  }, []);

  const gallery = useMemo(() => media.filter((asset) => `${asset.name || ''} ${asset.url}`.toLowerCase().includes(gallerySearch.toLowerCase())), [media, gallerySearch]);

  function handleTitleChange(title: string) { setForm((current) => ({ ...current, title, slug: current.slug || slugify(title) })); }
  function startEdit(category: CategoryWithMeta) { setEditingId(category.id); setForm({ title: category.title, slug: category.slug || slugify(category.title), iconUrl: category.iconUrl || '', active: category.active !== false }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function cancelEdit() { setEditingId(null); setForm(EMPTY_FORM); }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form.title.trim()) return; setIsSaving(true); setToast('');
    try {
      const payload = { title: form.title.trim(), slug: slugify(form.slug || form.title), iconUrl: form.iconUrl.trim(), active: form.active, sortOrder: editingId ? Number(categories.find((item) => item.id === editingId)?.sortOrder ?? categories.length + 1) : categories.length + 1 };
      if (editingId) await updateAdminDocument('categories', editingId, payload); else await createAdminDocument('categories', payload);
      cancelEdit(); setToast(editingId ? 'Category updated.' : 'Category added.');
    } catch { setToast('Unable to save category.'); } finally { setIsSaving(false); }
  }

  async function remove(category: CategoryWithMeta) { if (!confirm(`Delete ${category.title}?`)) return; await deleteAdminDocument('categories', category.id); setToast('Category deleted.'); }
  async function toggleActive(category: CategoryWithMeta) { await updateAdminDocument('categories', category.id, { active: category.active === false }); }
  async function move(category: CategoryWithMeta, direction: -1 | 1) { const index = categories.findIndex((item) => item.id === category.id); const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= categories.length) return; const other = categories[nextIndex]; await Promise.all([updateAdminDocument('categories', category.id, { sortOrder: nextIndex + 1 }), updateAdminDocument('categories', other.id, { sortOrder: index + 1 })]); }

  function openGallery(target: 'category' | 'bucket') { setGalleryTarget(target); setGallerySearch(''); setShowGallery(true); }
  function chooseGalleryImage(url: string) {
    if (galleryTarget === 'category') setForm((current) => ({ ...current, iconUrl: url }));
    else setBucketForm((current) => ({ ...current, iconUrl: url }));
    setShowGallery(false);
  }

  async function uploadFromDevice(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true); setToast('');
    try {
      const url = await uploadImageToImgBB(file);
      await createAdminDocument('media_assets', { name: file.name, url, type: file.type, createdAt: new Date().toISOString(), source: 'admin-device' });
      if (galleryTarget === 'category') setForm((current) => ({ ...current, iconUrl: url }));
      else setBucketForm((current) => ({ ...current, iconUrl: url }));
      setToast('Image uploaded and selected.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Image upload failed.'); }
    finally { setUploading(false); }
  }

  function startBucketEdit(bucket: PriceBucket) { setEditingBucketId(bucket.id); setBucketForm({ ...bucket }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function cancelBucketEdit() { setEditingBucketId(null); setBucketForm({ ...EMPTY_BUCKET, id: '' }); }
  async function saveBucket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bucketForm.title.trim() || Number(bucketForm.amount) < 0) { setToast('Enter a bucket name and valid maximum price.'); return; }
    setIsSaving(true); setToast('');
    try {
      const next = [...buckets];
      const payload: PriceBucket = { ...bucketForm, id: editingBucketId || `bucket-${Date.now()}`, title: bucketForm.title.trim(), amount: Number(bucketForm.amount), sortOrder: editingBucketId ? Number(bucketForm.sortOrder) : next.length + 1 };
      const index = editingBucketId ? next.findIndex((item) => item.id === editingBucketId) : -1;
      if (index >= 0) next[index] = payload; else next.push(payload);
      const normalized = next.map((item, i) => ({ ...item, sortOrder: i + 1 }));
      await setAdminDocument('settings', 'main', { priceBuckets: normalized });
      setBuckets(normalized); cancelBucketEdit(); setToast(editingBucketId ? 'Price bucket updated.' : 'Price bucket created.');
    } catch { setToast('Unable to save price bucket.'); } finally { setIsSaving(false); }
  }
  async function removeBucket(bucket: PriceBucket) {
    if (!confirm(`Delete price bucket “${bucket.title}”? Products assigned to it will no longer appear in this bucket.`)) return;
    const normalized = buckets.filter((item) => item.id !== bucket.id).map((item, i) => ({ ...item, sortOrder: i + 1 }));
    await setAdminDocument('settings', 'main', { priceBuckets: normalized }); setBuckets(normalized); setToast('Price bucket deleted.');
  }
  async function toggleBucket(bucket: PriceBucket) { const normalized = buckets.map((item) => item.id === bucket.id ? { ...item, active: !item.active } : item); await setAdminDocument('settings', 'main', { priceBuckets: normalized }); setBuckets(normalized); }

  return <section className="mx-auto max-w-5xl px-4 py-6">
    <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Store taxonomy</p><h2 className="mt-1 text-2xl font-black">Categories & Price Buckets</h2><p className="mt-1 text-sm text-black/50">Categories, category icons and storefront price buckets are managed here.</p></div>
    <div className="mt-5 flex gap-2 rounded-2xl border border-black/10 bg-white p-2"><button type="button" onClick={() => setTab('categories')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black ${tab === 'categories' ? 'bg-[#14140F] text-white' : 'bg-black/5'}`}>Categories</button><button type="button" onClick={() => setTab('buckets')} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-black ${tab === 'buckets' ? 'bg-[#14140F] text-white' : 'bg-black/5'}`}>Price Buckets</button></div>

    {tab === 'categories' && <>
      <form onSubmit={handleSave} className="mt-5 grid gap-3 rounded-2xl border border-black/10 bg-white p-5 md:grid-cols-4">
        <label className="text-xs font-semibold">Category Name<input type="text" value={form.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="e.g. Bangles" required className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold">Slug<input type="text" value={form.slug} onChange={(e) => setForm((c) => ({ ...c, slug: e.target.value }))} placeholder="bangles" required className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm" /></label>
        <div className="text-xs font-semibold"><span>Category image</span><div className="mt-1.5 flex flex-wrap gap-2"><button type="button" onClick={() => openGallery('category')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/15 px-3 py-2 text-xs font-black"><ImagePlus size={14} /> Media Gallery</button><button type="button" disabled={uploading} onClick={() => { setGalleryTarget('category'); fileInputRef.current?.click(); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#14140F] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><ImagePlus size={14} /> {uploading ? 'Uploading...' : 'Upload from device'}</button>{form.iconUrl && <img src={form.iconUrl} alt="Selected" className="h-9 w-9 rounded-lg object-cover" />}</div></div>
        <label className="flex items-end gap-2 pb-2 text-xs font-bold"><input type="checkbox" checked={form.active} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} /> Show on homepage</label>
        <div className="flex gap-2 md:col-span-4"><button type="submit" disabled={isSaving || uploading} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#14140F] px-5 py-2.5 text-sm font-semibold text-white">{editingId ? <Save size={15} /> : <CheckCircle2 size={15} />}{isSaving ? 'Saving...' : editingId ? 'Save Category' : 'Add Category'}</button>{editingId && <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-5 py-2.5"><X size={15} />Cancel</button>}</div>
      </form>
      <div className="mt-6 space-y-2">{categories.map((category, index) => <article key={category.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3 ${category.active === false ? 'border-dashed opacity-55' : 'border-black/10'}`}>
        {category.iconUrl ? <img src={category.iconUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-black/35"><ImagePlus className="h-5 w-5" /></div>}
        <div className="min-w-[160px] flex-1"><p className="truncate text-sm font-bold">{category.title}</p><p className="truncate text-xs text-black/45">/{category.slug || slugify(category.title)}</p></div>
        <span className="rounded-full bg-[#0F6A5F]/10 px-2 py-1 text-[9px] font-black uppercase text-[#0F6A5F]">{category.active === false ? 'Hidden' : 'Live'}</span>
        <div className="flex items-center gap-1"><button type="button" disabled={index === 0} onClick={() => move(category, -1)} className="rounded-lg border border-black/10 px-2 py-1 text-xs disabled:opacity-25">↑</button><button type="button" disabled={index === categories.length - 1} onClick={() => move(category, 1)} className="rounded-lg border border-black/10 px-2 py-1 text-xs disabled:opacity-25">↓</button><button type="button" onClick={() => toggleActive(category)} className="rounded-lg border border-black/10 px-2 py-1 text-[10px] font-bold">{category.active === false ? 'Show' : 'Hide'}</button><button type="button" onClick={() => startEdit(category)} className="rounded-lg p-2 text-[#0F6A5F]"><Edit3 size={15} /></button><button type="button" onClick={() => remove(category)} className="rounded-lg p-2 text-[#E1352B]"><Trash2 size={15} /></button></div>
      </article>)}{!categories.length && <p className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-black/45">No categories yet.</p>}</div>
    </>}

    {tab === 'buckets' && <>
      <form onSubmit={saveBucket} className="mt-5 rounded-2xl border border-black/10 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Bucket name<input value={bucketForm.title} onChange={(e) => setBucketForm((c) => ({ ...c, title: e.target.value }))} placeholder="Under 500" required className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold">Maximum price (Rs.)<input type="number" min="0" value={bucketForm.amount || ''} onChange={(e) => setBucketForm((c) => ({ ...c, amount: Number(e.target.value) }))} placeholder="500" required className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm" /></label></div>
        <div className="mt-3 text-xs font-semibold"><span>Bucket icon</span><div className="mt-1.5 flex flex-wrap items-center gap-2"><button type="button" onClick={() => openGallery('bucket')} className="inline-flex items-center gap-2 rounded-lg border border-black/15 px-3 py-2 text-xs font-black"><ImagePlus size={14} /> Media Gallery</button><button type="button" disabled={uploading} onClick={() => { setGalleryTarget('bucket'); fileInputRef.current?.click(); }} className="inline-flex items-center gap-2 rounded-lg bg-[#14140F] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><ImagePlus size={14} /> {uploading ? 'Uploading...' : 'Upload from device'}</button>{bucketForm.iconUrl && <img src={bucketForm.iconUrl} alt="Selected" className="h-10 w-10 rounded-lg object-cover" />}</div></div>
        <div className="mt-3 flex items-center gap-3"><label className="text-xs font-semibold">Accent<input type="text" value={bucketForm.accent} onChange={(e) => setBucketForm((c) => ({ ...c, accent: e.target.value }))} className="ml-2 w-28 rounded-lg border border-black/15 px-3 py-2 text-xs" /></label><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={bucketForm.active} onChange={(e) => setBucketForm((c) => ({ ...c, active: e.target.checked }))} /> Active on storefront</label></div>
        <div className="mt-4 flex gap-2"><button type="submit" disabled={isSaving || uploading} className="flex-1 rounded-lg bg-[#14140F] px-5 py-2.5 text-sm font-semibold text-white">{isSaving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : editingBucketId ? 'Save Price Bucket' : 'Create Price Bucket'}</button>{editingBucketId && <button type="button" onClick={cancelBucketEdit} className="rounded-lg border border-black/10 px-5 py-2.5 text-sm font-semibold">Cancel</button>}</div>
      </form>
      <div className="mt-6 space-y-2">{buckets.map((bucket, index) => <article key={bucket.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3 ${bucket.active ? 'border-black/10' : 'border-dashed opacity-55'}`}><div className="h-12 w-12 overflow-hidden rounded-xl bg-black/5">{bucket.iconUrl ? <img src={bucket.iconUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-black">Rs</div>}</div><div className="min-w-[180px] flex-1"><p className="text-sm font-bold">{bucket.title}</p><p className="text-xs text-black/45">Products up to Rs. {bucket.amount.toLocaleString()}</p></div><span className="rounded-full bg-black/5 px-2 py-1 text-[9px] font-black uppercase">{bucket.active ? 'Live' : 'Hidden'}</span><div className="flex items-center gap-1"><button type="button" disabled={index === 0} onClick={async () => { const next = [...buckets]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; const normalized = next.map((item, i) => ({ ...item, sortOrder: i + 1 })); await setAdminDocument('settings', 'main', { priceBuckets: normalized }); setBuckets(normalized); }} className="rounded-lg border border-black/10 px-2 py-1 text-xs disabled:opacity-25">↑</button><button type="button" disabled={index === buckets.length - 1} onClick={async () => { const next = [...buckets]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; const normalized = next.map((item, i) => ({ ...item, sortOrder: i + 1 })); await setAdminDocument('settings', 'main', { priceBuckets: normalized }); setBuckets(normalized); }} className="rounded-lg border border-black/10 px-2 py-1 text-xs disabled:opacity-25">↓</button><button type="button" onClick={() => toggleBucket(bucket)} className="rounded-lg border border-black/10 px-2 py-1 text-[10px] font-bold">{bucket.active ? 'Hide' : 'Show'}</button><button type="button" onClick={() => startBucketEdit(bucket)} className="rounded-lg p-2 text-[#0F6A5F]"><Edit3 size={15} /></button><button type="button" onClick={() => removeBucket(bucket)} className="rounded-lg p-2 text-[#E1352B]"><Trash2 size={15} /></button></div></article>)}{!buckets.length && <p className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-black/45">No price buckets yet. Create your first one above.</p>}</div>
    </>}

    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={uploadFromDevice} />
    {toast && <div role="status" className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-sm font-semibold text-white">{toast}</div>}
    {showGallery && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-3xl bg-[#F4F4F1] p-5"><div className="flex items-center justify-between"><div><h3 className="text-xl font-black">Choose image</h3><p className="text-xs text-black/45">Select from Media Library, or close and upload directly from your phone/computer.</p></div><button type="button" onClick={() => setShowGallery(false)} className="rounded-full bg-white p-2"><X /></button></div><div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2"><Search size={15} /><input value={gallerySearch} onChange={(e) => setGallerySearch(e.target.value)} placeholder="Search gallery" className="w-full bg-transparent text-sm outline-none" /></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{gallery.map((asset) => <button key={asset.id} type="button" onClick={() => chooseGalleryImage(asset.url)} className={`overflow-hidden rounded-xl border-2 bg-white ${((galleryTarget === 'category' ? form.iconUrl : bucketForm.iconUrl) === asset.url) ? 'border-[#0F6A5F]' : 'border-transparent'}`}><img src={asset.url} alt={asset.name || 'Media'} className="aspect-square w-full object-cover" /><span className="block truncate p-2 text-[10px] font-bold">{asset.name || 'Image'}</span></button>)}</div>{!gallery.length && <p className="mt-6 rounded-xl border border-dashed border-black/10 p-6 text-center text-sm text-black/45">No images in Media Library yet.</p>}<button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-3 text-sm font-black text-white disabled:opacity-50"><ImagePlus size={16} /> {uploading ? 'Uploading...' : 'Upload from phone / computer'}</button></div></div>}
  </section>;
}
