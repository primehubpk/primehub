'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Save, Sparkles } from 'lucide-react';
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
  imageUrl?: string;
  productId?: string;
  title?: string;
  categoryId?: string;
  originalPrice?: number;
  dealPrice?: number;
};

const SLOT_COUNT = 7;
const EMPTY_DEAL: DailyDeal = {
  productId: '', imageUrl: '', imageUrls: [], productIds: [], titles: [], categoryIds: [],
  originalPrices: [], dealPrices: [], title: '', originalPrice: 0, dealPrice: 0,
  rotationStartedAt: '', startAt: '', endAt: '', buttonText: 'Shop Big Deal', buttonLink: '/deals/big', active: false,
};

const clean = (value: unknown) => String(value || '').trim().toLowerCase();
const categoryLabel = (category: CatalogCategory) => category.title || category.name || category.slug || category.id;
const productTitle = (product: CatalogProduct) => product.title || product.name || product.id;

function productImage(product: CatalogProduct) {
  if (product.imageUrl) return product.imageUrl;
  if (product.image) return product.image;
  const first = Array.isArray(product.images) ? product.images[0] : null;
  return typeof first === 'string' ? first : first?.url || '';
}

function productRegularPrice(product: CatalogProduct) {
  const value = Number(product.originalPrice || product.normalPrice || product.price || 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
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
    productIds: Array.from({ length: SLOT_COUNT }, (_, index) => String(current.productIds?.[index] || '')),
    titles: Array.from({ length: SLOT_COUNT }, (_, index) => String(current.titles?.[index] || '')),
    categoryIds: Array.from({ length: SLOT_COUNT }, (_, index) => String(current.categoryIds?.[index] || '')),
    originalPrices: Array.from({ length: SLOT_COUNT }, (_, index) => Number(current.originalPrices?.[index] || 0)),
    dealPrices: Array.from({ length: SLOT_COUNT }, (_, index) => Number(current.dealPrices?.[index] || 0)),
  };
}

