'use client';

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import Image from 'next/image';
import { CheckSquare2, Loader2, PackageSearch, Save, Search, Trash2 } from 'lucide-react';
import { productMatchesCategory } from '@/lib/categoryUtils';
import { adminCollection, deleteAdminDocument, updateAdminDocument, type Category, type Product } from './shared';
import { imageOf, slugify } from './products/ProductTypes';

type ProductDraft = {
  title: string;
  originalPrice: string;
  price: string;
  stock: string;
  category: string;
  published: boolean;
};

type BulkDraft = {
  category: string;
  originalPrice: string;
  price: string;
  stock: string;
  published: '' | 'true' | 'false';
};

const EMPTY_BULK: BulkDraft = { category: '', originalPrice: '', price: '', stock: '', published: '' };

function draftOf(product: Product): ProductDraft {
  return {
    title: String(product.title || ''),
    originalPrice: String(product.originalPrice ?? product.price ?? 0),
    price: String(product.price ?? 0),
    stock: String(product.stock ?? 0),
    category: String(product.category || ''),
    published: product.published !== false,
  };
}

function safeNumber(value: string, label: string) {
  const number = Number(value);
  if (value.trim() === '' || !Number.isFinite(number) || number < 0) throw new Error(`${label} must be 0 or more.`);
  return number;
}

async function inBatches<T>(items: T[], task: (item: T) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += 10) {
    await Promise.all(items.slice(index, index + 10).map(task));
  }
}

