'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { uploadImageToImgBB } from './shared';
import type { DailyDeal } from '@/lib/types';

type CatalogProduct = {
  id: string;
  title?: string;
  name?: string;
  imageUrl?: string;
  image?: string;
  images?: Array<string | { url?: string }>;
  price?: number | string;
  originalPrice?: number | string;
  normalPrice?: number | string;
  categoryId?: string;
  category?: string;
  active?: boolean;
  published?: boolean;
};

type CatalogCategory = {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  active?: boolean;
};

type SlotPatch = {
  productId?: string;
  title?: string;
  categoryId?: string;
  originalPrice?: number;
  dealPrice?: number;
};

const SLOT_COUNT = 7;
const EMPTY_STRINGS = () => Array.from({ length: SLOT_COUNT }, () => '');

const EMPTY_DEAL: DailyDeal = {
  productId: '',
  imageUrl: '',
  imageUrls: [],
  galleryImages: [],
  productIds: [],
  titles: [],
  categoryIds: [],
  originalPrices: [],
  dealPrices: [],
  title: '',
  originalPrice: 0,
  dealPrice: 0,
  rotationStartedAt: '',
  startAt: '',
  endAt: '',
  buttonText: 'Shop Big Deal',
  buttonLink: '/deals/big',
  active: false,
};

const clean = (value: unknown) => String(value || '').trim().toLowerCase();
const categoryLabel = (category: CatalogCategory) => category.title || category.name || category.slug || category.id;
const productTitle = (product: CatalogProduct) => product.title || product.name || product.id;

function productImage(product?: CatalogProduct) {
  if (!product) return '';
  if (product.imageUrl) return product.imageUrl;
  if (product.image) return product.image;
  const first = Array.isArray(product.images) ? product.images[0] : null;
  return typeof first === 'string' ? first : first?.url || '';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dealTitleForProduct(product: CatalogProduct) {
  const fallback = productTitle(product);
  const price = Math.round(Number(product.price || product.originalPrice || product.normalPrice || 0));
  if (!Number.isFinite(price) || price <= 0) return fallback;

  let title = fallback;
  const candidates = Array.from(new Set([String(price), price.toLocaleString('en-PK')]));
  for (const candidate of candidates) {
    title = title.replace(new RegExp(`\\b(?:Rs\\.?\\s*)?${escapeRegExp(candidate)}\\b`, 'gi'), ' ');
  }

  return title
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;-])/g, '$1')
    .replace(/-\s*-/g, '-')
    .trim() || fallback;
}

function productMatchesCategory(product: CatalogProduct, category?: CatalogCategory) {
  if (!category) return false;
  const productKeys = [product.categoryId, product.category].map(clean).filter(Boolean);
  const categoryKeys = [category.id, category.title, category.name, category.slug].map(clean).filter(Boolean);
  return productKeys.some((key) => categoryKeys.includes(key));
}

function normalizeArrays(current: DailyDeal) {
  return {
    images: Array.from({ length: SLOT_COUNT }, (_, index) => String(current.imageUrls?.[index] || '')),
    galleryImages: Array.from({ length: SLOT_COUNT }, (_, index) => String(current.galleryImages?.[index] || '')),
    productIds: Array.from({ length: SLOT_COUNT }, (_, index) => String(current.productIds?.[index] || '')),
    titles: Array.from({ length: SLOT_COUNT }, (_, index) => String(current.titles?.[index] || '')),
    categoryIds: Array.from({ length: SLOT_COUNT }, (_, index) => String(current.categoryIds?.[index] || '')),
    originalPrices: Array.from({ length: SLOT_COUNT }, (_, index) => Number(current.originalPrices?.[index] || 0)),
    dealPrices: Array.from({ length: SLOT_COUNT }, (_, index) => Number(current.dealPrices?.[index] || 0)),
  };
}

function configuredDealCount(current: DailyDeal) {
  const arrays = normalizeArrays(current);
  let count = 0;
  for (let index = 0; index < SLOT_COUNT; index += 1) {
    const hasDeal = Boolean(
      arrays.productIds[index] || arrays.titles[index] || arrays.categoryIds[index] ||
      arrays.originalPrices[index] > 0 || arrays.dealPrices[index] > 0,
    );
    if (!hasDeal) break;
    count = index + 1;
  }
  return Math.max(1, count);
}

