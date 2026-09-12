'use client';

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import Image from 'next/image';
import { Loader2, PackageSearch, Save, Search, Trash2 } from 'lucide-react';
import { productMatchesCategory } from '@/lib/categoryUtils';
import { isWholesalePriceBucket, sortPriceBuckets } from '@/lib/priceBucketUtils';
import type { PriceBucket } from '@/lib/types';
import { isWholesaleProduct } from '@/lib/wholesale';
import { adminCollection, deleteAdminDocument, updateAdminDocument, type Category, type Product } from './shared';
import { imageOf, slugify } from './products/ProductTypes';

type ProductDraft = {
  title: string;
  originalPrice: string;
  price: string;
  stock: string;
  category: string;
  priceBucketIds: string[];
  published: boolean;
  isWholesale: boolean;
};

function draftOf(product: Product): ProductDraft {
  const legacyStock = (product as any).stock ?? (product as any).quantity ?? (product as any).inventory;
  return {
    title: String(product.title || ''),
    originalPrice: String(product.originalPrice ?? product.price ?? 0),
    price: String(product.price ?? 0),
    stock: legacyStock == null ? '' : String(legacyStock),
    category: String(product.category || ''),
    priceBucketIds: Array.isArray(product.priceBucketIds) ? product.priceBucketIds.map(String) : [],
    published: product.published !== false,
    isWholesale: isWholesaleProduct(product),
  };
}

function draftsMatch(left: ProductDraft, right: ProductDraft) {
  return left.title === right.title
    && left.originalPrice === right.originalPrice
    && left.price === right.price
    && left.stock === right.stock
    && left.category === right.category
    && left.published === right.published
    && left.isWholesale === right.isWholesale
    && left.priceBucketIds.length === right.priceBucketIds.length
    && left.priceBucketIds.every((id, index) => id === right.priceBucketIds[index]);
}

function safeNumber(value: string, label: string) {
  const number = Number(value);
  if (value.trim() === '' || !Number.isFinite(number) || number < 0) throw new Error(`${label} must be 0 or more.`);
  return number;
}

function updatePayload(product: Product, draft: ProductDraft) {
  const originalPrice = safeNumber(draft.originalPrice, 'Original price');
  const price = safeNumber(draft.price, 'Price');
  const stock = draft.stock.trim() === '' ? null : safeNumber(draft.stock, 'Stock');
  if (!draft.title.trim()) throw new Error('Product name is required.');
  if (!draft.category) throw new Error('Category is required.');
  if (price > originalPrice) throw new Error('Price cannot be higher than original price.');

  const variantMatrix = Array.isArray(product.variantMatrix)
    ? product.variantMatrix.map((row: any) => ({ ...row, price: String(price) }))
    : product.variantMatrix;

  return {
    title: draft.title.trim(),
    slug: slugify(draft.title),
    originalPrice,
    price,
    ...(stock != null ? { stock } : {}),
    category: draft.category,
    priceBucketIds: draft.priceBucketIds,
    published: draft.published,
    isWholesale: draft.isWholesale,
    ...(variantMatrix ? { variantMatrix } : {}),
    updatedAt: new Date().toISOString(),
  };
}

async function inBatches<T>(items: T[], task: (item: T) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += 10) {
    await Promise.all(items.slice(index, index + 10).map(task));
  }
}

