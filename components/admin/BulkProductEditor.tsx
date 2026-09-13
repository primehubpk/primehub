'use client';

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import Image from 'next/image';
import { ImagePlus, Layers3, Loader2, PackageSearch, Save, Search, Trash2 } from 'lucide-react';
import { productMatchesCategory } from '@/lib/categoryUtils';
import { isWholesalePriceBucket, sortPriceBuckets } from '@/lib/priceBucketUtils';
import type { PriceBucket } from '@/lib/types';
import { isWholesaleProduct } from '@/lib/wholesale';
import {
  adminCollection,
  deleteAdminDocument,
  updateAdminDocument,
  uploadImageToImgBB,
  type Category,
  type Product,
} from './shared';
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
  images: string[];
};

type VariantImageOption = {
  url: string;
  label: string;
};

function productImages(product: Product): string[] {
  const images = Array.isArray(product.images)
    ? product.images
      .map(image => typeof image === 'string' ? image : image && typeof image === 'object' ? String(image.url || '') : '')
      .filter(Boolean)
    : [];
  const fallback = typeof product.imageUrl === 'string' ? product.imageUrl : imageOf(product);
  return Array.from(new Set(images.length ? images : fallback ? [fallback] : []));
}

function variantImageOptions(product: Product): VariantImageOption[] {
  const options: VariantImageOption[] = [];
  const seen = new Set<string>();
  const add = (url: unknown, label: unknown) => {
    if (typeof url !== 'string' || !url.trim() || seen.has(url)) return;
    seen.add(url);
    options.push({ url, label: String(label || `Variant ${options.length + 1}`) });
  };

  const matrix = Array.isArray((product as any).variantMatrix) ? (product as any).variantMatrix : [];
  matrix.forEach((row: any) => add(row?.imageUrl, row?.label || [row?.color, row?.size].filter(Boolean).join(' / ')));

  const colors = Array.isArray((product as any).variantColors) ? (product as any).variantColors : [];
  colors.forEach((color: any) => add(color?.imageUrl, color?.name || color));

  const colorImages = (product as any).colorImages;
  if (colorImages && typeof colorImages === 'object') {
    Object.entries(colorImages).forEach(([name, url]) => add(url, name));
  }

  return options;
}

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
    images: productImages(product),
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
    && left.priceBucketIds.every((id, index) => id === right.priceBucketIds[index])
    && left.images.length === right.images.length
    && left.images.every((url, index) => url === right.images[index]);
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
    images: draft.images,
    imageUrl: draft.images[0] || '',
    ...(variantMatrix ? { variantMatrix } : {}),
    updatedAt: new Date().toISOString(),
  };
}

function timestampMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    const candidate = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof candidate.toMillis === 'function') {
      const millis = candidate.toMillis();
      if (Number.isFinite(millis)) return millis;
    }
    const seconds = candidate.seconds ?? candidate._seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) return seconds * 1000;
  }
  return 0;
}

