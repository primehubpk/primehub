'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import {
  CalendarCheck,
  Check,
  Disc3,
  Gift,
  History,
  ImagePlus,
  Percent,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  adminCollection,
  createAdminDocument,
  deleteAdminDocument,
  setAdminDocument,
  updateAdminDocument,
  uploadImageToImgBB,
} from './shared';

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

type PrizeType = 'product' | 'points' | 'free-delivery' | 'coupon' | 'try-again';

interface Prize {
  id: string;
  name: string;
  type: PrizeType;
  points: number;
  probability: number;
  active: boolean;
  stock: number;
  imageUrl?: string;
  productId?: string;
  voucherCode?: string;
  voucherAmount?: number;
}

interface Redemption {
  id: string;
  userId?: string;
  giftId?: string;
  wheelWinId?: string;
  rewardType?: string;
  rewardName?: string;
  productId?: string;
  pointsCost?: number;
  voucherCode?: string;
  voucherAmount?: number;
  status?: string;
  createdAt?: unknown;
}

const DEFAULT_CHECKIN = [10, 15, 20, 25, 30, 50, 100];

const DEFAULT_SETTINGS = {
  pointPresets: [100, 200, 500],
  dailySpinLimit: 1,
  guestMode: true,
  loginRequiredToRedeem: true,
  pointsExpiryDays: 0,
  checkInRewards: DEFAULT_CHECKIN,
  spinWheelSlots: [] as Prize[],
};

function makePrize(): Prize {
  return {
    id: crypto.randomUUID(),
    name: 'Try Again',
    type: 'try-again',
    points: 0,
    probability: 20,
    active: true,
    stock: 999,
  };
}

function prizeTypeLabel(type: PrizeType) {
  if (type === 'product') return 'FREE PRODUCT';
  if (type === 'points') return 'POINTS';
  if (type === 'free-delivery') return 'FREE DELIVERY';
  if (type === 'coupon') return 'VOUCHER';
  return 'TRY AGAIN';
}

function prizeSummary(prize: Prize) {
  if (prize.type === 'points') return `+${Number(prize.points || 0)} points`;
  if (prize.type === 'free-delivery') return prize.voucherAmount ? `Free delivery up to Rs ${Number(prize.voucherAmount).toLocaleString()}` : 'Free delivery voucher';
  if (prize.type === 'coupon') return prize.voucherAmount ? `${prize.voucherCode || 'Auto voucher'} • Rs ${Number(prize.voucherAmount).toLocaleString()}` : (prize.voucherCode || 'Auto voucher');
  if (prize.type === 'product') return prize.productId ? 'Linked product reward' : 'Select a product';
  return 'No reward — try again next time';
}

function sliceClipPath(index: number, count: number) {
  const n = Math.max(1, count);
  const start = (index / n) * 2 * Math.PI - Math.PI / 2;
  const end = ((index + 1) / n) * 2 * Math.PI - Math.PI / 2;
  const points = ['50% 50%'];
  for (let i = 0; i <= 18; i += 1) {
    const angle = start + ((end - start) * i) / 18;
    points.push(`${50 + 50 * Math.cos(angle)}% ${50 + 50 * Math.sin(angle)}%`);
  }
  return `polygon(${points.join(',')})`;
}