export default function BulkProductEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceBuckets, setPriceBuckets] = useState<PriceBucket[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceBucketFilter, setPriceBucketFilter] = useState('all');
  const [wholesaleFilter, setWholesaleFilter] = useState<'all' | 'true' | 'false'>('all');
  const [changedDrafts, setChangedDrafts] = useState<Record<string, ProductDraft>>({});
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState('');
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

  useEffect(() => onSnapshot(
    adminCollection('settings'),
    snapshot => {
      const settings = snapshot.docs.find(item => item.id === 'main')?.data();
      const buckets = Array.isArray(settings?.priceBuckets) ? settings.priceBuckets as PriceBucket[] : [];
      setPriceBuckets(sortPriceBuckets(buckets.filter(bucket => bucket.active !== false)));
    },
    error => setMessage(`Price buckets could not load: ${error.message}`),
  ), []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products.filter(product => {
      const matchesSearch = !needle || `${product.title || ''} ${product.category || ''}`.toLowerCase().includes(needle);
      const matchesCategory = productMatchesCategory(categoryFilter, product, categories);
      const assignedBuckets = Array.isArray(product.priceBucketIds) ? product.priceBucketIds.map(String) : [];
      const selectedBucket = priceBuckets.find(bucket => bucket.id === priceBucketFilter);
      const matchesBucket = priceBucketFilter === 'all'
        || assignedBuckets.includes(priceBucketFilter)
        || Boolean(selectedBucket && isWholesalePriceBucket(selectedBucket) && isWholesaleProduct(product));
      const wholesale = isWholesaleProduct(product);
      const matchesWholesale = wholesaleFilter === 'all' || wholesale === (wholesaleFilter === 'true');
      return matchesSearch && matchesCategory && matchesBucket && matchesWholesale;
    });
  }, [products, categories, priceBuckets, query, categoryFilter, priceBucketFilter, wholesaleFilter]);

  const changedCount = Object.keys(changedDrafts).length;

  function changeDraft(product: Product, nextDraft: ProductDraft) {
    setChangedDrafts(current => {
      const next = { ...current };
      if (draftsMatch(nextDraft, draftOf(product))) delete next[product.id];
      else next[product.id] = nextDraft;
      return next;
    });
  }

  async function saveAllChanges() {
    const changedEntries = Object.entries(changedDrafts)
      .map(([id, draft]) => ({ product: products.find(product => product.id === id), draft }))
      .filter((entry): entry is { product: Product; draft: ProductDraft } => Boolean(entry.product));

    if (!changedEntries.length) return setMessage('No product changes to save.');

    let prepared: Array<{ product: Product; payload: ReturnType<typeof updatePayload> }>;
    try {
      prepared = changedEntries.map(({ product, draft }) => ({ product, payload: updatePayload(product, draft) }));
    } catch (error) {
      return setMessage(error instanceof Error ? error.message : 'One or more product values are invalid.');
    }

    setBusy(true);
    setMessage('');
    try {
      await inBatches(prepared, ({ product, payload }) => updateAdminDocument('products', product.id, payload));
      const savedIds = new Set(prepared.map(({ product }) => product.id));
      setChangedDrafts(current => Object.fromEntries(Object.entries(current).filter(([id]) => !savedIds.has(id))));
      setMessage(`${prepared.length} changed product${prepared.length === 1 ? '' : 's'} saved successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Changed products could not all be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(product: Product) {
    if (!confirm(`Delete ${product.title}? This cannot be undone.`)) return;
    setDeletingId(product.id);
    setMessage('');
    try {
      await deleteAdminDocument('products', product.id);
      setChangedDrafts(current => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setMessage(`${product.title} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Product could not be deleted.');
    } finally {
      setDeletingId('');
    }
  }

  return <section className="mx-auto max-w-6xl px-4 py-6 pb-28">
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E1352B] text-white"><PackageSearch size={21}/></div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Bulk catalog control</p>
        <h2 className="mt-1 text-2xl font-black">Product Editor</h2>
        <p className="mt-1 text-sm text-black/50">Filter category-wise, edit multiple products, then save all changed products together.</p>
      </div>
    </div>

    {message && <div role="status" className="mt-4 rounded-xl bg-white p-3 text-xs font-bold text-black/65 shadow-sm">{message}</div>}

    <div className="mt-5 rounded-3xl bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_210px_210px_170px]">
        <label className="flex items-center gap-2 rounded-xl bg-[#F4F4F1] px-3"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search product name" className="w-full bg-transparent py-3 text-sm outline-none"/></label>
        <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm font-bold"><option value="all">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}</select>
        <select value={priceBucketFilter} onChange={event => setPriceBucketFilter(event.target.value)} className="rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm font-bold"><option value="all">All price buckets</option>{priceBuckets.map(bucket => <option key={bucket.id} value={bucket.id}>{bucket.title}</option>)}</select>
        <select value={wholesaleFilter} onChange={event => setWholesaleFilter(event.target.value as typeof wholesaleFilter)} className="rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm font-bold"><option value="all">All products</option><option value="true">Wholesale only</option><option value="false">Retail only</option></select>
      </div>
      <p className="mt-3 text-[10px] font-bold text-black/40">Showing {filtered.length} of {products.length} products · {changedCount} unsaved change{changedCount === 1 ? '' : 's'}</p>
    </div>

    <div className="mt-4 space-y-3">
      {filtered.map(product => <EditableProductRow
        key={product.id}
        product={product}
        draft={changedDrafts[product.id] ?? draftOf(product)}
        categories={categories}
        priceBuckets={priceBuckets}
        disabled={busy || Boolean(deletingId)}
        deleting={deletingId === product.id}
        onChange={draft => changeDraft(product, draft)}
        onDelete={() => deleteOne(product)}
      />)}
    </div>

    {!filtered.length && <div className="mt-4 rounded-3xl border border-dashed border-black/15 bg-white p-10 text-center text-sm font-bold text-black/40">No products found in this category.</div>}

    <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-black">Save all changed products</p>
        <p className="mt-0.5 text-[10px] text-black/45">Edit as many product rows as needed. This saves every changed row in one action.</p>
      </div>
      <button type="button" disabled={busy || Boolean(deletingId) || changedCount === 0} onClick={saveAllChanges} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-[10px] font-black text-white disabled:opacity-40">
        {busy ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}Save all changes{changedCount > 0 ? ` (${changedCount})` : ''}
      </button>
    </div>
  </section>;
}

