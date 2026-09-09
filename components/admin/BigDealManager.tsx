'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Save, Sparkles } from 'lucide-react';
import { uploadImageToImgBB } from './shared';
import type { DailyDeal } from '@/lib/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY_DEAL: DailyDeal = {
  productId: '',
  imageUrl: '',
  imageUrls: [],
  originalPrices: [],
  dealPrices: [],
  title: '',
  originalPrice: 0,
  dealPrice: 0,
  startAt: '',
  endAt: '',
  buttonText: 'Shop Big Deal',
  buttonLink: '/deals/big',
  active: false,
};

export default function BigDealManager() {
  const [deal, setDeal] = useState<DailyDeal>(EMPTY_DEAL);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/admin/big-deal', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) throw new Error(result?.error || 'Unable to load Big Deal settings.');
        const current = result.dailyDeal || {};
        const next = { ...EMPTY_DEAL, ...current } as DailyDeal;
        setDeal({
          ...next,
          imageUrls: Array.isArray(current.imageUrls) ? current.imageUrls.slice(0, 7) : [],
          originalPrices: Array.from({ length: 7 }, (_, index) => Number(current.originalPrices?.[index] ?? current.originalPrice ?? 0)),
          dealPrices: Array.from({ length: 7 }, (_, index) => Number(current.dealPrices?.[index] ?? current.dealPrice ?? 0)),
        });
      })
      .catch((error) => setToast(error instanceof Error ? error.message : 'Unable to load Big Deal settings.'))
      .finally(() => setLoading(false));
  }, []);

  const images = useMemo(() => Array.from({ length: 7 }, (_, index) => deal.imageUrls?.[index] || ''), [deal.imageUrls]);
  const originalPrices = useMemo(() => Array.from({ length: 7 }, (_, index) => Number(deal.originalPrices?.[index] || 0)), [deal.originalPrices]);
  const dealPrices = useMemo(() => Array.from({ length: 7 }, (_, index) => Number(deal.dealPrices?.[index] || 0)), [deal.dealPrices]);

  function updatePrice(index: number, kind: 'original' | 'deal', rawValue: string) {
    const value = Math.max(0, Number(rawValue || 0));
    setDeal((current) => {
      const original = Array.from({ length: 7 }, (_, i) => Number(current.originalPrices?.[i] || current.originalPrice || 0));
      const special = Array.from({ length: 7 }, (_, i) => Number(current.dealPrices?.[i] || current.dealPrice || 0));
      if (kind === 'original') original[index] = value;
      else special[index] = value;
      return { ...current, originalPrices: original, dealPrices: special };
    });
  }

  async function uploadSeven(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 7);
    event.target.value = '';
    if (!files.length) return;
    if (files.length !== 7) {
      setToast('Please select exactly 7 pictures — one for each day.');
      return;
    }
    setUploading(true);
    setToast('Uploading 7 pictures…');
    try {
      const urls: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setToast(`Uploading picture ${index + 1} of 7…`);
        let url = '';
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 2 && !url; attempt += 1) {
          try {
            url = await uploadImageToImgBB(file);
          } catch (error) {
            lastError = error;
          }
        }
        if (!url) throw lastError instanceof Error ? lastError : new Error(`Picture ${index + 1} upload failed.`);
        urls.push(url);
      }
      setDeal((current) => ({ ...current, imageUrls: urls, imageUrl: urls[0] || current.imageUrl }));
      setToast('7 Big Deal pictures uploaded. Add each day’s prices and save.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Big Deal upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function saveRotation() {
    if (deal.active && !deal.title.trim()) {
      setToast('Big Deal title is required.');
      return;
    }
    if (deal.active && !deal.productId.trim()) {
      setToast('Big Deal product ID is required.');
      return;
    }
    if (images.filter(Boolean).length !== 7) {
      setToast('All 7 Big Deal pictures are required before saving.');
      return;
    }
    const missingPrice = dealPrices.findIndex((price, index) => price <= 0 || originalPrices[index] <= 0);
    if (missingPrice >= 0) {
      setToast(`${DAYS[missingPrice]} needs both original and deal price.`);
      return;
    }
    const invalidPrice = dealPrices.findIndex((price, index) => price >= originalPrices[index]);
    if (invalidPrice >= 0) {
      setToast(`${DAYS[invalidPrice]} deal price must be lower than its original price.`);
      return;
    }

    setSaving(true);
    try {
      const nextDeal: DailyDeal = {
        ...deal,
        title: deal.title.trim(),
        productId: deal.productId.trim(),
        imageUrls: images,
        imageUrl: images[0],
        originalPrices,
        dealPrices,
        originalPrice: originalPrices[0] || deal.originalPrice || 0,
        dealPrice: dealPrices[0] || deal.dealPrice || 0,
        buttonText: deal.buttonText.trim() || 'Shop Big Deal',
        buttonLink: deal.buttonLink.trim() || '/deals/big',
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
      setDeal(nextDeal);
      setToast(result.warning || 'Big Deal saved to Supabase primary.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to save Big Deal rotation.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-black/50">Loading Big Deal manager...</div>;

  return (
    <section className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#E1352B]"><Sparkles size={15}/><span className="text-[10px] font-black uppercase tracking-[.16em]">Home Big Deal</span></div>
          <h2 className="mt-1 text-2xl font-black">Big Deal Manager</h2>
          <p className="mt-1 max-w-2xl text-sm text-black/50">This is now the only Big Deal control. It saves to Supabase primary and powers the homepage Big Deal card.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || saving} className="inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-4 py-3 text-xs font-black text-white disabled:opacity-50">
            {uploading ? <Loader2 size={15} className="animate-spin"/> : <ImagePlus size={15}/>} {uploading ? 'Uploading...' : 'Upload 7 Pictures'}
          </button>
          <button type="button" onClick={saveRotation} disabled={uploading || saving} className="inline-flex items-center gap-2 rounded-xl bg-[#E1352B] px-4 py-3 text-xs font-black text-white disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} {saving ? 'Saving...' : 'Save Big Deal'}
          </button>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={uploadSeven} className="hidden" />

      <div className="mt-5 grid gap-3 rounded-2xl border border-black/10 bg-white p-4 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold md:col-span-2">
          <span className="flex items-center justify-between gap-3"><span>Publish Big Deal</span><input type="checkbox" checked={deal.active} onChange={(event) => setDeal((current) => ({ ...current, active: event.target.checked }))}/></span>
        </label>
        <label className="grid gap-1 text-xs font-semibold">Title<input value={deal.title} onChange={(event) => setDeal((current) => ({ ...current, title: event.target.value }))} placeholder="Big Deal title" className="rounded-lg border border-black/15 px-3 py-2 text-sm" /></label>
        <label className="grid gap-1 text-xs font-semibold">Product ID<input value={deal.productId} onChange={(event) => setDeal((current) => ({ ...current, productId: event.target.value }))} placeholder="Product ID" className="rounded-lg border border-black/15 px-3 py-2 text-sm" /></label>
        <label className="grid gap-1 text-xs font-semibold">Button text<input value={deal.buttonText} onChange={(event) => setDeal((current) => ({ ...current, buttonText: event.target.value }))} className="rounded-lg border border-black/15 px-3 py-2 text-sm" /></label>
        <label className="grid gap-1 text-xs font-semibold">Button link<input value={deal.buttonLink} onChange={(event) => setDeal((current) => ({ ...current, buttonLink: event.target.value }))} className="rounded-lg border border-black/15 px-3 py-2 text-sm" /></label>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {DAYS.map((day, index) => (
          <div key={day} className="overflow-hidden rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-black">{index + 1}. {day}</span>{images[index] ? <CheckCircle2 size={15} className="text-[#0F6A5F]"/> : null}</div>
            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[#F4F4F1]">
              {images[index] ? <img src={images[index]} alt={`${day} Big Deal`} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-xs font-bold text-black/30">No picture</div>}
            </div>
            <div className="mt-3 grid gap-2">
              <label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/45">Original Price</span><input type="number" min="0" inputMode="numeric" value={originalPrices[index] || ''} onChange={(event) => updatePrice(index, 'original', event.target.value)} placeholder="e.g. 1200" className="w-full rounded-xl border border-black/10 bg-[#F7F7F4] px-3 py-2.5 text-xs font-black outline-none focus:border-black/30" /></label>
              <label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-[#E1352B]">Deal Price</span><input type="number" min="0" inputMode="numeric" value={dealPrices[index] || ''} onChange={(event) => updatePrice(index, 'deal', event.target.value)} placeholder="e.g. 799" className="w-full rounded-xl border border-[#E1352B]/20 bg-[#FFF7F6] px-3 py-2.5 text-xs font-black text-[#E1352B] outline-none focus:border-[#E1352B]/50" /></label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-[#0F6A5F]/15 bg-[#0F6A5F]/5 px-4 py-3 text-xs font-semibold text-[#0F6A5F]">Sunday uses picture/price 1, Monday 2, through Saturday 7. The homepage automatically uses today’s matching picture and price.</div>

      {toast && <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-[#14140F] px-4 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}
    </section>
  );
}
