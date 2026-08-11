'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { CheckCircle2, Edit3, ImagePlus, Save, Search, Trash2, X } from 'lucide-react';
import { adminCollection, createAdminDocument, deleteAdminDocument, updateAdminDocument, type Category } from './shared';

type CategoryWithMeta = Category & { slug?: string; active?: boolean; sortOrder?: number };
type MediaAsset = { id: string; name?: string; url: string };
const EMPTY_FORM = { title: '', slug: '', iconUrl: '', active: true };
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

export default function CategoriesManager() {
  const [categories, setCategories] = useState<CategoryWithMeta[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySearch, setGallerySearch] = useState('');

  useEffect(() => onSnapshot(adminCollection('categories'), (snapshot) => setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CategoryWithMeta).sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999)))), []);
  useEffect(() => onSnapshot(adminCollection('media_assets'), (snapshot) => setMedia(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MediaAsset))), []);
  const gallery = useMemo(() => media.filter((asset) => `${asset.name || ''} ${asset.url}`.toLowerCase().includes(gallerySearch.toLowerCase())), [media, gallerySearch]);

  function handleTitleChange(title: string) { setForm((current) => ({ ...current, title, slug: current.slug || slugify(title) })); }
  function startEdit(category: CategoryWithMeta) { setEditingId(category.id); setForm({ title: category.title, slug: category.slug || slugify(category.title), iconUrl: category.iconUrl || '', active: category.active !== false }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function cancelEdit() { setEditingId(null); setForm(EMPTY_FORM); }
  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form.title.trim()) return; setIsSaving(true); setToast('');
    try { const payload = { title: form.title.trim(), slug: slugify(form.slug || form.title), iconUrl: form.iconUrl.trim(), active: form.active, sortOrder: editingId ? Number(categories.find((item) => item.id === editingId)?.sortOrder ?? categories.length + 1) : categories.length + 1 }; if (editingId) await updateAdminDocument('categories', editingId, payload); else await createAdminDocument('categories', payload); const message = editingId ? 'Category updated.' : 'Category added.'; cancelEdit(); setToast(message); } finally { setIsSaving(false); }
  }
  async function remove(category: CategoryWithMeta) { if (!confirm(`Delete ${category.title}?`)) return; await deleteAdminDocument('categories', category.id); setToast('Category deleted.'); }
  async function toggleActive(category: CategoryWithMeta) { await updateAdminDocument('categories', category.id, { active: category.active === false }); }
  async function move(category: CategoryWithMeta, direction: -1 | 1) { const index = categories.findIndex((item) => item.id === category.id); const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= categories.length) return; const other = categories[nextIndex]; await Promise.all([updateAdminDocument('categories', category.id, { sortOrder: nextIndex + 1 }), updateAdminDocument('categories', other.id, { sortOrder: index + 1 })]); }

  return <section className="mx-auto max-w-5xl px-4 py-6">
    <div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Store taxonomy</p><h2 className="mt-1 text-2xl font-black">Categories Manager</h2><p className="mt-1 text-sm text-black/50">Create the categories that appear live on the storefront.</p></div>
    <form onSubmit={handleSave} className="mt-5 grid gap-3 rounded-2xl border border-black/10 bg-white p-5 md:grid-cols-4">
      <label className="text-xs font-semibold">Category Name<input type="text" value={form.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="e.g. Bangles" required className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm" /></label>
      <label className="text-xs font-semibold">Slug<input type="text" value={form.slug} onChange={(e) => setForm((c) => ({ ...c, slug: e.target.value }))} placeholder="bangles" required className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm" /></label>
      <div className="text-xs font-semibold"><span>Category image</span><div className="mt-1.5 flex gap-2"><button type="button" onClick={() => setShowGallery(true)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-black/15 px-3 py-2 text-xs font-black"><ImagePlus size={14} /> Gallery</button>{form.iconUrl && <img src={form.iconUrl} alt="Selected" className="h-9 w-9 rounded-lg object-cover" />}</div></div>
      <label className="flex items-end gap-2 pb-2 text-xs font-bold"><input type="checkbox" checked={form.active} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} /> Show on homepage</label>
      <div className="flex gap-2 md:col-span-4"><button type="submit" disabled={isSaving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#14140F] px-5 py-2.5 text-sm font-semibold text-white">{editingId ? <Save size={15} /> : <CheckCircle2 size={15} />}{isSaving ? 'Saving...' : editingId ? 'Save Category' : 'Add Category'}</button>{editingId && <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-5 py-2.5"><X size={15} />Cancel</button>}</div>
    </form>
    {toast && <div role="status" className="mt-4 rounded-xl bg-[#0F6A5F] px-4 py-3 text-sm font-semibold text-white">{toast}</div>}
    <div className="mt-6 space-y-2">{categories.map((category, index) => <article key={category.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3 ${category.active === false ? 'border-dashed opacity-55' : 'border-black/10'}`}>
      {category.iconUrl ? <img src={category.iconUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-black/35"><ImagePlus className="h-5 w-5" /></div>}
      <div className="min-w-[160px] flex-1"><p className="truncate text-sm font-bold">{category.title}</p><p className="truncate text-xs text-black/45">/{category.slug || slugify(category.title)}</p></div>
      <span className="rounded-full bg-[#0F6A5F]/10 px-2 py-1 text-[9px] font-black uppercase text-[#0F6A5F]">{category.active === false ? 'Hidden' : 'Live'}</span>
      <div className="flex items-center gap-1"><button type="button" disabled={index === 0} onClick={() => move(category, -1)} className="rounded-lg border border-black/10 px-2 py-1 text-xs disabled:opacity-25">↑</button><button type="button" disabled={index === categories.length - 1} onClick={() => move(category, 1)} className="rounded-lg border border-black/10 px-2 py-1 text-xs disabled:opacity-25">↓</button><button type="button" onClick={() => toggleActive(category)} className="rounded-lg border border-black/10 px-2 py-1 text-[10px] font-bold">{category.active === false ? 'Show' : 'Hide'}</button><button type="button" onClick={() => startEdit(category)} className="rounded-lg p-2 text-[#0F6A5F]"><Edit3 size={15} /></button><button type="button" onClick={() => remove(category)} className="rounded-lg p-2 text-[#E1352B]"><Trash2 size={15} /></button></div>
    </article>)}{!categories.length && <p className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-black/45">No categories yet.</p>}</div>
    {showGallery && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-3xl bg-[#F4F4F1] p-5"><div className="flex items-center justify-between"><div><h3 className="text-xl font-black">Choose category image</h3><p className="text-xs text-black/45">Select an image already uploaded to Media Library.</p></div><button type="button" onClick={() => setShowGallery(false)} className="rounded-full bg-white p-2"><X /></button></div><div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2"><Search size={15} /><input value={gallerySearch} onChange={(e) => setGallerySearch(e.target.value)} placeholder="Search gallery" className="w-full bg-transparent text-sm outline-none" /></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{gallery.map((asset) => <button key={asset.id} type="button" onClick={() => { setForm((current) => ({ ...current, iconUrl: asset.url })); setShowGallery(false); }} className={`overflow-hidden rounded-xl border-2 bg-white ${form.iconUrl === asset.url ? 'border-[#0F6A5F]' : 'border-transparent'}`}><img src={asset.url} alt={asset.name || 'Media'} className="aspect-square w-full object-cover" /><span className="block truncate p-2 text-[10px] font-bold">{asset.name || 'Image'}</span></button>)}</div></div></div>}
  </section>;
}