function EditableProductRow({ product, draft, categories, priceBuckets, disabled, deleting, onChange, onDelete }: { product: Product; draft: ProductDraft; categories: Category[]; priceBuckets: PriceBucket[]; disabled: boolean; deleting: boolean; onChange: (draft: ProductDraft) => void; onDelete: () => void }) {
  const hasLegacyCategory = Boolean(draft.category && !categories.some(category => category.id === draft.category));
  const inputClass = 'min-w-0 rounded-xl bg-[#F4F4F1] px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#0F6A5F]/20 disabled:opacity-50';
  return <article className="rounded-2xl border border-transparent bg-white p-3 shadow-sm">
    <div className="grid items-center gap-3 lg:grid-cols-[72px_minmax(180px,1fr)_110px_110px_90px_155px_120px_auto]">
      <div className="relative h-16 w-[72px] overflow-hidden rounded-xl bg-[#F4F4F1]">{imageOf(product) ? <Image src={imageOf(product)} alt="" fill unoptimized sizes="72px" className="object-cover"/> : <div className="grid h-full place-items-center text-[8px] font-bold text-black/30">No image</div>}</div>
      <input aria-label="Product name" disabled={disabled} value={draft.title} onChange={event => onChange({ ...draft, title: event.target.value })} className={`${inputClass} font-bold`}/>
      <label className="grid gap-1"><span className="text-[8px] font-black uppercase text-black/35">Original</span><input aria-label="Original price" disabled={disabled} type="number" min="0" value={draft.originalPrice} onChange={event => onChange({ ...draft, originalPrice: event.target.value })} className={inputClass}/></label>
      <label className="grid gap-1"><span className="text-[8px] font-black uppercase text-black/35">Sale price</span><input aria-label="Sale price" disabled={disabled} type="number" min="0" value={draft.price} onChange={event => onChange({ ...draft, price: event.target.value })} className={inputClass}/></label>
      <label className="grid gap-1"><span className="text-[8px] font-black uppercase text-black/35">Stock</span><input aria-label="Stock" disabled={disabled} type="number" min="0" value={draft.stock} onChange={event => onChange({ ...draft, stock: event.target.value })} placeholder="Keep existing" className={inputClass}/></label>
      <select aria-label="Category" disabled={disabled} value={draft.category} onChange={event => onChange({ ...draft, category: event.target.value })} className={inputClass}><option value="">Select category</option>{hasLegacyCategory && <option value={draft.category}>Current: {draft.category}</option>}{categories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}</select>
      <div className="grid gap-1.5 text-[10px] font-bold">
        <label className="flex items-center gap-2"><input disabled={disabled} type="checkbox" checked={draft.published} onChange={event => onChange({ ...draft, published: event.target.checked })} className="accent-[#0F6A5F]"/>Published</label>
        <label className="flex items-center gap-2"><input disabled={disabled} type="checkbox" checked={draft.isWholesale} onChange={event => { const enabled = event.target.checked; const wholesaleIds = new Set(priceBuckets.filter(isWholesalePriceBucket).map(bucket => bucket.id)); onChange({ ...draft, isWholesale: enabled, priceBucketIds: enabled ? Array.from(new Set([...draft.priceBucketIds, ...wholesaleIds])) : draft.priceBucketIds.filter(id => !wholesaleIds.has(id)) }); }} className="accent-[#E1352B]"/>Wholesale</label>
      </div>
      <button type="button" disabled={disabled} onClick={onDelete} aria-label={`Delete ${product.title}`} className="rounded-xl bg-red-50 p-2.5 text-[#E1352B] disabled:opacity-40">{deleting ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}</button>
    </div>
    {priceBuckets.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3"><span className="mr-1 text-[8px] font-black uppercase tracking-wider text-black/35">Price buckets</span>{priceBuckets.map(bucket => <label key={bucket.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-bold ${draft.priceBucketIds.includes(bucket.id) ? 'bg-[#0F6A5F] text-white' : 'bg-[#F4F4F1] text-black/55'}`}><input disabled={disabled} type="checkbox" checked={draft.priceBucketIds.includes(bucket.id)} onChange={event => { const enabled = event.target.checked; onChange({ ...draft, priceBucketIds: enabled ? Array.from(new Set([...draft.priceBucketIds, bucket.id])) : draft.priceBucketIds.filter(id => id !== bucket.id), ...(isWholesalePriceBucket(bucket) ? { isWholesale: enabled } : {}) }); }} className="h-3 w-3"/>{bucket.title}</label>)}</div>}
  </article>;
}
