'use client';

import { FormEvent, useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { CheckCircle2, Edit3, ImagePlus, Save, Trash2, X } from 'lucide-react';
import { adminCollection, createAdminDocument, deleteAdminDocument, updateAdminDocument, type Category } from './shared';

type CategoryWithMeta = Category & { slug?: string; active?: boolean; sortOrder?: number };

const EMPTY_FORM = { title: '', slug: '', iconUrl: '', active: true };

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function CategoriesManager() {
  const [categories, setCategories] = useState<CategoryWithMeta[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => onSnapshot(adminCollection('categories'), (snapshot) => {
    const next = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as CategoryWithMeta)
      .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999));
    setCategories(next);
  }), []);

  function handleTitleChange(title: string) {
    setForm((current) => ({ ...current, title, slug: current.slug || slugify(title) }));
  }

  function startEdit(category: CategoryWithMeta) {
    setEditingId(category.id);
    setForm({ title: category.title, slug: category.slug || slugify(category.title), iconUrl: category.iconUrl || '', active: category.active !== false });
    setToast('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;
    setIsSaving(true);
    setToast('');
    try {
      const payload = {
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        iconUrl: form.iconUrl.trim(),
        active: form.active,
        sortOrder: editingId ? Number(categories.find((item) => item.id === editingId)?.sortOrder ?? categories.length + 1) : categories.length + 1,
      };
      if (editingId) await updateAdminDocument('categories', editingId, payload);
      else await createAdminDocument('categories', payload);
      cancelEdit();
      setToast(editingId ? 'Category updated.' : 'Category added.');
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(category: CategoryWithMeta) {
    if (!confirm(`Delete ${category.title}?`)) return;
    await deleteAdminDocument('categories', category.id);
    setToast('Category deleted.');
  }

  async function toggleActive(category: CategoryWithMeta) {
    await updateAdminDocument('categories', category.id, { active: category.active === false });
  }

  async function move(category: CategoryWithMeta, direction: -1 | 1) {
    const index = categories.findIndex((item) => item.id === category.id);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= categories.length) return;
    const other = categories[nextIndex];
    await Promise.all([
      updateAdminDocument('categories', category.id, { sortOrder: nextIndex + 1 }),
      updateAdminDocument('categories', other.id, { sortOrder: index + 1 }),
    ]);
  }

  return <section className="mx-auto max-w-5xl px-4 py-6">
    <div className="flex items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Categories Manager</h2><p className="mt-1 text-sm text-black/50">Homepage categories are controlled entirely from here.</p></div></div>

    <form onSubmit={handleSave} className="mt-5 grid gap-3 rounded-2xl border border-black/10 bg-white p-5 md:grid-cols-4">
      <label className="text-xs font-semibold">Category Name<input type="text" value={form.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="e.g. Bangles" required className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]" /></label>
      <label className="text-xs font-semibold">Slug<input type="text" value={form.slug} onChange={(e) => setForm((c) => ({ ...c, slug: e.target.value }))} placeholder="bangles" required className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]" /></label>
      <label className="text-xs font-semibold">Icon / Image URL<input type="url" value={form.iconUrl} onChange={(e) => setForm((c) => ({ ...c, iconUrl: e.target.value }))} placeholder="https://..." className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]" /></label>
      <label className="flex items-end gap-2 pb-2 text-xs font-bold"><input type="checkbox" checked={form.active} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} /> Show on homepage</label>
      <div className="flex gap-2 md:col-span-4"><button type="submit" disabled={isSaving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#14140F] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{editingId ? <Save size={15} /> : <CheckCircle2 size={15} />}{isSaving ? 'Saving...' : editingId ? 'Save Category' : 'Add Category'}</button>{editingId && <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-5 py-2.5 text-sm font-semibold"><X size={15} />Cancel</button>}</div>
    </form>

    {toast && <div role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-sm font-semibold text-white"><CheckCircle2 size={16} />{toast}</div>}

    <div className="mt-6 space-y-2">{categories.map((category, index) => <article key={category.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3 ${category.active === false ? 'border-dashed opacity-55' : 'border-black/10'}`}>
      {category.iconUrl ? <img src={category.iconUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-black/35"><ImagePlus className="h-5 w-5" aria-hidden="true" /></div>}
      <div className="min-w-[160px] flex-1"><p className="truncate text-sm font-bold">{category.title}</p><p className="truncate text-xs text-black/45">/{category.slug || slugify(category.title)}</p></div>
      <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${category.active === false ? 'bg-black/5 text-black/40' : 'bg-[#0F6A5F]/10 text-[#0F6A5F]'}`}>{category.active === false ? 'Hidden' : 'Live'}</span>
      <div className="flex items-center gap-1"><button type="button" disabled={index === 0} onClick={() => move(category, -1)} className="rounded-lg border border-black/10 px-2 py-1 text-xs disabled:opacity-25" aria-label={`Move ${category.title} up`}>↑</button><button type="button" disabled={index === categories.length - 1} onClick={() => move(category, 1)} className="rounded-lg border border-black/10 px-2 py-1 text-xs disabled:opacity-25" aria-label={`Move ${category.title} down`}>↓</button><button type="button" onClick={() => toggleActive(category)} className="rounded-lg border border-black/10 px-2 py-1 text-[10px] font-bold">{category.active === false ? 'Show' : 'Hide'}</button><button type="button" onClick={() => startEdit(category)} className="rounded-lg p-2 text-[#0F6A5F] hover:bg-[#0F6A5F]/10" aria-label={`Edit ${category.title}`}><Edit3 size={15} /></button><button type="button" onClick={() => remove(category)} className="rounded-lg p-2 text-[#E1352B] hover:bg-[#FDECEC]" aria-label={`Delete ${category.title}`}><Trash2 size={15} /></button></div>
    </article>)}
    {categories.length === 0 && <p className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-black/45">No categories yet.</p>}
    </div>
  </section>;
}
