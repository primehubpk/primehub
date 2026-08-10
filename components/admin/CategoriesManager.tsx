'use client';

// ==================== CATEGORY MANAGEMENT ====================
import { FormEvent, useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { ImagePlus, Trash2 } from 'lucide-react';
import {
  adminCollection,
  createAdminDocument,
  deleteAdminDocument,
  type Category,
} from './shared';

type CategoryWithSlug = Category & { slug?: string };

const EMPTY_FORM = { title: '', slug: '', iconUrl: '' };

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CategoriesManager() {
  const [categories, setCategories] = useState<CategoryWithSlug[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // ==================== CATEGORY LISTENER ====================
  useEffect(() => {
    return onSnapshot(adminCollection('categories'), (snapshot) => {
      setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CategoryWithSlug));
    });
  }, []);

  // ==================== CATEGORY FORM ACTIONS ====================
  function handleTitleChange(title: string) {
    setForm((current) => ({
      ...current,
      title,
      slug: current.slug || slugify(title),
    }));
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;

    setIsSaving(true);
    try {
      await createAdminDocument('categories', {
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        iconUrl: form.iconUrl.trim(),
      });
      setForm(EMPTY_FORM);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCategory(category: CategoryWithSlug) {
    if (!confirm(`Delete ${category.title}?`)) return;
    await deleteAdminDocument('categories', category.id);
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <h2 className="text-2xl font-black">Categories Manager</h2>

      {/* ==================== CATEGORY CREATION FORM ==================== */}
      <form
        onSubmit={handleAddCategory}
        className="mt-5 grid gap-3 rounded-2xl border border-black/10 bg-white p-5 md:grid-cols-3"
      >
        <label className="text-xs font-semibold">
          Category Name
          <input
            type="text"
            value={form.title}
            onChange={(event) => handleTitleChange(event.target.value)}
            placeholder="e.g. Bangles"
            required
            className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </label>
        <label className="text-xs font-semibold">
          Slug
          <input
            type="text"
            value={form.slug}
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            placeholder="bangles"
            required
            className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </label>
        <label className="text-xs font-semibold">
          Icon/Image
          <input
            type="url"
            value={form.iconUrl}
            onChange={(event) => setForm((current) => ({ ...current, iconUrl: event.target.value }))}
            placeholder="https://..."
            className="mt-1.5 w-full rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-[#0F6A5F]"
          />
        </label>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-[#14140F] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 md:col-span-3"
        >
          {isSaving ? 'Adding category...' : 'Add Category'}
        </button>
      </form>

      {/* ==================== CATEGORY LIST GRID ==================== */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <article key={category.id} className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-3">
            {category.iconUrl ? (
              <img src={category.iconUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-black/35">
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{category.title}</p>
              <p className="truncate text-xs text-black/45">/{category.slug || slugify(category.title)}</p>
            </div>
            <button
              type="button"
              aria-label={`Delete ${category.title}`}
              onClick={() => handleDeleteCategory(category)}
              className="rounded-lg p-2 text-[#E1352B] hover:bg-[#FDECEC]"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </article>
        ))}
        {categories.length === 0 && (
          <p className="rounded-2xl border border-dashed border-black/15 p-6 text-center text-sm text-black/45 sm:col-span-2 lg:col-span-3">
            No categories yet.
          </p>
        )}
      </div>
    </section>
  );
}