export default function BulkProductEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [bulk, setBulk] = useState<BulkDraft>(EMPTY_BULK);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => onSnapshot(
    adminCollection('products'),
    snapshot => setProducts(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Product)),
    error => setMessage(`Products could not load: ${error.message}`),
  ), []);

  useEffect(() => onSnapshot(
    adminCollection('categories'),
    snapshot => setCategories(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Category).sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999))),
    error => setMessage(`Categories could not load: ${error.message}`),
  ), []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter(product => {
      const matchesSearch = !needle || `${product.title || ''} ${product.category || ''}`.toLowerCase().includes(needle);
      return matchesSearch && productMatchesCategory(categoryFilter, product, categories);
    });
  }, [products, categories, query, categoryFilter]);

  const visibleIds = filtered.map(product => product.id);
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const selectedProducts = products.filter(product => selectedIds.has(product.id));

  function toggleVisible() {
    setSelected(current => allVisibleSelected
      ? current.filter(id => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
  }

  async function saveOne(product: Product, draft: ProductDraft) {
    setSavingId(product.id);
    setMessage('');
    try {
      const originalPrice = safeNumber(draft.originalPrice, 'Original price');
      const price = safeNumber(draft.price, 'Price');
      const stock = safeNumber(draft.stock, 'Stock');
      if (!draft.title.trim()) throw new Error('Product name is required.');
      if (!draft.category) throw new Error('Category is required.');
      if (price > originalPrice) throw new Error('Price cannot be higher than original price.');
      const variantMatrix = Array.isArray(product.variantMatrix)
        ? product.variantMatrix.map((row: any) => ({ ...row, price: String(price) }))
        : product.variantMatrix;
      await updateAdminDocument('products', product.id, {
        title: draft.title.trim(), slug: slugify(draft.title), originalPrice, price, stock, category: draft.category,
        published: draft.published, ...(variantMatrix ? { variantMatrix } : {}), updatedAt: new Date().toISOString(),
      });
      setMessage(`${draft.title.trim()} updated successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Product could not be updated.');
    } finally {
      setSavingId('');
    }
  }

  async function applyBulk() {
    if (!selectedProducts.length) return setMessage('Select at least one product first.');
    const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    try {
      if (bulk.category) payload.category = bulk.category;
      if (bulk.originalPrice !== '') payload.originalPrice = safeNumber(bulk.originalPrice, 'Original price');
      if (bulk.price !== '') payload.price = safeNumber(bulk.price, 'Price');
      if (bulk.stock !== '') payload.stock = safeNumber(bulk.stock, 'Stock');
      if (bulk.published !== '') payload.published = bulk.published === 'true';
      if (Object.keys(payload).length === 1) throw new Error('Choose at least one bulk change.');
      const invalidPrice = selectedProducts.some(product => {
        const nextPrice = typeof payload.price === 'number' ? payload.price : Number(product.price || 0);
        const nextOriginal = typeof payload.originalPrice === 'number' ? payload.originalPrice : Number(product.originalPrice ?? product.price ?? 0);
        return nextPrice > nextOriginal;
      });
      if (invalidPrice) throw new Error('Price cannot be higher than original price for any selected product.');
    } catch (error) {
      return setMessage(error instanceof Error ? error.message : 'Bulk values are invalid.');
    }
    if (!confirm(`Apply these changes to ${selectedProducts.length} selected product${selectedProducts.length === 1 ? '' : 's'}?`)) return;
    setBusy(true);
    setMessage('');
    try {
      await inBatches(selectedProducts, product => {
        const update = { ...payload };
        if (typeof payload.price === 'number' && Array.isArray(product.variantMatrix)) {
          update.variantMatrix = product.variantMatrix.map((row: any) => ({ ...row, price: String(payload.price) }));
        }
        return updateAdminDocument('products', product.id, update);
      });
      setBulk(EMPTY_BULK);
      setMessage(`${selectedProducts.length} product${selectedProducts.length === 1 ? '' : 's'} updated successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bulk update could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selectedProducts.length) return setMessage('Select at least one product first.');
    if (!confirm(`Permanently delete ${selectedProducts.length} selected product${selectedProducts.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setBusy(true);
    setMessage('');
    try {
      await inBatches(selectedProducts, product => deleteAdminDocument('products', product.id));
      setSelected([]);
      setMessage(`${selectedProducts.length} product${selectedProducts.length === 1 ? '' : 's'} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Selected products could not be deleted.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="mx-auto max-w-6xl px-4 py-6">
    <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E1352B] text-white"><PackageSearch size={21}/></div><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Bulk catalog control</p><h2 className="mt-1 text-2xl font-black">Product Editor</h2><p className="mt-1 text-sm text-black/50">Filter category-wise, quickly edit each product, or update and delete selected products together.</p></div></div>

    {message && <div role="status" className="mt-4 rounded-xl bg-white p-3 text-xs font-bold text-black/65 shadow-sm">{message}</div>}

    <div className="mt-5 rounded-3xl bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
        <label className="flex items-center gap-2 rounded-xl bg-[#F4F4F1] px-3"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search product name" className="w-full bg-transparent py-3 text-sm outline-none"/></label>
        <select value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setSelected([]); }} className="rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm font-bold"><option value="all">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}</select>
        <button type="button" onClick={toggleVisible} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14140F] px-4 py-3 text-[10px] font-black text-white"><CheckSquare2 size={14}/>{allVisibleSelected ? 'Clear visible' : `Select visible (${filtered.length})`}</button>
      </div>
      <p className="mt-3 text-[10px] font-bold text-black/40">Showing {filtered.length} of {products.length} products · {selected.length} selected</p>
    </div>

    <div className="mt-4 rounded-3xl border border-[#E1352B]/15 bg-[#FFF8F7] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black">Bulk edit selected products</p><p className="text-[10px] text-black/45">Leave any field unchanged by keeping it blank.</p></div><span className="rounded-full bg-[#E1352B] px-3 py-1 text-[9px] font-black text-white">{selected.length} selected</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select value={bulk.category} onChange={event => setBulk(current => ({ ...current, category: event.target.value }))} className="rounded-xl bg-white px-3 py-3 text-xs"><option value="">Keep category</option>{categories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}</select>
        <input type="number" min="0" value={bulk.originalPrice} onChange={event => setBulk(current => ({ ...current, originalPrice: event.target.value }))} placeholder="New original price" className="rounded-xl bg-white px-3 py-3 text-xs"/>
        <input type="number" min="0" value={bulk.price} onChange={event => setBulk(current => ({ ...current, price: event.target.value }))} placeholder="New sale price" className="rounded-xl bg-white px-3 py-3 text-xs"/>
        <input type="number" min="0" value={bulk.stock} onChange={event => setBulk(current => ({ ...current, stock: event.target.value }))} placeholder="New stock" className="rounded-xl bg-white px-3 py-3 text-xs"/>
        <select value={bulk.published} onChange={event => setBulk(current => ({ ...current, published: event.target.value as BulkDraft['published'] }))} className="rounded-xl bg-white px-3 py-3 text-xs"><option value="">Keep visibility</option><option value="true">Show on store</option><option value="false">Hide from store</option></select>
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || !selected.length} onClick={applyBulk} className="inline-flex items-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-[10px] font-black text-white disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}Apply bulk changes</button><button type="button" disabled={busy || !selected.length} onClick={deleteSelected} className="inline-flex items-center gap-2 rounded-xl bg-[#E1352B] px-4 py-3 text-[10px] font-black text-white disabled:opacity-40"><Trash2 size={14}/>Delete selected</button></div>
    </div>

    <div className="mt-4 space-y-3">{filtered.map(product => <EditableProductRow key={product.id} product={product} categories={categories} checked={selectedIds.has(product.id)} saving={savingId === product.id} disabled={busy} onChecked={checked => setSelected(current => checked ? Array.from(new Set([...current, product.id])) : current.filter(id => id !== product.id))} onSave={draft => saveOne(product, draft)} onDelete={async () => { if (!confirm(`Delete ${product.title}? This cannot be undone.`)) return; setSavingId(product.id); try { await deleteAdminDocument('products', product.id); setSelected(current => current.filter(id => id !== product.id)); setMessage(`${product.title} deleted.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Product could not be deleted.'); } finally { setSavingId(''); } }}/>)}</div>
    {!filtered.length && <div className="mt-4 rounded-3xl border border-dashed border-black/15 bg-white p-10 text-center text-sm font-bold text-black/40">No products found in this category.</div>}
  </section>;
}

function EditableProductRow({ product, categories, checked, saving, disabled, onChecked, onSave, onDelete }: { product: Product; categories: Category[]; checked: boolean; saving: boolean; disabled: boolean; onChecked: (checked: boolean) => void; onSave: (draft: ProductDraft) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState<ProductDraft>(() => draftOf(product));
  useEffect(() => setDraft(draftOf(product)), [product]);
  const hasLegacyCategory = Boolean(draft.category && !categories.some(category => category.id === draft.category));
  const inputClass = 'min-w-0 rounded-xl bg-[#F4F4F1] px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#0F6A5F]/20';
  return <article className={`rounded-2xl border bg-white p-3 shadow-sm ${checked ? 'border-[#E1352B]/45 ring-2 ring-[#E1352B]/10' : 'border-transparent'}`}>
    <div className="grid items-center gap-3 lg:grid-cols-[28px_72px_minmax(180px,1fr)_120px_120px_100px_170px_95px_auto]">
      <input aria-label={`Select ${product.title}`} type="checkbox" checked={checked} onChange={event => onChecked(event.target.checked)} className="h-4 w-4 accent-[#E1352B]"/>
      <div className="relative h-16 w-[72px] overflow-hidden rounded-xl bg-[#F4F4F1]">{imageOf(product) ? <Image src={imageOf(product)} alt="" fill unoptimized sizes="72px" className="object-cover"/> : <div className="grid h-full place-items-center text-[8px] font-bold text-black/30">No image</div>}</div>
      <input aria-label="Product name" value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} className={`${inputClass} font-bold`}/>
      <label className="grid gap-1"><span className="text-[8px] font-black uppercase text-black/35">Original</span><input aria-label="Original price" type="number" min="0" value={draft.originalPrice} onChange={event => setDraft(current => ({ ...current, originalPrice: event.target.value }))} className={inputClass}/></label>
      <label className="grid gap-1"><span className="text-[8px] font-black uppercase text-black/35">Sale price</span><input aria-label="Sale price" type="number" min="0" value={draft.price} onChange={event => setDraft(current => ({ ...current, price: event.target.value }))} className={inputClass}/></label>
      <label className="grid gap-1"><span className="text-[8px] font-black uppercase text-black/35">Stock</span><input aria-label="Stock" type="number" min="0" value={draft.stock} onChange={event => setDraft(current => ({ ...current, stock: event.target.value }))} className={inputClass}/></label>
      <select aria-label="Category" value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))} className={inputClass}><option value="">Select category</option>{hasLegacyCategory && <option value={draft.category}>Current: {draft.category}</option>}{categories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}</select>
      <label className="flex items-center gap-2 text-[10px] font-bold"><input type="checkbox" checked={draft.published} onChange={event => setDraft(current => ({ ...current, published: event.target.checked }))} className="accent-[#0F6A5F]"/>Published</label>
      <div className="flex gap-1"><button type="button" disabled={saving || disabled} onClick={() => onSave(draft)} aria-label={`Save ${product.title}`} className="rounded-xl bg-[#14140F] p-2.5 text-white disabled:opacity-40">{saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}</button><button type="button" disabled={saving || disabled} onClick={onDelete} aria-label={`Delete ${product.title}`} className="rounded-xl bg-red-50 p-2.5 text-[#E1352B] disabled:opacity-40"><Trash2 size={14}/></button></div>
    </div>
  </article>;
}
