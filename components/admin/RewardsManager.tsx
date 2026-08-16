'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Gift, Disc, Calendar, History, Upload, Search, X, Check, Trash2, Edit3 } from 'lucide-react';
import { adminCollection, createAdminDocument, updateAdminDocument, deleteAdminDocument, setAdminDocument, uploadImageToImgBB } from './shared';

interface GiftReward {
  id: string;
  title: string;
  productId?: string;
  pointsCost: number;
  stock: number;
  active: boolean;
  description?: string;
  imageUrl?: string;
  mediaAssetId?: string;
}

interface Prize {
  id: string;
  name: string;
  type: string;
  points: number;
  probability: number;
  active: boolean;
  stock: number;
  imageUrl?: string;
}

export default function RewardsManager({ products = [] }: { products?: any[] }) {
  const [tab, setTab] = useState<'overview' | 'wheel' | 'checkin' | 'store' | 'redemptions'>('overview');
  const [settings, setSettings] = useState<any>({ pointPresets: [100, 200, 500], spinWheelSlots: [] });
  const [gifts, setGifts] = useState<GiftReward[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [mediaPoints, setMediaPoints] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = adminCollection('reward_gifts', (docs) => {
      setGifts(docs as GiftReward[]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = adminCollection('media_assets', (docs) => {
      setMediaAssets(docs);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = adminCollection('settings', (docs) => {
      const d: any = docs.find((x: any) => x.id === 'rewards')?.data || {};
      if (d) setSettings((prev: any) => ({ ...prev, ...d }));
    });
    return () => unsub();
  }, []);

  const total = useMemo(() => prizes.filter(p => p.active).reduce((n, p) => n + Number(p.probability || 0), 0), [prizes]);

  async function saveSettings() {
    setSaving(true);
    setMessage('');
    try {
      await setAdminDocument('settings', 'rewards', { ...settings, updatedAt: new Date().toISOString() });
      setMessage('Settings saved successfully.');
    } catch (e: any) {
      setMessage(e?.message || 'Error saving settings.');
    } finally {
      setSaving(false);
    }
  }

  function addPrize() {
    setPrizes(x => [...x, { id: crypto.randomUUID(), name: 'Try Again', type: 'try-again', points: 0, probability: 10, active: true, stock: 999 }]);
  }

  async function addGift() {
    await createAdminDocument('reward_gifts', {
      title: 'New Reward',
      productId: '',
      pointsCost: settings.pointPresets?.[0] || 100,
      stock: 1,
      active: true,
      description: '',
      imageUrl: '',
      createdAt: new Date().toISOString()
    });
  }

  async function saveGift(g: GiftReward) {
    const { id, ...data } = g;
    await updateAdminDocument('reward_gifts', id, { ...data, updatedAt: new Date().toISOString() });
  }

  async function selectProduct(g: GiftReward, productId: string) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const img = typeof p.imageUrl === 'string' && p.imageUrl ? p.imageUrl : (typeof p.images?.[0] === 'string' ? p.images[0] : (p.images?.[0] as any)?.url || '');
    await updateAdminDocument('reward_gifts', g.id, { productId: p.id, title: p.title, imageUrl: img, updatedAt: new Date().toISOString() });
    setGifts(x => x.map(q => q.id === g.id ? { ...q, productId: p.id, title: p.title, imageUrl: img } : q));
  }

  async function uploadGift(g: GiftReward, file: File) {
    setMessage('Uploading image...');
    try {
      const imageUrl = await uploadImageToImgBB(file);
      await updateAdminDocument('reward_gifts', g.id, { imageUrl, updatedAt: new Date().toISOString() });
      setMessage('Reward image uploaded.');
    } catch (e: any) {
      setMessage(e instanceof Error ? e.message : 'Upload failed.');
    }
  }

  async function uploadPrize(p: Prize, file: File) {
    setMessage('Uploading wheel image...');
    try {
      const imageUrl = await uploadImageToImgBB(file);
      setPrizes(x => x.map(q => q.id === p.id ? { ...q, imageUrl } : q));
      setMessage('Wheel image ready. Save Wheel to publish it.');
    } catch (e: any) {
      setMessage(e instanceof Error ? e.message : 'Upload failed.');
    }
  }

  async function uploadRewardImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMessage('Uploading reward images...');
    try {
      for (const file of Array.from(files)) {
        const url = await uploadImageToImgBB(file);
        await createAdminDocument('media_assets', { name: file.name, url, type: file.type, size: file.size, createdAt: new Date().toISOString() });
      }
      setMessage(`${files.length} reward image${files.length > 1 ? 's' : ''} added.`);
    } catch (e: any) {
      setMessage(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function saveMediaReward(asset: any) {
    const points = Number(mediaPoints[asset.id] || settings.pointPresets?.[0] || 100);
    const existing = gifts.find(g => g.mediaAssetId === asset.id);
    if (existing) {
      await updateAdminDocument('reward_gifts', existing.id, { pointsCost: points, updatedAt: new Date().toISOString() });
    } else {
      await createAdminDocument('reward_gifts', {
        title: asset.name || 'Reward Item',
        pointsCost: points,
        stock: 1,
        active: true,
        description: '',
        imageUrl: asset.url,
        mediaAssetId: asset.id,
        createdAt: new Date().toISOString()
      });
    }
    setMessage('Media reward updated.');
  }

  async function saveAllMediaRewards() {
    setSaving(true);
    try {
      for (const asset of mediaAssets) {
        await saveMediaReward(asset);
      }
      setMessage('All media rewards saved.');
    } catch (e: any) {
      setMessage(e instanceof Error ? e.message : 'Failed saving media rewards.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="rounded-[28px] bg-[#14140F] p-6 text-white">
        <p className="text-xs font-black uppercase tracking-wider text-[#E1352B]">Customer Loyalty & Gamification</p>
        <h2 className="mt-1 text-2xl font-black md:text-3xl">Rewards & Loyalty Hub</h2>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 rounded-2xl bg-[#E8E8E3] p-1.5 text-xs font-black">
        <button type="button" onClick={() => setTab('overview')} className={`rounded-xl px-4 py-2.5 transition ${tab === 'overview' ? 'bg-white text-black shadow-sm' : 'text-black/60'}`}>Overview</button>
        <button type="button" onClick={() => setTab('wheel')} className={`rounded-xl px-4 py-2.5 transition ${tab === 'wheel' ? 'bg-white text-black shadow-sm' : 'text-black/60'}`}>Spin Wheel</button>
        <button type="button" onClick={() => setTab('checkin')} className={`rounded-xl px-4 py-2.5 transition ${tab === 'checkin' ? 'bg-white text-black shadow-sm' : 'text-black/60'}`}>7-Day Check-in</button>
        <button type="button" onClick={() => setTab('store')} className={`rounded-xl px-4 py-2.5 transition ${tab === 'store' ? 'bg-white text-black shadow-sm' : 'text-black/60'}`}>Reward Store</button>
        <button type="button" onClick={() => setTab('redemptions')} className={`rounded-xl px-4 py-2.5 transition ${tab === 'redemptions' ? 'bg-white text-black shadow-sm' : 'text-black/60'}`}>History</button>
      </div>

      {message && <div className="mt-4 rounded-xl bg-white p-3 text-xs font-bold text-black shadow-sm">{message}</div>}

      {tab === 'overview' && (
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <Stat icon={<Trophy />} label="Active Rewards" value={String(gifts.filter(g => g.active).length)} />
          <Stat icon={<Gift />} label="Total Media Assets" value={String(mediaAssets.length)} />
          <Stat icon={<Disc />} label="Active Wheel Prizes" value={String(prizes.filter(p => p.active).length)} />
          <Stat icon={<Calendar />} label="Point Presets" value={settings.pointPresets?.join(', ') || '100, 200, 500'} />
        </div>
      )}

      {tab === 'store' && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#14140F] px-4 py-2.5 text-xs font-black text-white">
              <Upload size={14} />
              <span>{uploading ? 'Uploading...' : 'Upload Images'}</span>
              <input type="file" multiple accept="image/*" onChange={e => uploadRewardImages(e.target.files)} className="hidden" />
            </label>
            <button type="button" onClick={saveAllMediaRewards} disabled={saving} className="rounded-xl bg-[#E1352B] px-4 py-2.5 text-xs font-black text-white">
              {saving ? 'Saving...' : 'Save All Points'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {mediaAssets.map((asset) => (
              <div key={asset.id} className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                <select
                  value={mediaPoints[asset.id] || settings.pointPresets?.[0] || 100}
                  onChange={e => setMediaPoints(prev => ({ ...prev, [asset.id]: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-black/10 bg-[#F4F4F1] p-1.5 text-xs font-black outline-none"
                >
                  {(settings.pointPresets || [100, 200, 500]).map((pts: number) => (
                    <option key={pts} value={pts}>{pts} points</option>
                  ))}
                </select>
                <img src={asset.url} alt={asset.name || 'Reward'} className="mt-2 aspect-square w-full rounded-xl object-cover" />
                <button type="button" onClick={() => saveMediaReward(asset)} className="mt-2 w-full rounded-lg bg-[#14140F] py-1.5 text-[11px] font-black text-white">
                  Save Reward
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="h-5 w-5 text-[#E1352B]">{icon}</div>
      <p className="mt-3 text-[9px] font-black uppercase tracking-wider text-black/40">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[9px] font-black uppercase tracking-wide text-black/45">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-xl border border-black/10 bg-[#F4F4F1] px-3 py-2 text-xs font-black outline-none"
      />
    </label>
  );
}