export default function BigDealManager() {
  const [deal, setDeal] = useState<DailyDeal>(EMPTY_DEAL);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [specialImages, setSpecialImages] = useState<string[]>(EMPTY_STRINGS);
  const [dealCount, setDealCount] = useState(1);
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/admin/big-deal', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) throw new Error(result?.error || 'Unable to load Big Deal settings.');

        const productList = Array.isArray(result.products) ? result.products as CatalogProduct[] : [];
        const current = { ...EMPTY_DEAL, ...(result.dailyDeal || {}) } as DailyDeal;
        const arrays = normalizeArrays(current);

        const hasSavedGalleryOverrides = arrays.galleryImages.some(Boolean);
        const inferredSpecialImages = hasSavedGalleryOverrides
          ? arrays.galleryImages
          : arrays.images.map((savedImage, index) => {
              if (!savedImage) return '';
              const selected = productList.find((item) => item.id === arrays.productIds[index]);
              const catalogImage = productImage(selected);
              if (!catalogImage || clean(savedImage) !== clean(catalogImage)) return savedImage;
              return '';
            });
        const cleanedTitles = arrays.titles.map((savedTitle, index) => {
          const selected = productList.find((item) => item.id === arrays.productIds[index]);
          return selected ? dealTitleForProduct(selected) : savedTitle;
        });

        setDeal({
          ...current,
          imageUrls: arrays.images,
          galleryImages: inferredSpecialImages,
          productIds: arrays.productIds,
          titles: cleanedTitles,
          categoryIds: arrays.categoryIds,
          originalPrices: arrays.originalPrices,
          dealPrices: arrays.dealPrices,
          title: cleanedTitles[0] || current.title || '',
        });
        setProducts(productList);
        setCategories(Array.isArray(result.categories) ? result.categories : []);
        setSpecialImages(inferredSpecialImages);
        setDealCount(configuredDealCount(current));
      })
      .catch((error) => setToast(error instanceof Error ? error.message : 'Unable to load Big Deal settings.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const arrays = useMemo(() => normalizeArrays(deal), [deal]);
  const { images, productIds, titles, categoryIds, originalPrices, dealPrices } = arrays;

  function updateSlot(index: number, patch: SlotPatch) {
    setDeal((current) => {
      const next = normalizeArrays(current);
      if (patch.productId !== undefined) next.productIds[index] = patch.productId;
      if (patch.title !== undefined) next.titles[index] = patch.title;
      if (patch.categoryId !== undefined) next.categoryIds[index] = patch.categoryId;
      if (patch.originalPrice !== undefined) next.originalPrices[index] = Math.max(0, patch.originalPrice);
      if (patch.dealPrice !== undefined) next.dealPrices[index] = Math.max(0, patch.dealPrice);

      return {
        ...current,
        productIds: next.productIds,
        titles: next.titles,
        categoryIds: next.categoryIds,
        originalPrices: next.originalPrices,
        dealPrices: next.dealPrices,
        productId: next.productIds[0] || '',
        title: next.titles[0] || '',
        originalPrice: next.originalPrices[0] || 0,
        dealPrice: next.dealPrices[0] || 0,
      };
    });
  }

  async function uploadSpecialImage(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingSlot(index);
    try {
      const url = await uploadImageToImgBB(file);
      setSpecialImages((current) => {
        const next = [...current];
        next[index] = url;
        return next;
      });
      setToast(`Optional special image added for Deal ${index + 1}. Product selection below stays separate.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploadingSlot(null);
    }
  }

  function clearSpecialImage(index: number) {
    setSpecialImages((current) => {
      const next = [...current];
      next[index] = '';
      return next;
    });
    setToast(`Deal ${index + 1} will use the selected product photo.`);
  }

  function selectCategory(index: number, categoryId: string) {
    updateSlot(index, {
      categoryId,
      productId: '',
      title: '',
      originalPrice: 0,
      dealPrice: 0,
    });
    setOpenPickerIndex(categoryId ? index : null);
  }

  function selectProduct(index: number, product: CatalogProduct) {
    updateSlot(index, {
      productId: product.id,
      title: dealTitleForProduct(product),
      categoryId: categoryIds[index] || String(product.categoryId || product.category || ''),
      originalPrice: 0,
      dealPrice: 0,
    });
    setOpenPickerIndex(null);
  }

  function selectedProduct(index: number) {
    return products.find((product) => product.id === productIds[index]);
  }

  function resolvedImage(index: number) {
    const selected = selectedProduct(index);
    return specialImages[index] || productImage(selected) || images[index] || '';
  }

  function slotComplete(index: number) {
    return Boolean(
      productIds[index] && titles[index] && resolvedImage(index) &&
      originalPrices[index] > 0 && dealPrices[index] > 0 && dealPrices[index] < originalPrices[index],
    );
  }

  function addMoreDeal() {
    if (dealCount >= SLOT_COUNT) {
      setToast('Maximum 7 Big Deals can be added.');
      return;
    }
    setDealCount((count) => Math.min(SLOT_COUNT, count + 1));
    setOpenPickerIndex(dealCount);
  }

  function removeLastDeal() {
    if (dealCount <= 1) return;
    const index = dealCount - 1;
    updateSlot(index, { categoryId: '', productId: '', title: '', originalPrice: 0, dealPrice: 0 });
    setSpecialImages((current) => {
      const next = [...current];
      next[index] = '';
      return next;
    });
    setDealCount((count) => Math.max(1, count - 1));
    if (openPickerIndex === index) setOpenPickerIndex(null);
  }

  async function saveRotation() {
    const activeIndexes = Array.from({ length: dealCount }, (_, index) => index);
    const invalid = activeIndexes.find((index) => !slotComplete(index));
    if (invalid !== undefined) {
      const missingProduct = !productIds[invalid];
      setToast(
        missingProduct
          ? `Complete Deal ${invalid + 1}: choose a category and one product first.`
          : `Complete Deal ${invalid + 1}: enter original price and a lower Big Deal price.`,
      );
      return;
    }

    const compact = activeIndexes.map((index) => ({
      imageUrl: resolvedImage(index),
      galleryImage: specialImages[index] || '',
      productId: productIds[index],
      title: titles[index],
      categoryId: categoryIds[index],
      originalPrice: originalPrices[index],
      dealPrice: dealPrices[index],
    }));

    const pad = <T,>(items: T[], empty: T) => Array.from({ length: SLOT_COUNT }, (_, index) => items[index] ?? empty);
    const nextImages = pad(compact.map((item) => item.imageUrl), '');
    const nextGalleryImages = pad(compact.map((item) => item.galleryImage), '');
    const nextProducts = pad(compact.map((item) => item.productId), '');
    const nextTitles = pad(compact.map((item) => item.title), '');
    const nextCategories = pad(compact.map((item) => item.categoryId), '');
    const nextOriginals = pad(compact.map((item) => item.originalPrice), 0);
    const nextDeals = pad(compact.map((item) => item.dealPrice), 0);

    setSaving(true);
    try {
      const nextDeal: DailyDeal = {
        ...deal,
        imageUrls: nextImages,
        galleryImages: nextGalleryImages,
        productIds: nextProducts,
        titles: nextTitles,
        categoryIds: nextCategories,
        originalPrices: nextOriginals,
        dealPrices: nextDeals,
        imageUrl: nextImages[0] || '',
        productId: nextProducts[0] || '',
        title: nextTitles[0] || '',
        originalPrice: nextOriginals[0] || 0,
        dealPrice: nextDeals[0] || 0,
        rotationStartedAt: new Date().toISOString(),
        buttonText: deal.buttonText?.trim() || 'Shop Big Deal',
        buttonLink: deal.buttonLink?.trim() || '/deals/big',
        active: true,
      };

      const response = await fetch('/api/admin/big-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ dailyDeal: nextDeal }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Unable to save Big Deal rotation.');

      const saved = { ...nextDeal, ...(result.dailyDeal || {}) } as DailyDeal;
      const savedArrays = normalizeArrays(saved);
      setDeal({
        ...saved,
        imageUrls: savedArrays.images,
        galleryImages: savedArrays.galleryImages,
        productIds: savedArrays.productIds,
        titles: savedArrays.titles,
        categoryIds: savedArrays.categoryIds,
        originalPrices: savedArrays.originalPrices,
        dealPrices: savedArrays.dealPrices,
      });
      setSpecialImages(savedArrays.galleryImages);
      setToast(
        result.warning ||
        `${compact.length} Big Deal${compact.length === 1 ? '' : 's'} saved. Blank special-image slots use the selected product photo automatically. Rotation repeats until you update it.`,
      );
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to save Big Deal rotation.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-black/50">Loading Big Deal manager...</div>;
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="rounded-[28px] bg-[#14140F] p-5 text-white sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#FFCF68]">
              <Sparkles size={15} />
              <span className="text-[10px] font-black uppercase tracking-[.18em]">PrimeHubMall Big Deal</span>
            </div>
            <h2 className="mt-2 text-2xl font-black">Build 1 to 7 Big Deals</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-white/60">
              Special gallery image and catalog product are separate. Upload a special image only when you want one; otherwise the selected product photo is used automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveRotation()}
            disabled={saving || uploadingSlot !== null}
            className="hidden shrink-0 items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-black text-[#14140F] disabled:opacity-50 sm:inline-flex"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save Big Deal'}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-[28px] border border-black/8 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black">1. Optional special gallery images</p>
            <p className="mt-1 max-w-2xl text-[10px] leading-4 text-black/45">
              This is optional and does not create a deal by itself. Leave any box blank to use that deal&apos;s selected product photo.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#F4F4F1] px-3 py-1.5 text-[9px] font-black text-black/45">
            {specialImages.slice(0, dealCount).filter(Boolean).length}/{dealCount} custom
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: dealCount }, (_, index) => {
            const image = specialImages[index];
            return (
              <div key={index}>
                <label className="group block cursor-pointer">
                  <span className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 ${image ? 'border-[#0F6A5F]' : 'border-dashed border-black/15 bg-[#F4F4F1]'}`}>
                    {image ? (
                      <img src={image} alt={`Optional special image for Deal ${index + 1}`} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex flex-col items-center gap-2 px-3 text-center text-[9px] font-black text-black/35">
                        <ImagePlus size={22} />
                        Optional image
                      </span>
                    )}
                    {uploadingSlot === index ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white">
                        <Loader2 size={22} className="animate-spin" />
                      </span>
                    ) : null}
                    <span className="absolute bottom-2 left-2 rounded-full bg-[#14140F]/85 px-2 py-1 text-[8px] font-black text-white">
                      Deal {index + 1}
                    </span>
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingSlot !== null || saving}
                    onChange={(event) => void uploadSpecialImage(index, event)}
                  />
                  <span className="mt-1.5 block text-center text-[9px] font-bold text-black/45">
                    {image ? 'Tap to replace' : 'Choose from gallery'}
                  </span>
                </label>
                {image ? (
                  <button
                    type="button"
                    onClick={() => clearSpecialImage(index)}
                    className="mt-1 w-full text-center text-[9px] font-black text-[#E1352B]"
                  >
                    Remove custom image
                  </button>
                ) : (
                  <p className="mt-1 text-center text-[8px] font-semibold text-[#0F6A5F]">Product photo will be used</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3">
          <p className="text-sm font-black">2. Choose products & prices</p>
          <p className="mt-1 text-[10px] leading-4 text-black/45">
            Select a category and one product, then enter the Original Price and Big Deal Price yourself. Catalog price is not used in the Big Deal.
          </p>
        </div>

        <div className="space-y-4">
          {Array.from({ length: dealCount }, (_, index) => {
            const category = categories.find((item) => item.id === categoryIds[index]);
            const selected = selectedProduct(index);
            const selectedImage = productImage(selected) || images[index] || '';
            const displayImage = specialImages[index] || selectedImage;
            const matchingProducts = category
              ? products.filter((product) => product.active !== false && product.published !== false && productMatchesCategory(product, category))
              : [];
            const showPicker = Boolean(category && (!selected || openPickerIndex === index));

            return (
              <article key={index} className="overflow-hidden rounded-[28px] border border-black/8 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F4F4F1]">
                    {displayImage ? (
                      <img src={displayImage} alt={`Deal ${index + 1}`} className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus size={22} className="text-black/20" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[.15em] text-[#E1352B]">Deal {index + 1}</p>
                    <h3 className="truncate text-lg font-black">{titles[index] || 'Choose one product'}</h3>
                    <p className="mt-0.5 text-[9px] font-semibold text-black/40">
                      {specialImages[index] ? 'Custom gallery image will show on Home' : selected ? 'Product image will show on Home' : 'Select a product below'}
                    </p>
                  </div>
                  {slotComplete(index) ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0F6A5F]/10 px-2.5 py-1.5 text-[9px] font-black text-[#0F6A5F]">
                      <CheckCircle2 size={13} /> Ready
                    </span>
                  ) : null}
                </div>

                <label className="mt-4 grid gap-1.5 text-[10px] font-black uppercase tracking-wider text-black/45">
                  Category
                  <select
                    value={categoryIds[index]}
                    onChange={(event) => selectCategory(index, event.target.value)}
                    className="rounded-2xl border border-black/10 bg-[#F8F8F5] px-3 py-3.5 text-sm font-black normal-case tracking-normal text-[#14140F] outline-none focus:border-[#0F6A5F]"
                  >
                    <option value="">Select category</option>
                    {categories.filter((item) => item.active !== false).map((item) => (
                      <option key={item.id} value={item.id}>{categoryLabel(item)}</option>
                    ))}
                  </select>
                </label>

                {selected && !showPicker ? (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#0F6A5F]/20 bg-[#0F6A5F]/5 p-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white">
                      {selectedImage ? <img src={selectedImage} alt={titles[index] || productTitle(selected)} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-wider text-[#0F6A5F]">Selected product</p>
                      <p className="mt-1 line-clamp-2 text-sm font-black">{titles[index] || dealTitleForProduct(selected)}</p>
                      <p className="mt-1 text-[9px] font-semibold text-black/40">Use only the manual prices below for this Big Deal.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenPickerIndex(index)}
                      className="shrink-0 rounded-full bg-white px-3 py-2 text-[9px] font-black text-[#14140F] shadow-sm"
                    >
                      Change
                    </button>
                  </div>
                ) : null}

                {showPicker ? (
                  <div className="mt-4 rounded-2xl bg-[#F8F8F5] p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-xs font-black">Choose one design</p>
                      <span className="text-[9px] font-bold text-black/35">{matchingProducts.length} products</span>
                    </div>
                    <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {matchingProducts.map((product) => {
                        const image = productImage(product);
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => selectProduct(index, product)}
                            className="overflow-hidden rounded-2xl border border-black/8 bg-white p-2 text-left transition hover:border-[#0F6A5F]"
                          >
                            <div className="aspect-square overflow-hidden rounded-xl bg-[#EEEDEA]">
                              {image ? <img src={image} alt={dealTitleForProduct(product)} className="h-full w-full object-cover" /> : null}
                            </div>
                            <p className="mt-2 line-clamp-2 text-[10px] font-black leading-4">{dealTitleForProduct(product)}</p>
                          </button>
                        );
                      })}
                      {!matchingProducts.length ? (
                        <div className="col-span-full rounded-2xl bg-white px-3 py-6 text-center text-xs font-semibold text-black/35">
                          No products found in this category.
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {productIds[index] ? (
                  <div className="mt-4 grid gap-3 rounded-2xl border border-black/8 p-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-[9px] font-black uppercase tracking-wider text-black/40">
                      Original Price
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={originalPrices[index] || ''}
                        onChange={(event) => updateSlot(index, { originalPrice: Number(event.target.value || 0) })}
                        className="rounded-2xl bg-[#F4F4F1] px-3 py-3 text-sm font-black normal-case tracking-normal text-black outline-none"
                        placeholder="e.g. 3000"
                      />
                    </label>
                    <label className="grid gap-1.5 text-[9px] font-black uppercase tracking-wider text-[#E1352B]">
                      Big Deal Price
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={dealPrices[index] || ''}
                        onChange={(event) => updateSlot(index, { dealPrice: Number(event.target.value || 0) })}
                        className="rounded-2xl bg-[#E1352B]/5 px-3 py-3 text-sm font-black normal-case tracking-normal text-[#E1352B] outline-none"
                        placeholder="e.g. 999"
                      />
                    </label>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {dealCount < SLOT_COUNT ? (
            <button
              type="button"
              onClick={addMoreDeal}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#0F6A5F]/25 bg-[#0F6A5F]/5 px-4 py-4 text-sm font-black text-[#0F6A5F]"
            >
              <Plus size={17} /> Add More Big Deal ({dealCount}/7)
            </button>
          ) : (
            <div className="flex items-center justify-center rounded-2xl bg-[#0F6A5F]/5 px-4 py-4 text-sm font-black text-[#0F6A5F]">
              7/7 Big Deal slots added
            </div>
          )}
          {dealCount > 1 ? (
            <button
              type="button"
              onClick={removeLastDeal}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm font-black text-black/55"
            >
              <Trash2 size={16} /> Remove Deal {dealCount}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-[#0F6A5F]/15 bg-[#0F6A5F]/5 px-4 py-4 text-xs font-semibold leading-5 text-[#0F6A5F]">
        Save any complete set from 1 to 7 deals. One deal runs per Pakistan day. After the last saved deal, Deal 1 starts again automatically and the same rotation keeps repeating until you update it.
      </div>

      <button
        type="button"
        onClick={() => void saveRotation()}
        disabled={saving || uploadingSlot !== null}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E1352B] px-4 py-4 text-sm font-black text-white shadow-sm disabled:opacity-50"
      >
        {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
        {saving ? 'Saving Big Deal...' : `Save ${dealCount} Big Deal${dealCount === 1 ? '' : 's'}`}
      </button>

      {toast ? (
        <div role="status" className="fixed bottom-5 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-[#14140F] px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      ) : null}
    </section>
  );
}