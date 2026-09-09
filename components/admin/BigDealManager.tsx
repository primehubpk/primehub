'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Plus, Save, Sparkles } from 'lucide-react';
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

export default function BigDealManager() {
  const [deal, setDeal] = useState<DailyDeal>(EMPTY_DEAL);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [visibleSlots, setVisibleSlots] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/admin/big-deal', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) throw new Error(result?.error || 'Unable to load Big Deal settings.');
        const current = result.dailyDeal || {};
        const next = { ...EMPTY_DEAL, ...current } as DailyDeal;
        const imageUrls = Array.from({ length: SLOT_COUNT }, (_, index) => String(current.imageUrls?.[index] || ''));
        const productIds = Array.from({ length: SLOT_COUNT }, (_, index) => String(current.productIds?.[index] || ''));
        const titles = Array.from({ length: SLOT_COUNT }, (_, index) => String(current.titles?.[index] || ''));
        const categoryIds = Array.from({ length: SLOT_COUNT }, (_, index) => String(current.categoryIds?.[index] || ''));
        const originalPrices = Array.from({ length: SLOT_COUNT }, (_, index) => Number(current.originalPrices?.[index] || 0));
        const dealPrices = Array.from({ length: SLOT_COUNT }, (_, index) => Number(current.dealPrices?.[index] || 0));
        setDeal({ ...next, imageUrls, productIds, titles, categoryIds, originalPrices, dealPrices });
        setProducts(Array.isArray(result.products) ? result.products : []);
        setCategories(Array.isArray(result.categories) ? result.categories : []);
        let highest = 0;
        for (let index = 0; index < SLOT_COUNT; index += 1) {
          if (imageUrls[index] || productIds[index] || titles[index] || originalPrices[index] > 0 || dealPrices[index] > 0) highest = index;
        }
        setVisibleSlots(Math.max(1, Math.min(SLOT_COUNT, highest + 1)));
      })
      .catch((error) => setToast(error instanceof Error ? error.message : 'Unable to load Big Deal settings.'))
      .finally(() => setLoading(false));
  }, []);

  const images = useMemo(() => Array.from({ length: SLOT_COUNT }, (_, index) => deal.imageUrls?.[index] || ''), [deal.imageUrls]);
  const productIds = useMemo(() => Array.from({ length: SLOT_COUNT }, (_, index) => deal.productIds?.[index] || ''), [deal.productIds]);
  const titles = useMemo(() => Array.from({ length: SLOT_COUNT }, (_, index) => deal.titles?.[index] || ''), [deal.titles]);
  const categoryIds = useMemo(() => Array.from({ length: SLOT_COUNT }, (_, index) => deal.categoryIds?.[index] || ''), [deal.categoryIds]);
  const originalPrices = useMemo(() => Array.from({ length: SLOT_COUNT }, (_, index) => Number(deal.originalPrices?.[index] || 0)), [deal.originalPrices]);
  const dealPrices = useMemo(() => Array.from({ length: SLOT_COUNT }, (_, index) => Number(deal.dealPrices?.[index] || 0)), [deal.dealPrices]);

  function updateSlot(index: number, patch: SlotPatch) {
    setDeal((current) => {
      const nextImages = Array.from({ length: SLOT_COUNT }, (_, itemIndex) => current.imageUrls?.[itemIndex] || '');
      const nextProducts = Array.from({ length: SLOT_COUNT }, (_, itemIndex) => current.productIds?.[itemIndex] || '');
      const nextTitles = Array.from({ length: SLOT_COUNT }, (_, itemIndex) => current.titles?.[itemIndex] || '');
      const nextCategories = Array.from({ length: SLOT_COUNT }, (_, itemIndex) => current.categoryIds?.[itemIndex] || '');
      const nextOriginals = Array.from({ length: SLOT_COUNT }, (_, itemIndex) => Number(current.originalPrices?.[itemIndex] || 0));
      const nextDeals = Array.from({ length: SLOT_COUNT }, (_, itemIndex) => Number(current.dealPrices?.[itemIndex] || 0));
      if (patch.imageUrl !== undefined) nextImages[index] = patch.imageUrl;
      if (patch.productId !== undefined) nextProducts[index] = patch.productId;
      if (patch.title !== undefined) nextTitles[index] = patch.title;
      if (patch.categoryId !== undefined) nextCategories[index] = patch.categoryId;
      if (patch.originalPrice !== undefined) nextOriginals[index] = Math.max(0, patch.originalPrice);
      if (patch.dealPrice !== undefined) nextDeals[index] = Math.max(0, patch.dealPrice);
      return {
        ...current,
        imageUrls: nextImages, productIds: nextProducts, titles: nextTitles, categoryIds: nextCategories,
        originalPrices: nextOriginals, dealPrices: nextDeals,
        imageUrl: nextImages[0] || '', productId: nextProducts[0] || '', title: nextTitles[0] || '',
        originalPrice: nextOriginals[0] || 0, dealPrice: nextDeals[0] || 0,
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
      setToast(`Deal ${index + 1} image added.`);
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
      imageUrl: images[index] || productImage(product),
      originalPrice: productRegularPrice(product),
    });
  }

  function slotComplete(index: number) {
    return Boolean(
      images[index] && productIds[index] && titles[index] &&
      originalPrices[index] > 0 && dealPrices[index] > 0 && dealPrices[index] < originalPrices[index]
    );
  }

  async function saveRotation() {
    const configured = Array.from({ length: visibleSlots }, (_, index) => index).filter((index) =>
      images[index] || productIds[index] || titles[index] || originalPrices[index] > 0 || dealPrices[index] > 0,
    );
    const invalid = configured.find((index) => !slotComplete(index));
    if (invalid !== undefined) {
      setToast(`Complete Deal ${invalid + 1}: image, product, original price and lower Big Deal price are required.`);
      return;
    }
    if (deal.active && (visibleSlots !== SLOT_COUNT || !Array.from({ length: SLOT_COUNT }, (_, index) => slotComplete(index)).every(Boolean))) {
      setToast('Add and complete all 7 deals before publishing the 7-day cycle.');
      return;
    }

    setSaving(true);
    try {
      const nextDeal: DailyDeal = {
        ...deal,
        imageUrls: images, productIds, titles, categoryIds, originalPrices, dealPrices,
        imageUrl: images[0] || '', productId: productIds[0] || '', title: titles[0] || '',
        originalPrice: originalPrices[0] || 0, dealPrice: dealPrices[0] || 0,
        buttonText: deal.buttonText?.trim() || 'Shop Big Deal',
        buttonLink: deal.buttonLink?.trim() || '/deals/big',
      };
      const response = await fetch('/api/admin/big-deal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store',
        body: JSON.stringify({ dailyDeal: nextDeal }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Unable to save Big Deal rotation.');
      setDeal(result.dailyDeal || nextDeal);
      setToast(result.warning || (deal.active ? '7-day Big Deal cycle saved. Deal 1 starts first and the cycle repeats automatically.' : 'Big Deal draft saved.'));
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to save Big Deal rotation.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-black/50">Loading Big Deal manager...</div>;

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#E1352B]"><Sparkles size={15}/><span className="text-[10px] font-black uppercase tracking-[.16em]">Home Big Deal</span></div>
          <h2 className="mt-1 text-2xl font-black">7-Day Big Deal Gallery</h2>
          <p className="mt-1 max-w-2xl text-sm text-black/50">Add Deal 1 first, then Deal 2 through Deal 7. The first published deal starts first, the next deal unlocks each Pakistan day, and the same 7 deals repeat until you update them.</p>
        </div>
        <button type="button" onClick={saveRotation} disabled={saving || uploadingSlot !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E1352B] px-4 py-3 text-xs font-black text-white disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} {saving ? 'Saving...' : deal.active ? 'Save 7-Day Cycle' : 'Save Draft'}
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
        <label className="flex items-center justify-between gap-4 text-sm font-black">
          <span><span className="block">Publish 7-Day Big Deal</span><span className="mt-1 block text-[11px] font-medium text-black/45">Publishing requires all 7 deals complete.</span></span>
          <input type="checkbox" checked={deal.active} onChange={(event) => setDeal((current) => ({ ...current, active: event.target.checked }))} />
        </label>
      </div>

      <div className="mt-5 space-y-4">
        {Array.from({ length: visibleSlots }, (_, index) => {
          const category = categories.find((item) => item.id === categoryIds[index]);
          const matchingProducts = category ? products.filter((product) => product.active !== false && product.published !== false && productMatchesCategory(product, category)) : [];
          return (
            <article key={index} className="overflow-hidden rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#E1352B]">Sequence {index + 1} of 7</p><h3 className="text-lg font-black">Deal {index + 1}</h3></div>
                {slotComplete(index) ? <span className="inline-flex items-center gap-1 rounded-full bg-[#0F6A5F]/10 px-2.5 py-1 text-[10px] font-black text-[#0F6A5F]"><CheckCircle2 size={13}/>Ready</span> : null}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div>
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#F4F4F1]">
                    {images[index] ? <img src={images[index]} alt={`Deal ${index + 1}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-5 text-center text-xs font-bold text-black/30">Add the Deal {index + 1} image</div>}
                  </div>
                  <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#14140F] px-3 py-2.5 text-xs font-black text-white">
                    {uploadingSlot === index ? <Loader2 size={14} className="animate-spin"/> : <ImagePlus size={14}/>} {images[index] ? 'Replace image' : 'Add image'}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingSlot !== null || saving} onChange={(event) => void uploadSlotImage(index, event)} />
                  </label>
                </div>

                <div className="min-w-0">
                  <label className="grid gap-1 text-xs font-black">Category
                    <select value={categoryIds[index]} onChange={(event) => selectCategory(index, event.target.value)} className="rounded-xl border border-black/15 bg-white px-3 py-3 text-sm font-semibold">
                      <option value="">Select category — e.g. Glass Bangles</option>
                      {categories.filter((item) => item.active !== false).map((item) => <option key={item.id} value={item.id}>{categoryLabel(item)}</option>)}
                    </select>
                  </label>

                  {category ? (
                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-black">Choose a design</p><span className="text-[10px] font-semibold text-black/40">{matchingProducts.length} products</span></div>
                      <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
                        {matchingProducts.map((product) => {
                          const selected = productIds[index] === product.id;
                          const image = productImage(product);
                          return <button key={product.id} type="button" onClick={() => selectProduct(index, product)} className={`overflow-hidden rounded-xl border p-2 text-left transition ${selected ? 'border-[#0F6A5F] bg-[#0F6A5F]/5 ring-1 ring-[#0F6A5F]' : 'border-black/10 hover:border-black/30'}`}>
                            <div className="aspect-square overflow-hidden rounded-lg bg-[#F4F4F1]">{image ? <img src={image} alt={productTitle(product)} className="h-full w-full object-cover"/> : null}</div>
                            <p className="mt-1.5 line-clamp-2 text-[10px] font-black leading-4">{productTitle(product)}</p>
                            <p className="mt-1 text-[10px] font-bold text-[#E1352B]">Rs. {Number(product.price || 0).toLocaleString('en-PK')}</p>
                          </button>;
                        })}
                        {!matchingProducts.length ? <div className="col-span-full rounded-xl bg-[#F4F4F1] px-3 py-5 text-center text-xs font-semibold text-black/40">No products found in this category.</div> : null}
                      </div>
                    </div>
                  ) : null}

                  {productIds[index] ? (
                    <div className="mt-4 rounded-2xl bg-[#F7F7F4] p-3">
                      <p className="text-xs font-black">{titles[index]}</p>
                      <p className="mt-0.5 text-[10px] text-black/40">Product ID: {productIds[index]}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-black/45">Original Price<input type="number" min="0" inputMode="numeric" value={originalPrices[index] || ''} onChange={(event) => updateSlot(index, { originalPrice: Number(event.target.value || 0) })} className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-black text-black"/></label>
                        <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-[#E1352B]">Big Deal Price<input type="number" min="0" inputMode="numeric" value={dealPrices[index] || ''} onChange={(event) => updateSlot(index, { dealPrice: Number(event.target.value || 0) })} className="rounded-xl border border-[#E1352B]/20 bg-white px-3 py-2.5 text-sm font-black text-[#E1352B]"/></label>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {visibleSlots < SLOT_COUNT ? (
        <button type="button" disabled={!slotComplete(visibleSlots - 1)} onClick={() => setVisibleSlots((count) => Math.min(SLOT_COUNT, count + 1))} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/20 bg-white px-4 py-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40">
          <Plus size={16}/> Add Deal {visibleSlots + 1}
        </button>
      ) : null}

      <div className="mt-4 rounded-2xl border border-[#0F6A5F]/15 bg-[#0F6A5F]/5 px-4 py-3 text-xs font-semibold leading-5 text-[#0F6A5F]">Deal 1 is the first live deal when the cycle is published. Deal 2 is next, then Deal 3, through Deal 7. After Deal 7, Deal 1 automatically starts again. Homepage stays limited to two cards: today’s LIVE deal and tomorrow’s LOCKED deal with its real image, title and price.</div>

      {toast && <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-[#14140F] px-4 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}
    </section>
  );
}