export default function RewardsManager({ products = [] }: { products?: any[] }) {
  const [tab, setTab] = useState<'overview' | 'wheel' | 'checkin' | 'store' | 'redemptions'>('overview');
  const [settings, setSettings] = useState<any>(DEFAULT_SETTINGS);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [gifts, setGifts] = useState<GiftReward[]>([]);
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [mediaPoints, setMediaPoints] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => onSnapshot(adminCollection('reward_gifts'), (s) => {
    setGifts(s.docs.map(d => ({ id: d.id, ...d.data() } as GiftReward)));
  }), []);

  useEffect(() => onSnapshot(adminCollection('media_assets'), (s) => {
    setMediaAssets(s.docs.map(d => ({ id: d.id, ...d.data() })));
  }), []);

  useEffect(() => onSnapshot(adminCollection('reward_redemptions'), (s) => {
    const rows = s.docs.map(d => ({ id: d.id, ...d.data() } as Redemption));
    rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    setRedemptions(rows);
  }), []);

  useEffect(() => onSnapshot(adminCollection('settings'), (s) => {
    const data: any = s.docs.find(x => x.id === 'rewards')?.data();
    if (data) {
      const merged = { ...DEFAULT_SETTINGS, ...data };
      setSettings(merged);
      setPrizes(Array.isArray(merged.spinWheelSlots) ? merged.spinWheelSlots : []);
    }
  }), []);

  const activePrizes = useMemo(() => prizes.filter(p => p.active), [prizes]);
  const probabilityTotal = useMemo(() => activePrizes.reduce((sum, p) => sum + Math.max(0, Number(p.probability || 0)), 0), [activePrizes]);
  const activeGifts = gifts.filter(g => g.active);
  const pendingRedemptions = redemptions.filter(r => r.status === 'pending').length;

  async function saveSettings(nextSettings: any = settings, nextPrizes: Prize[] = prizes, success = 'Rewards settings saved.') {
    setSaving(true);
    setMessage('');
    try {
      await setAdminDocument('settings', 'rewards', {
        ...nextSettings,
        checkInRewards: (nextSettings.checkInRewards || DEFAULT_CHECKIN).slice(0, 7).map((value: any) => Math.max(0, Number(value || 0))),
        spinWheelSlots: nextPrizes,
        updatedAt: new Date().toISOString(),
      });
      setSettings({ ...nextSettings, spinWheelSlots: nextPrizes });
      setPrizes(nextPrizes);
      setMessage(success);
    } catch (e: any) {
      setMessage(e?.message || 'Could not save rewards settings.');
    } finally {
      setSaving(false);
    }
  }

  async function saveWheel() {
    if (!activePrizes.length) {
      setMessage('Add at least one active wheel prize.');
      setTab('wheel');
      return;
    }
    if (probabilityTotal <= 0) {
      setMessage('Active wheel prizes need a probability greater than 0.');
      setTab('wheel');
      return;
    }
    const invalidProduct = activePrizes.some(p => p.type === 'product' && !p.productId);
    if (invalidProduct) {
      setMessage('Select a product for every FREE PRODUCT prize.');
      setTab('wheel');
      return;
    }
    await saveSettings(settings, prizes, 'Spin Wheel saved successfully.');
  }

  function addPrize() {
    setPrizes(current => [...current, makePrize()]);
    setTab('wheel');
  }

  function updatePrize(id: string, patch: Partial<Prize>) {
    setPrizes(current => current.map(prize => prize.id === id ? { ...prize, ...patch } : prize));
  }

  function removePrize(id: string) {
    setPrizes(current => current.filter(prize => prize.id !== id));
  }

  async function uploadPrize(prize: Prize, file: File) {
    setMessage('Uploading wheel image...');
    try {
      const imageUrl = await uploadImageToImgBB(file);
      updatePrize(prize.id, { imageUrl });
      setMessage('Wheel image uploaded. Save Spin Wheel to publish it.');
    } catch (e: any) {
      setMessage(e instanceof Error ? e.message : 'Image upload failed.');
    }
  }

  async function saveCheckIn() {
    const rewards = Array.from({ length: 7 }, (_, index) => Math.max(0, Number(settings.checkInRewards?.[index] ?? 0)));
    await saveSettings({ ...settings, checkInRewards: rewards }, prizes, '7-Day Check-in points saved.');
  }

  async function addGift() {
    try {
      await createAdminDocument('reward_gifts', {
        title: 'New Reward',
        productId: '',
        pointsCost: Number(settings.pointPresets?.[0] || 100),
        stock: 1,
        active: true,
        description: '',
        imageUrl: '',
        createdAt: new Date().toISOString(),
      });
      setMessage('Reward gift added.');
    } catch (e: any) {
      setMessage(e?.message || 'Could not add reward.');
    }
  }

  async function saveGift(gift: GiftReward) {
    const { id, ...data } = gift;
    try {
      await updateAdminDocument('reward_gifts', id, { ...data, updatedAt: new Date().toISOString() });
      setMessage('Reward gift saved.');
    } catch (e: any) {
      setMessage(e?.message || 'Could not save reward.');
    }
  }

  async function removeGift(id: string) {
    if (!window.confirm('Remove this reward from the Reward Store?')) return;
    try {
      await deleteAdminDocument('reward_gifts', id);
      setMessage('Reward removed.');
    } catch (e: any) {
      setMessage(e?.message || 'Could not remove reward.');
    }
  }

  async function selectProduct(gift: GiftReward, productId: string) {
    const product = products.find(x => x.id === productId);
    if (!product) return;
    const imageUrl = typeof product.imageUrl === 'string' && product.imageUrl
      ? product.imageUrl
      : typeof product.images?.[0] === 'string'
        ? product.images[0]
        : (product.images?.[0] as any)?.url || '';
    await updateAdminDocument('reward_gifts', gift.id, {
      productId: product.id,
      title: product.title,
      imageUrl,
      updatedAt: new Date().toISOString(),
    });
    setGifts(current => current.map(item => item.id === gift.id ? { ...item, productId: product.id, title: product.title, imageUrl } : item));
  }

  async function uploadGift(gift: GiftReward, file: File) {
    setMessage('Uploading reward image...');
    try {
      const imageUrl = await uploadImageToImgBB(file);
      await updateAdminDocument('reward_gifts', gift.id, { imageUrl, updatedAt: new Date().toISOString() });
      setGifts(current => current.map(item => item.id === gift.id ? { ...item, imageUrl } : item));
      setMessage('Reward image saved.');
    } catch (e: any) {
      setMessage(e instanceof Error ? e.message : 'Image upload failed.');
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
    try {
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
          createdAt: new Date().toISOString(),
        });
      }
      setMessage('Media reward updated.');
    } catch (e: any) {
      setMessage(e?.message || 'Could not save media reward.');
    }
  }

  async function saveAllMediaRewards() {
    setSaving(true);
    try {
      for (const asset of mediaAssets) await saveMediaReward(asset);
      setMessage('All media rewards saved.');
    } catch (e: any) {
      setMessage(e?.message || 'Failed saving media rewards.');
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'wheel', label: 'Spin Wheel', icon: Disc3 },
    { id: 'checkin', label: '7-Day Check-in', icon: CalendarCheck },
    { id: 'store', label: 'Reward Store', icon: Gift },
    { id: 'redemptions', label: 'History', icon: History },
  ] as const;

  return (
    <section className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7">
      <div className="overflow-hidden rounded-[30px] bg-[#14140F] text-white shadow-xl">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <div className="flex items-center gap-2 text-[#FFB020]"><Sparkles size={17} /><span className="text-[10px] font-black uppercase tracking-[.22em]">Customer Loyalty & Gamification</span></div>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Rewards & Loyalty Hub</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Build a premium Daraz-style reward experience without touching the existing admin authentication, products, cart, or order flow.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-white/70"><span className="text-white">{activePrizes.length}</span> active wheel prizes · <span className="text-white">{pendingRedemptions}</span> pending claims</div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl bg-[#E8E8E3] p-1.5">
        <div className="flex min-w-max gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${tab === id ? 'bg-white text-black shadow-sm' : 'text-black/55 hover:text-black'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      {message && <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[#0F6A5F]/10 bg-[#E8F5F2] p-3 text-xs font-black text-[#0F6A5F]"><Check size={15} className="mt-0.5 shrink-0" />{message}</div>}

      {tab === 'overview' && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<Trophy />} label="Active Rewards" value={String(activeGifts.length)} hint="Reward Store" />
          <Stat icon={<Disc3 />} label="Wheel Prizes" value={String(activePrizes.length)} hint={probabilityTotal ? `${probabilityTotal}% probability weight` : 'Not configured'} />
          <Stat icon={<CalendarCheck />} label="7-Day Points" value={(settings.checkInRewards || DEFAULT_CHECKIN).join(' · ')} hint="Admin controlled" />
          <Stat icon={<Users />} label="Pending Claims" value={String(pendingRedemptions)} hint="Needs fulfilment" />
        </div>
      )}

      {tab === 'wheel' && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
            <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Spin configuration</p><h3 className="mt-1 text-xl font-black">Prize slots</h3><p className="mt-1 text-xs leading-5 text-black/45">Every slot can have its own image, value and winning probability. Higher probability = more common.</p></div>
                <button type="button" onClick={addPrize} className="inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-4 py-2.5 text-xs font-black text-white"><Plus size={14} /> Add Prize</button>
              </div>

              <div className="mt-5 space-y-3">
                {prizes.map((prize, index) => (
                  <PrizeEditor key={prize.id} prize={prize} index={index} products={products} onChange={patch => updatePrize(prize.id, patch)} onRemove={() => removePrize(prize.id)} onUpload={file => uploadPrize(prize, file)} />
                ))}
                {!prizes.length && <EmptyState title="No wheel prizes yet" text="Add the first image-based reward slot to build your wheel." action="Add Prize" onAction={addPrize} />}
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[#F7F7F2] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-xs font-black">Probability weight: {probabilityTotal}%</p><p className="mt-1 text-[10px] text-black/45">Weights do not need to equal 100. They are normalized automatically.</p></div>
                <button type="button" onClick={saveWheel} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E1352B] px-5 py-3 text-xs font-black text-white disabled:opacity-50"><Save size={14} />{saving ? 'Saving...' : 'Save Spin Wheel'}</button>
              </div>
            </div>

            <WheelPreview prizes={activePrizes} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MiniSetting title="Guest earning" text="Guests can spin and collect rewards on this device." enabled={settings.guestMode !== false} onChange={value => setSettings((s: any) => ({ ...s, guestMode: value }))} />
            <MiniSetting title="Login to redeem" text="Keep redemption locked until the customer signs in." enabled={settings.loginRequiredToRedeem !== false} onChange={value => setSettings((s: any) => ({ ...s, loginRequiredToRedeem: value }))} />
            <MiniSetting title="Daily spin" text="One spin per day, matching the simple daily reward model." enabled={true} onChange={() => undefined} locked />
          </div>
        </div>
      )}

      {tab === 'checkin' && (
        <div className="mt-5 rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Daily loyalty</p><h3 className="mt-1 text-xl font-black">7-Day Streak Rewards</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-black/45">Enter the exact points customers should receive for each consecutive check-in day.</p></div><button type="button" onClick={saveCheckIn} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white disabled:opacity-50"><Save size={14} />{saving ? 'Saving...' : 'Save 7-Day Points'}</button></div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 7 }, (_, index) => <div key={index} className="rounded-2xl border border-black/5 bg-[#F7F7F2] p-3"><div className="flex items-center justify-between"><span className="text-[9px] font-black uppercase tracking-wider text-black/45">Day {index + 1}</span><span className="rounded-full bg-white px-2 py-1 text-[8px] font-black">+PTS</span></div><input type="number" min="0" value={Number(settings.checkInRewards?.[index] ?? 0)} onChange={e => setSettings((s: any) => ({ ...s, checkInRewards: s.checkInRewards.map((value: number, i: number) => i === index ? Number(e.target.value) : value) }))} className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-center text-lg font-black outline-none focus:border-[#E1352B]" /></div>)}
          </div>
          <div className="mt-5 rounded-2xl bg-[#FFF6E5] p-4 text-xs leading-5 text-black/60"><span className="font-black text-black">Tip:</span> Keep the final day meaningfully higher so customers have a reason to complete the full streak.</div>
        </div>
      )}

      {tab === 'store' && (
        <div className="mt-5 space-y-5">
          <div className="flex flex-col gap-3 rounded-[24px] border border-black/5 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-black">Reward Store</h3><p className="mt-1 text-xs text-black/45">Products customers can redeem with points. Delivery remains FREE on successful redemption.</p></div><button type="button" onClick={addGift} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14140F] px-4 py-3 text-xs font-black text-white"><Plus size={14} /> Add Reward</button></div>

          <div className="grid gap-4 lg:grid-cols-2">
            {gifts.map(gift => <GiftEditor key={gift.id} gift={gift} products={products} onSave={() => saveGift(gift)} onRemove={() => removeGift(gift.id)} onProduct={productId => selectProduct(gift, productId)} onUpload={file => uploadGift(gift, file)} onChange={patch => setGifts(current => current.map(item => item.id === gift.id ? { ...item, ...patch } : item))} />)}
            {!gifts.length && <EmptyState title="No store rewards" text="Add a reward product or use the image library below." action="Add Reward" onAction={addGift} />}
          </div>

          <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Image library</p><h3 className="mt-1 text-lg font-black">Upload reward images</h3></div><div className="flex gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#14140F] px-4 py-2.5 text-xs font-black text-white"><Upload size={14} />{uploading ? 'Uploading...' : 'Upload Images'}<input type="file" multiple accept="image/*" onChange={e => uploadRewardImages(e.target.files)} className="hidden" /></label><button type="button" onClick={saveAllMediaRewards} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#E1352B] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Save size={14} /> Save All Points</button></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{mediaAssets.map(asset => <div key={asset.id} className="rounded-2xl border border-black/5 bg-[#FAFAF7] p-3"><select value={mediaPoints[asset.id] || settings.pointPresets?.[0] || 100} onChange={e => setMediaPoints(current => ({ ...current, [asset.id]: Number(e.target.value) }))} className="w-full rounded-lg border border-black/10 bg-white p-2 text-xs font-black outline-none">{(settings.pointPresets || [100, 200, 500]).map((pts: number) => <option key={pts} value={pts}>{pts} points</option>)}</select><img src={asset.url} alt={asset.name || 'Reward'} className="mt-2 aspect-square w-full rounded-xl object-cover" /><button type="button" onClick={() => saveMediaReward(asset)} className="mt-2 w-full rounded-lg bg-[#14140F] py-2 text-[10px] font-black text-white">Save Reward</button></div>)}</div></div>
        </div>
      )}

      {tab === 'redemptions' && (
        <div className="mt-5 rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6"><div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Fulfilment queue</p><h3 className="mt-1 text-xl font-black">Reward History</h3><p className="mt-1 text-xs text-black/45">Wheel wins and point redemptions appear here for admin processing.</p></div><span className="rounded-full bg-[#FFF1D6] px-3 py-1.5 text-[10px] font-black">{pendingRedemptions} pending</span></div><div className="mt-5 space-y-2">{redemptions.map(item => <div key={item.id} className="grid gap-3 rounded-2xl bg-[#F7F7F2] p-4 md:grid-cols-[1.2fr_1fr_auto]"><div><p className="text-xs font-black">{item.rewardName || item.giftId || 'Reward claim'}</p><p className="mt-1 text-[10px] text-black/45">Customer: {item.userId || 'Unknown'}</p></div><div><p className="text-[10px] font-bold text-black/55">{item.rewardType || 'points reward'} {item.pointsCost ? `• ${item.pointsCost} points` : '• FREE'}</p><p className="mt-1 text-[9px] text-black/40">{item.voucherCode || (item.voucherAmount ? `Voucher Rs ${item.voucherAmount}` : item.productId ? `Product ${item.productId}` : 'No voucher')}</p></div><span className={`h-fit rounded-full px-2.5 py-1 text-[9px] font-black ${item.status === 'pending' ? 'bg-[#FFF1D6] text-black' : 'bg-[#E8F5F2] text-[#0F6A5F]'}`}>{item.status || 'pending'}</span></div>)}{!redemptions.length && <div className="rounded-2xl bg-[#F7F7F2] p-8 text-center text-xs font-bold text-black/45">No reward claims yet.</div>}</div></div>
      )}
    </section>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return <div className="rounded-[24px] bg-white p-5 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1D6] text-[#E1352B]">{icon}</div><p className="mt-4 text-[9px] font-black uppercase tracking-[.18em] text-black/40">{label}</p><p className="mt-1 break-words text-xl font-black">{value}</p><p className="mt-1 text-[10px] font-bold text-black/35">{hint}</p></div>;
}