export default function BigDealManager() {
  const [deal, setDeal] = useState<DailyDeal>(EMPTY_DEAL);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/admin/big-deal', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) throw new Error(result?.error || 'Unable to load Big Deal settings.');
        const current = { ...EMPTY_DEAL, ...(result.dailyDeal || {}) } as DailyDeal;
        const arrays = normalizeArrays(current);
        setDeal({
          ...current,
          imageUrls: arrays.images,
          productIds: arrays.productIds,
          titles: arrays.titles,
          categoryIds: arrays.categoryIds,
          originalPrices: arrays.originalPrices,
          dealPrices: arrays.dealPrices,
        });
        setProducts(Array.isArray(result.products) ? result.products : []);
        setCategories(Array.isArray(result.categories) ? result.categories : []);
      })
      .catch((error) => setToast(error instanceof Error ? error.message : 'Unable to load Big Deal settings.'))
      .finally(() => setLoading(false));
  }, []);

  const arrays = useMemo(() => normalizeArrays(deal), [deal]);
  const { images, productIds, titles, categoryIds, originalPrices, dealPrices } = arrays;

  const uploadedIndexes = useMemo(
    () => images.map((image, index) => image ? index : -1).filter((index) => index >= 0),
    [images],
  );
  const highestUploadedIndex = uploadedIndexes.length ? Math.max(...uploadedIndexes) : -1;
  const imageTileCount = Math.min(SLOT_COUNT, Math.max(1, highestUploadedIndex + 2));

  function updateSlot(index: number, patch: SlotPatch) {
    setDeal((current) => {
      const next = normalizeArrays(current);
      if (patch.imageUrl !== undefined) next.images[index] = patch.imageUrl;
      if (patch.productId !== undefined) next.productIds[index] = patch.productId;
      if (patch.title !== undefined) next.titles[index] = patch.title;
      if (patch.categoryId !== undefined) next.categoryIds[index] = patch.categoryId;
      if (patch.originalPrice !== undefined) next.originalPrices[index] = Math.max(0, patch.originalPrice);
      if (patch.dealPrice !== undefined) next.dealPrices[index] = Math.max(0, patch.dealPrice);
      return {
        ...current,
        imageUrls: next.images,
        productIds: next.productIds,
        titles: next.titles,
        categoryIds: next.categoryIds,
        originalPrices: next.originalPrices,
        dealPrices: next.dealPrices,
        imageUrl: next.images[0] || '',
        productId: next.productIds[0] || '',
        title: next.titles[0] || '',
        originalPrice: next.originalPrices[0] || 0,
        dealPrice: next.dealPrices[0] || 0,
      };
    });
  }

  async function uploadSlotImage(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingSlot(index);
    try {
      const url = await uploadImageToImgBB(file);
      updateSlot(index, { imageUrl: url });
      setToast(`Deal ${index + 1} image added. Choose its category and product below.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploadingSlot(null);
    }
  }

  function selectCategory(index: number, categoryId: string) {
    updateSlot(index, { categoryId, productId: '', title: '', originalPrice: 0, dealPrice: 0 });
  }

  function selectProduct(index: number, product: CatalogProduct) {
    updateSlot(index, {
      productId: product.id,
      title: productTitle(product),
      categoryId: categoryIds[index] || String(product.categoryId || product.category || ''),
      originalPrice: productRegularPrice(product),
      dealPrice: 0,
    });
  }

  function slotComplete(index: number) {
    return Boolean(
      images[index] && productIds[index] && titles[index] &&
      originalPrices[index] > 0 && dealPrices[index] > 0 && dealPrices[index] < originalPrices[index]
    );
  }

  async function saveRotation() {
    const configured = Array.from({ length: SLOT_COUNT }, (_, index) => index).filter((index) => Boolean(images[index]));
    if (!configured.length) {
      setToast('Add at least one Big Deal image first.');
      return;
    }

    const invalid = configured.find((index) => !slotComplete(index));
    if (invalid !== undefined) {
      setToast(`Complete Deal ${invalid + 1}: choose a product, enter original price and a lower Big Deal price.`);
      return;
    }

    const compact = configured.map((index) => ({
      imageUrl: images[index],
      productId: productIds[index],
      title: titles[index],
      categoryId: categoryIds[index],
      originalPrice: originalPrices[index],
      dealPrice: dealPrices[index],
    }));
    const pad = <T,>(items: T[], empty: T) => Array.from({ length: SLOT_COUNT }, (_, index) => items[index] ?? empty);
    const nextImages = pad(compact.map((item) => item.imageUrl), '');
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
      setDeal({ ...saved, imageUrls: savedArrays.images, productIds: savedArrays.productIds, titles: savedArrays.titles, categoryIds: savedArrays.categoryIds, originalPrices: savedArrays.originalPrices, dealPrices: savedArrays.dealPrices });
      setToast(result.warning || `${compact.length} Big Deal${compact.length === 1 ? '' : 's'} saved. Deal 1 is live first and the saved rotation repeats automatically until you update it.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to save Big Deal rotation.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-black/50">Loading Big Deal manager...</div>;

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="rounded-[28px] bg-[#14140F] p-5 text-white sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#FFCF68]"><Sparkles size={15} /><span className="text-[10px] font-black uppercase tracking-[.18em]">PrimeHubMall Big Deal</span></div>
            <h2 className="mt-2 text-2xl font-black">Build 1 to 7 Big Deals</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-white/55">Upload only as many deal images as you want. After each image, choose its category, select the exact product, set original price and Big Deal price, then save.</p>
          </div>
          <button type="button" onClick={() => void saveRotation()} disabled={saving || uploadingSlot !== null} className="hidden shrink-0 items-center gap-2 rounded-full bg-white px-4 py-3 text-xs font-black text-[#14140F] disabled:opacity-50 sm:inline-flex">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {saving ? 'Saving...' : 'Save Big Deal'}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-[28px] border border-black/8 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm font-black">1. Add deal images</p><p className="mt-1 text-[10px] text-black/40">Gallery upload · minimum 1, maximum 7 · next image box appears automatically.</p></div>
          <span className="rounded-full bg-[#F4F4F1] px-3 py-1.5 text-[9px] font-black text-black/45">{uploadedIndexes.length}/7 added</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: imageTileCount }, (_, index) => {
            const image = images[index];
            return (
              <label key={index} className="group cursor-pointer">
                <span className={`relative flex aspect-square overflow-hidden rounded-2xl border-2 ${image ? 'border-[#0F6A5F]' : 'border-dashed border-black/15 bg-[#F4F4F1]'} items-center justify-center`}>
                  {image ? <img src={image} alt={`Big Deal ${index + 1}`} className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-2 px-3 text-center text-[9px] font-black text-black/35"><ImagePlus size={22} /> Add image</span>}
                  {uploadingSlot === index ? <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white"><Loader2 size={22} className="animate-spin" /></span> : null}
                  <span className="absolute bottom-2 left-2 rounded-full bg-[#14140F]/85 px-2 py-1 text-[8px] font-black text-white">Deal {index + 1}</span>
                </span>
                <input type="file" accept="image/*" className="hidden" disabled={uploadingSlot !== null || saving} onChange={(event) => void uploadSlotImage(index, event)} />
                <span className="mt-1.5 block text-center text-[9px] font-bold text-black/45">{image ? 'Tap to replace' : 'Choose from gallery'}</span>
              </label>
            );
          })}
        </div>
      </div>

      {uploadedIndexes.length ? (
        <div className="mt-5">
          <div className="mb-3"><p className="text-sm font-black">2. Choose product & prices</p><p className="mt-1 text-[10px] text-black/40">Open a category. Its product images and names appear directly below; tap the design you want.</p></div>
          <div className="space-y-4">
            {uploadedIndexes.map((index) => {
              const category = categories.find((item) => item.id === categoryIds[index]);
              const matchingProducts = category ? products.filter((product) => product.active !== false && product.published !== false && productMatchesCategory(product, category)) : [];
              return (
                <article key={index} className="overflow-hidden rounded-[28px] border border-black/8 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center gap-3">
                    <img src={images[index]} alt={`Deal ${index + 1}`} className="h-16 w-16 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.15em] text-[#E1352B]">Deal {index + 1}</p><h3 className="truncate text-lg font-black">{titles[index] || 'Choose a product'}</h3></div>
                    {slotComplete(index) ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0F6A5F]/10 px-2.5 py-1.5 text-[9px] font-black text-[#0F6A5F]"><CheckCircle2 size={13} /> Ready</span> : null}
                  </div>

                  <label className="mt-4 grid gap-1.5 text-[10px] font-black uppercase tracking-wider text-black/45">Category
                    <select value={categoryIds[index]} onChange={(event) => selectCategory(index, event.target.value)} className="rounded-2xl border border-black/10 bg-[#F8F8F5] px-3 py-3.5 text-sm font-black normal-case tracking-normal text-[#14140F] outline-none focus:border-[#0F6A5F]">
                      <option value="">Select category</option>
                      {categories.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{categoryLabel(item)}</option>)}
                    </select>
                  </label>

                  {category ? (
                    <div className="mt-4 rounded-2xl bg-[#F8F8F5] p-3">
                      <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-black">Choose a design</p><span className="text-[9px] font-bold text-black/35">{matchingProducts.length} products</span></div>
                      <div className="grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {matchingProducts.map((product) => {
                          const selected = productIds[index] === product.id;
                          const image = productImage(product);
                          return (
                            <button key={product.id} type="button" onClick={() => selectProduct(index, product)} className={`overflow-hidden rounded-2xl border bg-white p-2 text-left transition ${selected ? 'border-[#0F6A5F] ring-2 ring-[#0F6A5F]/15' : 'border-black/8 hover:border-black/25'}`}>
                              <div className="aspect-square overflow-hidden rounded-xl bg-[#EEEDEA]">{image ? <img src={image} alt={productTitle(product)} className="h-full w-full object-cover" /> : null}</div>
                              <p className="mt-2 line-clamp-2 text-[10px] font-black leading-4">{productTitle(product)}</p>
                              <p className="mt-1 text-[10px] font-black text-[#E1352B]">Rs. {Number(product.price || 0).toLocaleString('en-PK')}</p>
                            </button>
                          );
                        })}
                        {!matchingProducts.length ? <div className="col-span-full rounded-2xl bg-white px-3 py-6 text-center text-xs font-semibold text-black/35">No products found in this category.</div> : null}
                      </div>
                    </div>
                  ) : null}

                  {productIds[index] ? (
                    <div className="mt-4 grid gap-3 rounded-2xl border border-black/8 p-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-[9px] font-black uppercase tracking-wider text-black/40">Original Price
                        <input type="number" min="0" inputMode="numeric" value={originalPrices[index] || ''} onChange={(event) => updateSlot(index, { originalPrice: Number(event.target.value || 0) })} className="rounded-2xl bg-[#F4F4F1] px-3 py-3 text-sm font-black normal-case tracking-normal text-black outline-none" placeholder="e.g. 6000" />
                      </label>
                      <label className="grid gap-1.5 text-[9px] font-black uppercase tracking-wider text-[#E1352B]">Big Deal Price
                        <input type="number" min="0" inputMode="numeric" value={dealPrices[index] || ''} onChange={(event) => updateSlot(index, { dealPrice: Number(event.target.value || 0) })} className="rounded-2xl bg-[#E1352B]/5 px-3 py-3 text-sm font-black normal-case tracking-normal text-[#E1352B] outline-none" placeholder="e.g. 2999" />
                      </label>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-[24px] border border-[#0F6A5F]/15 bg-[#0F6A5F]/5 px-4 py-4 text-xs font-semibold leading-5 text-[#0F6A5F]">Save works with any complete set from 1 to 7 deals. The saved deals rotate one per Pakistan day. When the last saved deal finishes, Deal 1 starts again automatically and keeps repeating until you update this page.</div>

      <button type="button" onClick={() => void saveRotation()} disabled={saving || uploadingSlot !== null} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E1352B] px-4 py-4 text-sm font-black text-white shadow-sm disabled:opacity-50">
        {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} {saving ? 'Saving Big Deal...' : `Save ${uploadedIndexes.length || ''} Big Deal${uploadedIndexes.length === 1 ? '' : 's'}`}
      </button>

      {toast ? <div role="status" className="fixed bottom-5 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-[#14140F] px-4 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div> : null}
    </section>
  );
}
