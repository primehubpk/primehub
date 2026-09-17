'use client';

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { ImagePlus, Loader2, PackageSearch, Pencil, Save, Search, Star, Trash2 } from 'lucide-react';
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

type VariantDraft = {
  id: string;
  color: string;
  size: string;
  stock: string;
  imageUrl: string;
  raw: Record<string, unknown>;
};

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
  variants: VariantDraft[];
};

type SizePreset = { key: string; label: string };

const SIZE_PRESETS: SizePreset[] = [
  { key: '2.8', label: '2.8 — Large / Dhai size / bhari hand' },
  { key: '2.6', label: '2.6 — Sawa 2 / regular size' },
  { key: '2.4', label: '2.4 — Adpa 2 size' },
  { key: '2.2', label: '2.2 — Small / bareek hand / around 9–14 year girl' },
  { key: '12-number', label: '12 Number — around 6–8/9 year girl' },
  { key: '10-number', label: '10 Number — around 4–6 year girl' },
  { key: '8-number', label: '8 Number — around 1–3/4 year girl' },
  { key: '14-number', label: '14 Number' },
  { key: '3-inch', label: '3inch — big size' },
];

function sizeKey(value: string) {
  const normalized = value.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  if (/^2\.8(?:|\s|-)/.test(normalized)) return '2.8';
  if (/^2\.6(?:|\s|-)/.test(normalized)) return '2.6';
  if (/^2\.4(?:|\s|-)/.test(normalized)) return '2.4';
  if (/^2\.2(?:|\s|-)/.test(normalized)) return '2.2';
  if (/^12(?:\s*number)?(?:|\s|-)/.test(normalized)) return '12-number';
  if (/^10(?:\s*number)?(?:|\s|-)/.test(normalized)) return '10-number';
  if (/^8(?:\s*number)?(?:|\s|-)/.test(normalized)) return '8-number';
  if (/^14(?:\s*number)?(?:|\s|-)/.test(normalized)) return '14-number';
  if (/^3\s*inch/.test(normalized) || /^3inch/.test(normalized)) return '3-inch';
  return normalized;
}

function productImages(product: Product): string[] {
  const images = Array.isArray(product.images)
    ? product.images
      .map(image => typeof image === 'string' ? image : image && typeof image === 'object' ? String(image.url || '') : '')
      .filter(Boolean)
    : [];
  const fallback = typeof product.imageUrl === 'string' ? product.imageUrl : imageOf(product);
  return Array.from(new Set(images.length ? images : fallback ? [fallback] : []));
}

function valueList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      return String(record.name ?? record.value ?? record.label ?? '').trim();
    }
    return '';
  }).filter(Boolean);
}

function productVariantRows(product: Product): VariantDraft[] {
  const record = product as any;
  const matrixRows = Array.isArray(record.variantMatrix) ? record.variantMatrix : [];
  const directRows = Array.isArray(record.variants) ? record.variants : [];
  const sourceRows = matrixRows.length ? matrixRows : directRows;
  const legacyStock = record.stock ?? record.quantity ?? record.inventory ?? 0;
  const fallbackImage = productImages(product)[0] || imageOf(product);
  const colorImages: Record<string, string> = record.colorImages && typeof record.colorImages === 'object' ? record.colorImages : {};

  if (sourceRows.length) {
    return sourceRows.map((row: any, index: number) => {
      const labelParts = String(row?.label || '').split('/').map((part: string) => part.trim());
      const color = String(row?.color ?? row?.variantColor ?? labelParts[0] ?? '').trim();
      const size = String(row?.size ?? row?.variantSize ?? labelParts[1] ?? '').trim();
      return {
        id: String(row?.id || `variant-${index}`),
        color,
        size,
        stock: String(row?.stock ?? legacyStock ?? 0),
        imageUrl: String(row?.imageUrl || colorImages[color] || fallbackImage || ''),
        raw: row && typeof row === 'object' ? { ...row } : {},
      };
    });
  }

  const variantColors = Array.isArray(record.variantColors) ? record.variantColors : [];
  const optionRows = Array.isArray(record.variantOptions) ? record.variantOptions : [];
  const colorOption = optionRows.find((option: any) => /color/i.test(String(option?.id || option?.name || '')));
  const sizeOption = optionRows.find((option: any) => /size/i.test(String(option?.id || option?.name || '')));
  const colors = Array.from(new Set([
    ...variantColors.map((item: any) => typeof item === 'string' ? item : item?.name).filter(Boolean).map(String),
    ...valueList(colorOption?.values),
    ...valueList(record.colors),
  ].map(value => value.trim()).filter(Boolean)));
  const sizes = Array.from(new Set([
    ...valueList(sizeOption?.values),
    ...valueList(record.variantSizes),
    ...valueList(record.sizes),
  ].map(value => value.trim()).filter(Boolean)));

  if (!colors.length && !sizes.length) return [];
  const normalizedColors = colors.length ? colors : ['Standard'];
  const normalizedSizes = sizes.length ? sizes : ['Standard'];
  const colorPhoto = (name: string) => {
    const variantColor = variantColors.find((item: any) => typeof item === 'object' && String(item?.name || '') === name);
    return String(variantColor?.imageUrl || colorImages[name] || fallbackImage || '');
  };

  return normalizedColors.flatMap((color, colorIndex) => normalizedSizes.map((size, sizeIndex) => ({
    id: `variant-${colorIndex}-${sizeIndex}-${color}-${size}`,
    color,
    size,
    stock: String(legacyStock ?? 0),
    imageUrl: colorPhoto(color),
    raw: {},
  })));
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
    variants: productVariantRows(product),
  };
}