function MiniSetting({ title, text, enabled, onChange, locked = false }: { title: string; text: string; enabled: boolean; onChange: (value: boolean) => void; locked?: boolean }) {
  return <div className="flex items-start justify-between gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm"><div><p className="text-xs font-black">{title}</p><p className="mt-1 text-[10px] leading-4 text-black/45">{text}</p></div><button type="button" disabled={locked} onClick={() => onChange(!enabled)} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full p-1 transition ${enabled ? 'bg-[#0F6A5F]' : 'bg-black/15'} ${locked ? 'opacity-50' : ''}`} aria-label={`${title} ${enabled ? 'enabled' : 'disabled'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${enabled ? 'translate-x-5' : ''}`} /></button></div>;
}

function PrizeEditor({ prize, index, products, onChange, onRemove, onUpload }: { prize: Prize; index: number; products: any[]; onChange: (patch: Partial<Prize>) => void; onRemove: () => void; onUpload: (file: File) => void }) {
  return <article className="rounded-2xl border border-black/5 bg-[#FAFAF7] p-4"><div className="flex items-start gap-3"><div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm">{prize.imageUrl ? <img src={prize.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-black/20"><ImagePlus size={20} /></div>}<label className="absolute inset-x-1 bottom-1 flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-black/70 py-1 text-[8px] font-black text-white"><Upload size={10} /> Image<input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) onUpload(file); }} /></label></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-wider text-black/35">Slot {index + 1}</p><input value={prize.name} onChange={e => onChange({ name: e.target.value })} className="mt-1 w-full min-w-0 bg-transparent text-sm font-black outline-none" placeholder="Reward name" /></div><button type="button" onClick={onRemove} aria-label="Remove prize" className="rounded-lg p-1.5 text-black/30 hover:bg-black/5 hover:text-[#E1352B]"><Trash2 size={15} /></button></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><label className="block"><span className="label">Type</span><select value={prize.type} onChange={e => onChange({ type: e.target.value as PrizeType })} className="input"><option value="product">FREE PRODUCT</option><option value="free-delivery">FREE DELIVERY</option><option value="points">POINTS</option><option value="coupon">VOUCHER</option><option value="try-again">TRY AGAIN</option></select></label><label className="block"><span className="label">Probability</span><div className="relative"><input type="number" min="0" value={Number(prize.probability || 0)} onChange={e => onChange({ probability: Number(e.target.value) })} className="input pr-8" /><Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/25" /></div></label><label className="block"><span className="label">Stock</span><input type="number" min="0" value={Number(prize.stock ?? 999)} onChange={e => onChange({ stock: Number(e.target.value) })} className="input" /></label></div></div></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{prize.type === 'points' && <label><span className="label">Points awarded</span><input type="number" min="0" max="100" value={Number(prize.points || 0)} onChange={e => onChange({ points: Number(e.target.value) })} className="input" /></label>}{prize.type === 'product' && <label><span className="label">Product reward</span><select value={prize.productId || ''} onChange={e => { const product = products.find(x => x.id === e.target.value); onChange({ productId: e.target.value, name: prize.name || product?.title || 'Free Product' }); }} className="input"><option value="">Select product</option>{products.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label>}{(prize.type === 'free-delivery' || prize.type === 'coupon') && <><label><span className="label">Voucher amount (Rs)</span><input type="number" min="0" value={Number(prize.voucherAmount || 0)} onChange={e => onChange({ voucherAmount: Number(e.target.value) })} className="input" /></label><label><span className="label">Voucher code (optional)</span><input value={prize.voucherCode || ''} onChange={e => onChange({ voucherCode: e.target.value.toUpperCase() })} className="input" placeholder="AUTO = unique code" /></label></>}{prize.type === 'try-again' && <div className="rounded-xl bg-white p-3 text-[10px] font-bold text-black/45">No points are awarded. The customer can spin again on the next eligible day.</div>}<label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[10px] font-black"><input type="checkbox" checked={prize.active !== false} onChange={e => onChange({ active: e.target.checked })} /> Active on customer wheel</label></div><p className="mt-3 rounded-xl bg-white px-3 py-2 text-[10px] font-bold text-black/45">{prizeTypeLabel(prize.type)} · {prizeSummary(prize)}</p></article>;
}

function GiftEditor({ gift, products, onSave, onRemove, onProduct, onUpload, onChange }: { gift: GiftReward; products: any[]; onSave: () => void; onRemove: () => void; onProduct: (id: string) => void; onUpload: (file: File) => void; onChange: (patch: Partial<GiftReward>) => void }) {
  return <article className="rounded-[24px] border border-black/5 bg-white p-4 shadow-sm"><div className="flex gap-3"><div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#F4F4F1]">{gift.imageUrl ? <img src={gift.imageUrl} alt={gift.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-black/20"><ImagePlus /></div>}<label className="absolute inset-x-1 bottom-1 flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-black/70 py-1.5 text-[8px] font-black text-white"><Upload size={10} /> Change<input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) onUpload(file); }} /></label></div><div className="min-w-0 flex-1"><input value={gift.title} onChange={e => onChange({ title: e.target.value })} className="w-full bg-transparent text-sm font-black outline-none" placeholder="Reward title" /><p className="mt-1 text-[10px] text-black/40">Customers redeem this from the points store.</p><select value={gift.productId || ''} onChange={e => onProduct(e.target.value)} className="mt-3 w-full rounded-xl border border-black/10 bg-[#F7F7F2] px-3 py-2.5 text-[11px] font-bold outline-none"><option value="">Optional linked product</option>{products.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}</select></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><label><span className="label">Points</span><input type="number" min="1" value={Number(gift.pointsCost || 0)} onChange={e => onChange({ pointsCost: Number(e.target.value) })} className="input" /></label><label><span className="label">Stock</span><input type="number" min="0" value={Number(gift.stock ?? 1)} onChange={e => onChange({ stock: Number(e.target.value) })} className="input" /></label><label className="col-span-2 flex items-end gap-2 rounded-xl bg-[#F7F7F2] px-3 py-2.5 text-[10px] font-black"><input type="checkbox" checked={gift.active !== false} onChange={e => onChange({ active: e.target.checked })} /> Active in customer Reward Store</label></div><div className="mt-3 flex gap-2"><button type="button" onClick={onSave} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#14140F] py-2.5 text-[10px] font-black text-white"><Save size={13} /> Save Reward</button><button type="button" onClick={onRemove} className="rounded-xl border border-black/10 px-3 text-black/40 hover:text-[#E1352B]" aria-label="Delete reward"><Trash2 size={14} /></button></div></article>;
}

function WheelPreview({ prizes }: { prizes: Prize[] }) {
  const count = Math.max(1, prizes.length);
  const slice = 360 / count;
  return (
    <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Live preview</p>
          <h3 className="mt-1 text-xl font-black">Customer wheel</h3>
        </div>
        <span className="rounded-full bg-[#FFF1D6] px-2.5 py-1 text-[9px] font-black">{prizes.length} slots</span>
      </div>
      <div className="relative mx-auto mt-7 h-64 w-64 max-w-full">
        <div className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 text-[#E1352B]">▼</div>
        <div className="absolute inset-0 rounded-full border-[9px] border-[#14140F] bg-white p-3 shadow-xl">
          <div className="relative h-full w-full overflow-hidden rounded-full bg-[#F4F4F1]">
            {prizes.map((prize, index) => (
              <div key={`${prize.id}-bg`} className="absolute inset-0" style={{ clipPath: sliceClipPath(index, count), background: index % 2 ? '#FFF1D6' : '#F4F4F1' }} />
            ))}
            {prizes.map((prize, index) => {
              const size = Math.max(52, Math.min(88, Math.floor(200 / Math.max(3, prizes.length))));
              return (
                <div key={prize.id} className="pointer-events-none absolute left-1/2 top-1/2 h-[48%] w-[48%] origin-bottom text-center" style={{ transform: `translate(-50%, -100%) rotate(${index * slice + slice / 2}deg)` }}>
                  <div className="mx-auto mt-1 overflow-hidden rounded-xl border-2 border-white bg-white shadow-sm" style={{ width: size, height: size }}>
                    {prize.imageUrl
                      ? <img src={prize.imageUrl} alt={prize.name} className="h-full w-full object-contain" />
                      : <div className="flex h-full items-center justify-center text-[8px] font-black">{prizeTypeLabel(prize.type)}</div>}
                  </div>
                  <span className="mt-1 inline-block max-w-full truncate rounded-full bg-black/65 px-1 py-0.5 text-[7px] font-black text-white">{prizeTypeLabel(prize.type)}</span>
                </div>
              );
            })}
            <div className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-[#E1352B] text-white shadow-lg"><Sparkles size={19} /></div>
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {prizes.slice(0, 6).map((prize) => (
          <div key={prize.id} className="flex items-center gap-2 rounded-xl bg-[#F7F7F2] p-2.5">
            <div className="h-8 w-8 overflow-hidden rounded-lg bg-white">{prize.imageUrl && <img src={prize.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-black">{prize.name}</p>
              <p className="text-[9px] text-black/40">{prizeSummary(prize)}</p>
            </div>
            <span className="text-[9px] font-black text-[#E1352B]">{prize.probability}%</span>
          </div>
        ))}
        {!prizes.length && <p className="rounded-xl bg-[#F7F7F2] p-4 text-center text-xs font-bold text-black/45">Add prizes to preview the wheel.</p>}
      </div>
    </div>
  );
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="rounded-[24px] border border-dashed border-black/10 bg-white p-8 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1D6] text-[#E1352B]"><Gift size={21} /></div><h4 className="mt-3 text-sm font-black">{title}</h4><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-black/45">{text}</p><button type="button" onClick={onAction} className="mt-4 rounded-xl bg-[#14140F] px-4 py-2.5 text-xs font-black text-white">{action}</button></div>;
}
