'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { CheckCircle2, GripVertical, ImagePlus, Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import { adminCollection, createAdminDocument, deleteAdminDocument, updateAdminDocument, type Category } from './shared';

type CategoryWithMeta = Category & { slug?: string; sortOrder?: number; active?: boolean };
type CategoryForm = { title: string; slug: string; iconUrl: string; sortOrder: number; active: boolean };

const EMPTY_FORM: CategoryForm = { title: '', slug: '', iconUrl: '', sortOrder: 1, active: true };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function CategoriesManager() {
  const [categories, setCategories] = useState<CategoryWithMeta[]>([]);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => onSnapshot(adminCollection('categories'), (snapshot) => {
    setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CategoryWithMeta));
  }), []);

  const orderedCategories = useMemo(() => [...categories].sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) || a.title.localeCompare(b.title)), [categories]);

  function handleTitleChange(title: string) {
    setForm((current) => ({ ...current, title, slug: current.slug || slugify(title) }));
  }

  function startEdit(category: CategoryWithMeta) {
    setEditingId(category.id);
    setForm({ title: category.title, slug: category.slug || slugify(category.title), iconUrl: category.iconUrl || '', sortOrder: Number(category.sortOrder ?? orderedCategories.length + 1), active: category.active ?? true });
    setToast('');
  }

  function resetForm() { setEditingId(null); setForm({ ...EMPTY_FORM, sortOrder: orderedCategories.length + 1 }); }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setIsSaving(true); setToast('');
    try {
      const payload = { title: form.title.trim(), slug: slugify(form.slug || form.title), iconUrl: form.iconUrl.trim(), sortOrder: Math.max(1, Number(form.sortOrder) || 1), active: form.active };
      if (editingId) await updateAdminDocument('categories', editingId, payload);
      else await createAdminDocument('categories', payload);
      setToast(editingId ? 'Category updated.' : 'Category created.');
      resetForm();
    } catch { setToast('Unable to save category.'); }
    finally { setIsSaving(false); }
  }

  async function toggleActive(category: CategoryWithMeta) {
    await updateAdminDocument('categories', category.id, { active: !(category.active ?? true) });
  }

  async function handleDeleteCategory(category: CategoryWithMeta) {
    if (!confirm(`Delete ${category.title}? Products using this category will not be deleted.`)) return;
    await deleteAdminDocument('categories', category.id);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-black">Categories Manager</h2><p className="mt-1 text-sm text-black/55">Homepage categories are fully controlled here. Create, edit, order, show/hide and remove them without touching code.</p></div>
        {editingId && <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-black"><X size={14}/> Cancel edit</button>}
      </div>

      <form onSubmit={saveCategory} className="mt-5 grid gap-3 rounded-2xl border border-black/10 bg-white p-5 md:grid-cols-[1.2fr_1fr_1.4fr_110px_90px] md:items-end">
        <label className="text-xs font-semibold">Category Name<input type="text" value={form.title} onChange={(event) => handleTitleChange(event.target.value)} placeholder="e.g. Bangles" required className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#F4F4F1] px-3 py-2.5 text-sm outline-none" /></label>
        <label className="text-xs font-semibold">Slug<input type="text" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="bangles" required className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#F4F4F1] px-3 py-2.5 text-sm outline-none" /></label>
        <label className="text-xs font-semibold">Icon / Image URL<input type="url" value={form.iconUrl} onChange={(event) => setForm((current) => ({ ...current, iconUrl: event.target.value }))} placeholder="https://..." className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#F4F4F1] px-3 py-2.5 text-sm outline-none" /></label>
        <label className="text-xs font-semibold">Order<input type="number" min="1" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#F4F4F1] px-3 py-2.5 text-sm outline-none" /></label>
        <label className="flex items-center gap-2 rounded-xl bg-[#F4F4F1] px-3 py-2.5 text-xs font-bold"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}/> Show</label>
        <button type="submit" disabled={isSaving} className="flex items-center justify-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-sm font-black text-white disabled:opacity-50 md:col-span-5">{isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : editingId ? <Save size={15}/> : <CheckCircle2 size={15}/>} {isSaving ? 'Saving...' : editingId ? 'Save Category Changes' : 'Add Category'}</button>
      </form>

      <div className="mt-6 space-y-2">
        {orderedCategories.map((category) => {
          const active = category.active ?? true;
          return <article key={category.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3 ${active ? 'border-black/10' : 'border-dashed border-black/20 opacity-55'}`}>
            <GripVertical className="h-4 w-4 text-black/20" aria-hidden="true" />
            {category.iconUrl ? <img src={category.iconUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF0C9] text-[#B77900]"><ImagePlus className="h-5 w-5" /></div>}
            <div className="min-w-[150px] flex-1"><p className="truncate text-sm font-black">{category.title}</p><p className="truncate text-xs text-black/40">/{category.slug || slugify(category.title)} · order {category.sortOrder ?? '—'}</p></div>
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${active ? 'bg-[#E5F6F2] text-[#0F6A5F]' : 'bg-black/5 text-black/40'}`}>{active ? 'Visible' : 'Hidden'}</span>
            <button type="button" onClick={() => toggleActive(category)} className="rounded-lg border border-black/10 px-3 py-2 text-[10px] font-black">{active ? 'Hide' : 'Show'}</button>
            <button type="button" onClick={() => startEdit(category)} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-3 py-2 text-[10px] font-black"><Pencil size={13}/> Edit</button>
            <button type="button" aria-label={`Delete ${category.title}`} onClick={() => handleDeleteCategory(category)} className="rounded-lg p-2 text-[#E1352B] hover:bg-[#FDECEC]"><Trash2 className="h-4 w-4" /></button>
          </article>;
        })}
        {orderedCategories.length === 0 && <p className="rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm text-black/45">No categories yet. Add your first category above.</p>}
      </div>
      {toast && <div role="status" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 size={16}/>{toast}</div>}
    </section>
  );
}