function variantDraftsMatch(left: VariantDraft[], right: VariantDraft[]) {
  return left.length === right.length && left.every((variant, index) => {
    const other = right[index];
    return Boolean(other)
      && variant.id === other.id
      && variant.color === other.color
      && variant.size === other.size
      && variant.stock === other.stock
      && variant.imageUrl === other.imageUrl;
  });
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
    && left.images.every((url, index) => url === right.images[index])
    && variantDraftsMatch(left.variants, right.variants);
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

  const variantMatrix = draft.variants.map((variant, index) => {
    const color = variant.color.trim();
    const size = variant.size.trim();
    const variantStock = safeNumber(variant.stock || '0', `Variant ${index + 1} stock`);
    return {
      ...variant.raw,
      id: variant.id || `variant-${index}`,
      label: [color, size].filter(Boolean).join(' / ') || `Variant ${index + 1}`,
      color,
      size,
      stock: variantStock,
      imageUrl: variant.imageUrl,
      price: String(price),
    };
  });

  const colorNames = Array.from(new Set(variantMatrix.map(row => row.color).filter(Boolean)));
  const sizeNames = Array.from(new Set(variantMatrix.map(row => row.size).filter(Boolean)));
  const colorImages = Object.fromEntries(colorNames.map(name => [name, variantMatrix.find(row => row.color === name)?.imageUrl || draft.images[0] || '']));
  const variantColors = colorNames.map(name => ({ name, imageUrl: colorImages[name] || '' }));
  const variantOptions = [
    { id: 'color', name: 'Color', values: colorNames },
    { id: 'size', name: 'Size', values: sizeNames },
  ];
  const productRecord = product as any;
  const hadVariantMetadata = draft.variants.length > 0
    || Array.isArray(productRecord.variantMatrix)
    || Array.isArray(productRecord.variants)
    || Array.isArray(productRecord.variantColors)
    || Array.isArray(productRecord.variantOptions);

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
    ...(hadVariantMetadata ? {
      variantMatrix,
      ...(Array.isArray(productRecord.variants) ? { variants: variantMatrix } : {}),
      variantColors,
      variantOptions,
      colorImages,
      hasVariants: variantMatrix.length > 0,
    } : {}),
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
        <p className="mt-1 text-sm text-black/50">Edit products, images and variants, then save every changed row together.</p>
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
  const [uploading, setUploading] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [showSizeAdder, setShowSizeAdder] = useState(false);
  const [rowMessage, setRowMessage] = useState('');
  const hasLegacyCategory = Boolean(draft.category && !categories.some(category => category.id === draft.category));
  const inputClass = 'min-w-0 w-full rounded-xl bg-[#F4F4F1] px-2 py-2.5 text-[10px] outline-none focus:ring-2 focus:ring-[#0F6A5F]/20 disabled:opacity-50 sm:px-3 sm:text-xs';

  function makeMain(index: number) {
    if (index <= 0 || !draft.images[index]) return;
    const images = [...draft.images];
    const [selected] = images.splice(index, 1);
    onChange({ ...draft, images: [selected, ...images] });
    setRowMessage('Main image changed. Press Save to keep it.');
  }

  function removeImage(index: number) {
    onChange({ ...draft, images: draft.images.filter((_, imageIndex) => imageIndex !== index) });
    setRowMessage('Image removed from this product. Press Save to keep the change.');
  }

  async function replaceImage(index: number, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReplacingIndex(index);
    setRowMessage('');
    try {
      const url = await uploadImageToImgBB(file);
      const nextImages = [...draft.images];
      nextImages[index] = url;
      onChange({ ...draft, images: nextImages });
      setRowMessage(`Image ${index + 1} replaced. Press Save to keep it.`);
    } catch (error) {
      setRowMessage(error instanceof Error ? error.message : 'Image replacement failed.');
    } finally {
      setReplacingIndex(null);
      event.target.value = '';
    }
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
      setRowMessage(`${uploaded.length} image${uploaded.length === 1 ? '' : 's'} added. Press Save to keep the change.`);
    } catch (error) {
      setRowMessage(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    onChange({
      ...draft,
      variants: draft.variants.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...patch } : variant),
    });
  }

  function removeVariant(index: number) {
    onChange({ ...draft, variants: draft.variants.filter((_, variantIndex) => variantIndex !== index) });
    setEditingVariantIndex(null);
    setRowMessage('Only this variant was removed. Press Save to keep the change.');
  }

  function sizePresetComplete(preset: SizePreset) {
    const groups = Array.from(new Set(draft.variants.map(variant => variant.color.trim())));
    const targetGroups = groups.length ? groups : [''];
    return targetGroups.every(color => draft.variants.some(variant => variant.color.trim() === color && sizeKey(variant.size) === preset.key));
  }

  function addSizePreset(preset: SizePreset) {
    const groups = Array.from(new Set(draft.variants.map(variant => variant.color.trim())));
    const targetGroups = groups.length ? groups : [''];
    const existing = new Set(draft.variants.map(variant => `${variant.color.trim()}::${sizeKey(variant.size)}`));
    const createdAt = Date.now();
    const additions: VariantDraft[] = [];

    targetGroups.forEach((color, groupIndex) => {
      if (existing.has(`${color}::${preset.key}`)) return;
      const seed = draft.variants.find(variant => variant.color.trim() === color) || draft.variants[0];
      additions.push({
        id: `bulk-${createdAt}-${groupIndex}-${preset.key.replace(/[^a-z0-9]+/gi, '-')}`,
        color,
        size: preset.label,
        stock: seed?.stock || draft.stock || '0',
        imageUrl: seed?.imageUrl || draft.images[0] || '',
        raw: {},
      });
    });

    if (!additions.length) {
      setRowMessage(`${preset.label} is already added.`);
      return;
    }

    onChange({ ...draft, variants: [...draft.variants, ...additions] });
    setRowMessage(`${preset.label} added to ${additions.length} variant${additions.length === 1 ? '' : 's'}. Press Save to keep the change.`);
  }

  return <article className="rounded-3xl border border-black/[.04] bg-white p-3 shadow-sm sm:p-4">
    <div className="flex items-start gap-3">
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

    <div className="mt-3 rounded-2xl bg-[#F7F7F3] p-3">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-[10px] font-black">Product images</p><p className="text-[9px] text-black/45">Main image stays first. Every image can be deleted, replaced or made main.</p></div>
        <label className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#14140F] px-3 py-2 text-[9px] font-black text-white ${disabled || uploading ? 'pointer-events-none opacity-45' : 'cursor-pointer'}`}>
          {uploading ? <Loader2 size={13} className="animate-spin"/> : <ImagePlus size={13}/>} {uploading ? 'Uploading…' : 'Add'}
          <input type="file" accept="image/*" multiple disabled={disabled || uploading} onChange={uploadFromGallery} className="hidden"/>
        </label>
      </div>

      {draft.images.length ? <div className="mt-3 space-y-2">
        {draft.images.map((url, index) => <div key={`${url}-${index}`} className={`flex items-center gap-2 rounded-2xl bg-white p-2 ring-1 ${index === 0 ? 'ring-[#0F6A5F]/30' : 'ring-black/5'}`}>
          <div className={`relative shrink-0 overflow-hidden rounded-xl bg-[#F4F4F1] ${index === 0 ? 'h-24 w-24' : 'h-16 w-16'}`}>
            <img src={url} alt={`Product image ${index + 1}`} className="h-full w-full object-cover"/>
            {index === 0 && <span className="absolute left-1 top-1 rounded-full bg-[#14140F]/90 px-2 py-1 text-[7px] font-black text-white">MAIN</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] font-black">{index === 0 ? 'Main image' : `Image ${index + 1}`}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <button type="button" disabled={disabled} onClick={() => removeImage(index)} className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg bg-red-50 px-2 py-2 text-[8px] font-black text-[#E1352B] disabled:opacity-40"><Trash2 size={10}/>Delete</button>
              <label className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-lg bg-[#F4F4F1] px-2 py-2 text-[8px] font-black ${disabled || replacingIndex !== null ? 'pointer-events-none opacity-45' : 'cursor-pointer'}`}>
                {replacingIndex === index ? <Loader2 size={10} className="animate-spin"/> : <Pencil size={10}/>}Edit
                <input type="file" accept="image/*" disabled={disabled || replacingIndex !== null} onChange={event => replaceImage(index, event)} className="hidden"/>
              </label>
              <button type="button" disabled={disabled || index === 0} onClick={() => makeMain(index)} className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[8px] font-black disabled:opacity-100 ${index === 0 ? 'bg-[#0F6A5F] text-white' : 'bg-[#0F6A5F]/10 text-[#0F6A5F]'}`}><Star size={10}/>{index === 0 ? 'Main' : 'Make main'}</button>
            </div>
          </div>
        </div>)}
      </div> : <div className="mt-3 rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-[9px] font-bold text-black/35">No product images yet. Add one from your gallery.</div>}
    </div>

    <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
      <label className="grid min-w-0 gap-1"><span className="truncate text-[7px] font-black uppercase text-black/35 sm:text-[8px]">Original price</span><input aria-label="Original price" disabled={disabled} type="number" min="0" value={draft.originalPrice} onChange={event => onChange({ ...draft, originalPrice: event.target.value })} className={inputClass}/></label>
      <label className="grid min-w-0 gap-1"><span className="truncate text-[7px] font-black uppercase text-black/35 sm:text-[8px]">Sale price</span><input aria-label="Sale price" disabled={disabled} type="number" min="0" value={draft.price} onChange={event => onChange({ ...draft, price: event.target.value })} className={inputClass}/></label>
      <label className="grid min-w-0 gap-1"><span className="truncate text-[7px] font-black uppercase text-black/35 sm:text-[8px]">Stock</span><input aria-label="Stock" disabled={disabled} type="number" min="0" value={draft.stock} onChange={event => onChange({ ...draft, stock: event.target.value })} placeholder="Stock" className={inputClass}/></label>
      <label className="grid min-w-0 gap-1"><span className="truncate text-[7px] font-black uppercase text-black/35 sm:text-[8px]">Category</span><select aria-label="Category" disabled={disabled} value={draft.category} onChange={event => onChange({ ...draft, category: event.target.value })} className={`${inputClass} px-1 sm:px-2`}><option value="">Select</option>{hasLegacyCategory && <option value={draft.category}>Current: {draft.category}</option>}{categories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
    </div>

    <div className="mt-3 rounded-2xl border border-black/5 bg-[#F7F7F3] p-3">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-[10px] font-black">Variants ({draft.variants.length})</p><p className="text-[9px] text-black/45">Edit color, size or stock. Delete removes only the row you tap.</p></div>
        <label className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-[9px] font-black ring-1 ring-black/5">
          <input type="checkbox" disabled={disabled} checked={showSizeAdder} onChange={event => setShowSizeAdder(event.target.checked)} className="h-3.5 w-3.5 accent-[#0F6A5F]"/>
          Size
        </label>
      </div>
      {showSizeAdder && <div className="mt-3 rounded-xl border border-[#0F6A5F]/15 bg-white p-3">
        <p className="text-[9px] font-black text-[#0F6A5F]">Add size variants</p>
        <p className="mt-0.5 text-[8px] leading-4 text-black/45">Tap a size to add only missing rows for every current design/color. Existing variants are never removed here.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SIZE_PRESETS.map(preset => {
            const added = sizePresetComplete(preset);
            return <button key={preset.key} type="button" disabled={disabled || added} onClick={() => addSizePreset(preset)} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-left text-[8px] font-bold leading-4 transition ${added ? 'bg-[#0F6A5F]/10 text-[#0F6A5F]' : 'bg-[#F4F4F1] text-black/65'} disabled:opacity-70`}>
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-current text-[9px] font-black">{added ? '✓' : '+'}</span>
              <span>{preset.label}</span>
            </button>;
          })}
        </div>
      </div>}
      {draft.variants.length ? <div className="mt-3 space-y-2">
        {draft.variants.map((variant, index) => {
          const editing = editingVariantIndex === index;
          return <div key={`${variant.id}-${index}`} className="rounded-xl bg-white p-2 ring-1 ring-black/5">
            {editing ? <div className="grid grid-cols-[44px_1fr_1fr_72px] items-end gap-1.5">
              <div className="h-11 w-11 overflow-hidden rounded-lg bg-[#F4F4F1]">{variant.imageUrl ? <img src={variant.imageUrl} alt="" className="h-full w-full object-cover"/> : null}</div>
              <label className="min-w-0"><span className="block text-[7px] font-black uppercase text-black/35">Color</span><input value={variant.color} onChange={event => updateVariant(index, { color: event.target.value })} className="mt-1 w-full rounded-lg bg-[#F4F4F1] p-2 text-[9px] outline-none"/></label>
              <label className="min-w-0"><span className="block text-[7px] font-black uppercase text-black/35">Size</span><input value={variant.size} onChange={event => updateVariant(index, { size: event.target.value })} className="mt-1 w-full rounded-lg bg-[#F4F4F1] p-2 text-[9px] outline-none"/></label>
              <label className="min-w-0"><span className="block text-[7px] font-black uppercase text-black/35">Stock</span><input type="number" min="0" value={variant.stock} onChange={event => updateVariant(index, { stock: event.target.value })} className="mt-1 w-full rounded-lg bg-[#F4F4F1] p-2 text-[9px] outline-none"/></label>
              <div className="col-span-4 flex justify-end gap-1.5">
                <button type="button" onClick={() => setEditingVariantIndex(null)} className="rounded-lg bg-[#0F6A5F] px-3 py-2 text-[8px] font-black text-white">Done</button>
                <button type="button" disabled={disabled} onClick={() => removeVariant(index)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-[8px] font-black text-[#E1352B] disabled:opacity-40"><Trash2 size={10}/>Delete</button>
              </div>
            </div> : <div className="flex items-center gap-2">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#F4F4F1]">{variant.imageUrl ? <img src={variant.imageUrl} alt="" className="h-full w-full object-cover"/> : null}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[9px] font-black">{[variant.color, variant.size].filter(Boolean).join(' / ') || `Variant ${index + 1}`}</p>
                <p className="mt-0.5 text-[8px] font-bold text-black/40">Stock: {variant.stock || '0'}</p>
              </div>
              <button type="button" disabled={disabled} onClick={() => setEditingVariantIndex(index)} className="inline-flex items-center gap-1 rounded-lg bg-[#0F6A5F]/10 px-2.5 py-2 text-[8px] font-black text-[#0F6A5F] disabled:opacity-40"><Pencil size={10}/>Edit</button>
              <button type="button" disabled={disabled} onClick={() => removeVariant(index)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-2 text-[8px] font-black text-[#E1352B] disabled:opacity-40"><Trash2 size={10}/>Delete</button>
            </div>}
          </div>;
        })}
      </div> : <div className="mt-3 rounded-xl border border-dashed border-black/15 bg-white p-4 text-center text-[9px] font-bold text-black/35">No variants saved on this product.</div>}
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/5 pt-3 text-[10px] font-bold">
      <label className="flex items-center gap-2"><input disabled={disabled} type="checkbox" checked={draft.published} onChange={event => onChange({ ...draft, published: event.target.checked })} className="accent-[#0F6A5F]"/>Published</label>
      <label className="flex items-center gap-2"><input disabled={disabled} type="checkbox" checked={draft.isWholesale} onChange={event => { const enabled = event.target.checked; const wholesaleIds = new Set(priceBuckets.filter(isWholesalePriceBucket).map(bucket => bucket.id)); onChange({ ...draft, isWholesale: enabled, priceBucketIds: enabled ? Array.from(new Set([...draft.priceBucketIds, ...wholesaleIds])) : draft.priceBucketIds.filter(id => !wholesaleIds.has(id)) }); }} className="accent-[#E1352B]"/>Wholesale</label>
    </div>

    {rowMessage && <p className="mt-2 text-[9px] font-bold text-[#0F6A5F]">{rowMessage}</p>}

    {priceBuckets.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3"><span className="mr-1 text-[8px] font-black uppercase tracking-wider text-black/35">Price buckets</span>{priceBuckets.map(bucket => <label key={bucket.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-bold ${draft.priceBucketIds.includes(bucket.id) ? 'bg-[#0F6A5F] text-white' : 'bg-[#F4F4F1] text-black/55'}`}><input disabled={disabled} type="checkbox" checked={draft.priceBucketIds.includes(bucket.id)} onChange={event => { const enabled = event.target.checked; onChange({ ...draft, priceBucketIds: enabled ? Array.from(new Set([...draft.priceBucketIds, bucket.id])) : draft.priceBucketIds.filter(id => id !== bucket.id), ...(isWholesalePriceBucket(bucket) ? { isWholesale: enabled } : {}) }); }} className="h-3 w-3"/>{bucket.title}</label>)}</div>}
  </article>;
}
