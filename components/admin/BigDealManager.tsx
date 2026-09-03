'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Save, Sparkles } from 'lucide-react';
import { getAdminDocument, setAdminDocument, uploadImageToImgBB, createAdminDocument } from './shared';
import type { DailyDeal } from '@/lib/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY_DEAL: DailyDeal = { productId: '', imageUrl: '', imageUrls: [], title: '', originalPrice: 0, dealPrice: 0, startAt: '', endAt: '', buttonText: 'Shop Big Deal', buttonLink: '/deals/big', active: false };

export default function BigDealManager() {
  const [deal, setDeal] = useState<DailyDeal>(EMPTY_DEAL);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAdminDocument('settings', 'main')
      .then((snapshot) => {
        const current = snapshot.exists() ? snapshot.data()?.dailyDeal : null;
        setDeal({ ...EMPTY_DEAL, ...(current || {}), imageUrls: Array.isArray(current?.imageUrls) ? current.imageUrls.slice(0, 7) : [] });
      })
      .catch(() => setToast('Unable to load Big Deal settings.'))
      .finally(() => setLoading(false));
  }, []);

  const images = useMemo(() => Array.from({ length: 7 }, (_, index) => deal.imageUrls?.[index] || ''), [deal.imageUrls]);

  async function uploadSeven(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(0, 7);
    event.target.value = '';
    if (!files.length) return;
    if (files.length !== 7) {
      setToast('Please select exactly 7 pictures — one for each day.');
      return;
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const url = await uploadImageToImgBB(file);
        urls.push(url);
        await createAdminDocument('media_assets', { name: file.name, url, type: file.type, size: file.size, createdAt: new Date().toISOString(), source: 'big-deal-rotation' });
      }
      setDeal((current) => ({ ...current, imageUrls: urls, imageUrl: urls[0] || current.imageUrl }));
      setToast('7 Big Deal pictures uploaded. Click Save Rotation.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Big Deal upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function saveRotation() {
    if (images.filter(Boolean).length !== 7) {
      setToast('All 7 Big Deal pictures are required before saving.');
      return;
    }
    setSaving(true);
    try {
      await setAdminDocument('settings', 'main', {
        dailyDeal: { ...deal, imageUrls: images, imageUrl: images[0] },
      });
      setToast('Big Deal rotation saved. The home page will change the picture automatically every day.');
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
          <h2 className="mt-1 text-2xl font-black">Big Deal Pictures</h2>
          <p className="mt-1 max-w-2xl text-sm text-black/50">Upload exactly 7 pictures. Sunday uses picture 1, Monday picture 2, and so on. The storefront changes automatically at Pakistan midnight; each picture stays live for one day.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || saving} className="inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-4 py-3 text-xs font-black text-white disabled:opacity-50">
            {uploading ? <Loader2 size={15} className="animate-spin"/> : <ImagePlus size={15}/>} {uploading ? 'Uploading...' : 'Upload 7 Pictures'}
          </button>
          <button type="button" onClick={saveRotation} disabled={uploading || saving} className="inline-flex items-center gap-2 rounded-xl bg-[#E1352B] px-4 py-3 text-xs font-black text-white disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} {saving ? 'Saving...' : 'Save Rotation'}
          </button>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={uploadSeven} className="hidden" />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {DAYS.map((day, index) => (
          <div key={day} className="overflow-hidden rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-black">{index + 1}. {day}</span>{images[index] ? <CheckCircle2 size={15} className="text-[#0F6A5F]"/> : null}</div>
            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[#F4F4F1]">
              {images[index] ? <img src={images[index]} alt={`${day} Big Deal`} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-xs font-bold text-black/30">No picture</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-[#0F6A5F]/15 bg-[#0F6A5F]/5 px-4 py-3 text-xs font-semibold text-[#0F6A5F]">Only the Big Deal image rotation is managed here. Existing Big Deal title, price, product link and home-page layout stay unchanged.</div>

      {toast && <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-[#14140F] px-4 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}
    </section>
  );
}