function productCreatedTime(product: Product) {
  return timestampMs((product as any).createdAt) || timestampMs((product as any).updatedAt);
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
    return products
      .filter(product => {
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
      })
      .sort((a, b) => {
        const byCreated = productCreatedTime(b) - productCreatedTime(a);
        return byCreated || String(b.id).localeCompare(String(a.id));
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
    const savedIds = new Set<string>();
    const failures: string[] = [];

    try {
      for (let index = 0; index < prepared.length; index += 10) {
        const batch = prepared.slice(index, index + 10);
        const results = await Promise.allSettled(
          batch.map(({ product, payload }) => updateAdminDocument('products', product.id, payload)),
        );
        results.forEach((result, resultIndex) => {
          const product = batch[resultIndex].product;
          if (result.status === 'fulfilled') savedIds.add(product.id);
          else failures.push(`${product.title}: ${result.reason instanceof Error ? result.reason.message : 'save failed'}`);
        });
      }

      if (savedIds.size) {
        setChangedDrafts(current => Object.fromEntries(Object.entries(current).filter(([id]) => !savedIds.has(id))));
      }

      if (!failures.length) {
        setMessage(`${savedIds.size} changed product${savedIds.size === 1 ? '' : 's'} saved successfully.`);
      } else {
        setMessage(`${savedIds.size} saved. ${failures.length} could not save. ${failures[0]}`);
      }
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

  return <section className="mx-auto max-w-6xl px-3 py-5 pb-48 sm:px-4 sm:py-6 sm:pb-36">
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E1352B] text-white"><PackageSearch size={21}/></div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Bulk catalog control</p>
        <h2 className="mt-1 text-2xl font-black">Product Editor</h2>
        <p className="mt-1 text-sm text-black/50">Edit multiple products, images and cover photos, then save every changed row together.</p>
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
      <p className="mt-3 text-[10px] font-bold text-black/40">Showing {filtered.length} of {products.length} products · newest uploads first · {changedCount} unsaved change{changedCount === 1 ? '' : 's'}</p>
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

    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 px-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-auto sm:px-0">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-black/10 bg-white/95 p-2.5 shadow-2xl backdrop-blur sm:min-w-[310px]">
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-[10px] font-black text-black/70">{changedCount ? `${changedCount} unsaved product${changedCount === 1 ? '' : 's'}` : 'All changes saved'}</p>
          <p className="truncate text-[9px] text-black/40">Save stays here while you scroll.</p>
        </div>
        <button type="button" disabled={busy || Boolean(deletingId) || changedCount === 0} onClick={saveAllChanges} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#14140F] px-4 py-3 text-[10px] font-black text-white disabled:opacity-35">
          {busy ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}Save{changedCount > 0 ? ` (${changedCount})` : ''}
        </button>
      </div>
    </div>
  </section>;
}

function EditableProductRow({ product, draft, categories, priceBuckets, disabled, deleting, onChange, onDelete }: { product: Product; draft: ProductDraft; categories: Category[]; priceBuckets: PriceBucket[]; disabled: boolean; deleting: boolean; onChange: (draft: ProductDraft) => void; onDelete: () => void }) {
  const [mediaTab, setMediaTab] = useState<'images' | 'variants' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rowMessage, setRowMessage] = useState('');
  const hasLegacyCategory = Boolean(draft.category && !categories.some(category => category.id === draft.category));
  const variantImages = useMemo(() => variantImageOptions(product), [product]);
  const mainImage = draft.images[0] || imageOf(product);
  const inputClass = 'min-w-0 w-full rounded-xl bg-[#F4F4F1] px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#0F6A5F]/20 disabled:opacity-50';

  function makeMain(url: string) {
    if (!url) return;
    onChange({ ...draft, images: [url, ...draft.images.filter(item => item !== url)] });
    setRowMessage('Main image changed. Press floating Save to keep it.');
  }

  function removeImage(url: string) {
    onChange({ ...draft, images: draft.images.filter(item => item !== url) });
    setRowMessage('Image removed from this product. Press Save to keep the change.');
  }

  async function uploadFromGallery(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setRowMessage('');
    try {
      const uploaded: string[] = [];
      for (const file of files) uploaded.push(await uploadImageToImgBB(file));
      const nextImages = Array.from(new Set([...draft.images, ...uploaded]));
      onChange({ ...draft, images: nextImages });
      setRowMessage(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} added. Choose Main if needed, then press Save.`);
    } catch (error) {
      setRowMessage(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  return <article className="rounded-3xl border border-black/[.04] bg-white p-3 shadow-sm sm:p-4">
    <div className="flex items-start gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F4F4F1] sm:h-[72px] sm:w-[72px]">
        {mainImage ? <Image src={mainImage} alt="" fill unoptimized sizes="72px" className="object-cover"/> : <div className="grid h-full place-items-center text-center text-[8px] font-bold text-black/30">No image</div>}
      </div>
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-[8px] font-black uppercase tracking-wider text-black/35">Product title</span>
        <textarea
          aria-label="Product name"
          disabled={disabled}
          rows={2}
          value={draft.title}
          onChange={event => onChange({ ...draft, title: event.target.value })}
          className={`${inputClass} min-h-[58px] resize-y whitespace-pre-wrap font-bold leading-5`}
        />
      </label>
      <button type="button" disabled={disabled} onClick={onDelete} aria-label={`Delete ${product.title}`} className="shrink-0 rounded-xl bg-red-50 p-2.5 text-[#E1352B] disabled:opacity-40">{deleting ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}</button>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      <label className="grid gap-1"><span className="text-[8px] font-black uppercase text-black/35">Original price</span><input aria-label="Original price" disabled={disabled} type="number" min="0" value={draft.originalPrice} onChange={event => onChange({ ...draft, originalPrice: event.target.value })} className={inputClass}/></label>
      <label className="grid gap-1"><span className="text-[8px] font-black uppercase text-black/35">Sale price</span><input aria-label="Sale price" disabled={disabled} type="number" min="0" value={draft.price} onChange={event => onChange({ ...draft, price: event.target.value })} className={inputClass}/></label>
      <label className="grid gap-1"><span className="text-[8px] font-black uppercase text-black/35">Stock</span><input aria-label="Stock" disabled={disabled} type="number" min="0" value={draft.stock} onChange={event => onChange({ ...draft, stock: event.target.value })} placeholder="Existing" className={inputClass}/></label>
      <label className="grid gap-1"><span className="text-[8px] font-black uppercase text-black/35">Category</span><select aria-label="Category" disabled={disabled} value={draft.category} onChange={event => onChange({ ...draft, category: event.target.value })} className={inputClass}><option value="">Select category</option>{hasLegacyCategory && <option value={draft.category}>Current: {draft.category}</option>}{categories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
    </div>

    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold">
        <label className="flex items-center gap-2"><input disabled={disabled} type="checkbox" checked={draft.published} onChange={event => onChange({ ...draft, published: event.target.checked })} className="accent-[#0F6A5F]"/>Published</label>
        <label className="flex items-center gap-2"><input disabled={disabled} type="checkbox" checked={draft.isWholesale} onChange={event => { const enabled = event.target.checked; const wholesaleIds = new Set(priceBuckets.filter(isWholesalePriceBucket).map(bucket => bucket.id)); onChange({ ...draft, isWholesale: enabled, priceBucketIds: enabled ? Array.from(new Set([...draft.priceBucketIds, ...wholesaleIds])) : draft.priceBucketIds.filter(id => !wholesaleIds.has(id)) }); }} className="accent-[#E1352B]"/>Wholesale</label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => setMediaTab(current => current === 'images' ? null : 'images')} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[9px] font-black ${mediaTab === 'images' ? 'bg-[#0F6A5F] text-white' : 'bg-[#F4F4F1] text-black/65'}`}><ImagePlus size={13}/>Images ({draft.images.length})</button>
        <button type="button" disabled={disabled} onClick={() => setMediaTab(current => current === 'variants' ? null : 'variants')} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[9px] font-black ${mediaTab === 'variants' ? 'bg-[#0F6A5F] text-white' : 'bg-[#F4F4F1] text-black/65'}`}><Layers3 size={13}/>Variants ({variantImages.length})</button>
      </div>
    </div>

    {mediaTab === 'images' && <div className="mt-3 rounded-2xl bg-[#F7F7F3] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-[10px] font-black">Product images</p><p className="text-[9px] text-black/45">Tap any image to make it the main cover.</p></div>
        <label className={`inline-flex items-center gap-1.5 rounded-xl bg-[#14140F] px-3 py-2 text-[9px] font-black text-white ${disabled || uploading ? 'pointer-events-none opacity-45' : 'cursor-pointer'}`}>
          {uploading ? <Loader2 size={13} className="animate-spin"/> : <ImagePlus size={13}/>} {uploading ? 'Uploading…' : 'Add from gallery'}
          <input type="file" accept="image/*" multiple disabled={disabled || uploading} onChange={uploadFromGallery} className="hidden"/>
        </label>
      </div>
      {draft.images.length ? <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
        {draft.images.map((url, index) => <div key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-white">
          <button type="button" disabled={disabled} onClick={() => makeMain(url)} className="block h-full w-full disabled:opacity-60"><img src={url} alt={`Product image ${index + 1}`} className="h-full w-full object-cover"/></button>
          {index === 0 ? <span className="absolute left-1 top-1 rounded-full bg-black/75 px-1.5 py-1 text-[7px] font-black text-white">MAIN</span> : <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-white/95 px-1.5 py-1 text-[7px] font-black shadow">Make main</span>}
          <button type="button" disabled={disabled} onClick={() => removeImage(url)} aria-label="Remove image" className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white disabled:opacity-45"><Trash2 size={9}/></button>
        </div>)}
      </div> : <div className="mt-3 rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-[9px] font-bold text-black/35">No product images yet. Add one from your gallery.</div>}
    </div>}

    {mediaTab === 'variants' && <div className="mt-3 rounded-2xl bg-[#F7F7F3] p-3">
      <div><p className="text-[10px] font-black">Variant images</p><p className="text-[9px] text-black/45">Use an existing variant photo as the product main image without changing the variant itself.</p></div>
      {variantImages.length ? <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
        {variantImages.map(option => {
          const isMain = draft.images[0] === option.url;
          return <button key={option.url} type="button" disabled={disabled} onClick={() => makeMain(option.url)} className={`overflow-hidden rounded-xl border-2 bg-white text-left disabled:opacity-50 ${isMain ? 'border-[#0F6A5F]' : 'border-transparent'}`}>
            <img src={option.url} alt={option.label} className="aspect-square w-full object-cover"/>
            <span className="block truncate px-2 pt-1.5 text-[8px] font-black">{option.label}</span>
            <span className="block px-2 pb-2 text-[7px] font-bold text-black/40">{isMain ? '✓ Main image' : 'Set as main'}</span>
          </button>;
        })}
      </div> : <div className="mt-3 rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-[9px] font-bold text-black/35">No saved variant images on this product.</div>}
    </div>}

    {rowMessage && <p className="mt-2 text-[9px] font-bold text-[#0F6A5F]">{rowMessage}</p>}

    {priceBuckets.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3"><span className="mr-1 text-[8px] font-black uppercase tracking-wider text-black/35">Price buckets</span>{priceBuckets.map(bucket => <label key={bucket.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-bold ${draft.priceBucketIds.includes(bucket.id) ? 'bg-[#0F6A5F] text-white' : 'bg-[#F4F4F1] text-black/55'}`}><input disabled={disabled} type="checkbox" checked={draft.priceBucketIds.includes(bucket.id)} onChange={event => { const enabled = event.target.checked; onChange({ ...draft, priceBucketIds: enabled ? Array.from(new Set([...draft.priceBucketIds, bucket.id])) : draft.priceBucketIds.filter(id => id !== bucket.id), ...(isWholesalePriceBucket(bucket) ? { isWholesale: enabled } : {}) }); }} className="h-3 w-3"/>{bucket.title}</label>)}</div>}
  </article>;
}
