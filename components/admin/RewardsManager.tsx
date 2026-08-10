'use client';

// ==================== REWARDS MANAGEMENT ====================
import { FormEvent, useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { Gift, Loader2, Plus, Sparkles, Trash2, Upload, X } from 'lucide-react';
import {
  adminCollection,
  createAdminDocument,
  deleteAdminDocument,
  getAdminDocument,
  setAdminDocument,
  type UserReward,
  uploadImageToImgBB,
} from './shared';

type ActiveTab = 'gifts' | 'wheel' | 'wallets';
type PrizeType = 'points' | 'coupon' | 'try-again';
type GiftReward = { id: string; title: string; imageUrl?: string; pointsCost: number; stock: number };
type WheelSlot = { id: number; name: string; type: PrizeType; value: string; probability: string };

const EMPTY_GIFT = { title: '', imageUrl: '', pointsCost: '', stock: '' };
const DEFAULT_WHEEL_SLOTS: WheelSlot[] = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, name: '', type: 'points', value: '', probability: '12.5' }));

function couponCode() {
  return `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export default function RewardsManager() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('gifts');
  const [gifts, setGifts] = useState<GiftReward[]>([]);
  const [wallets, setWallets] = useState<UserReward[]>([]);
  const [giftForm, setGiftForm] = useState(EMPTY_GIFT);
  const [wheelSlots, setWheelSlots] = useState<WheelSlot[]>(DEFAULT_WHEEL_SLOTS);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingGift, setIsSavingGift] = useState(false);
  const [isSavingWheel, setIsSavingWheel] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<UserReward | null>(null);
  const [bonusPoints, setBonusPoints] = useState('');
  const [promoCode, setPromoCode] = useState(couponCode());
  const [isSavingWallet, setIsSavingWallet] = useState(false);

  // ==================== REWARDS DATA LISTENERS ====================
  useEffect(() => onSnapshot(adminCollection('reward_gifts'), (snapshot) => {
    setGifts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as GiftReward));
  }), []);

  useEffect(() => onSnapshot(adminCollection('user_rewards'), (snapshot) => {
    setWallets(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as UserReward));
  }), []);

  useEffect(() => {
    async function loadWheel() {
      const snapshot = await getAdminDocument('settings', 'rewards');
      const savedSlots = snapshot.data()?.spinWheelSlots;
      if (Array.isArray(savedSlots) && savedSlots.length === 8) {
        setWheelSlots(savedSlots.map((slot, index) => ({
          id: index + 1,
          name: String(slot?.name || ''),
          type: ['points', 'coupon', 'try-again'].includes(String(slot?.type)) ? slot.type as PrizeType : 'points',
          value: String(slot?.value || ''),
          probability: String(slot?.probability || ''),
        })));
      }
    }
    loadWheel();
  }, []);

  // ==================== GIFT CATALOG ACTIONS ====================
  async function uploadGiftImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const imageUrl = await uploadImageToImgBB(file);
      setGiftForm((current) => ({ ...current, imageUrl }));
    } finally {
      setIsUploading(false);
    }
  }

  async function createGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingGift(true);
    try {
      await createAdminDocument('reward_gifts', {
        title: giftForm.title.trim(),
        imageUrl: giftForm.imageUrl,
        pointsCost: Number(giftForm.pointsCost),
        stock: Number(giftForm.stock),
      });
      setGiftForm(EMPTY_GIFT);
    } finally {
      setIsSavingGift(false);
    }
  }

  // ==================== SPIN WHEEL CONFIGURATION ====================
  function updateWheelSlot(id: number, key: keyof WheelSlot, value: string) {
    setWheelSlots((slots) => slots.map((slot) => slot.id === id ? { ...slot, [key]: value } : slot));
  }

  async function saveWheel() {
    setIsSavingWheel(true);
    try {
      await setAdminDocument('settings', 'rewards', { spinWheelSlots: wheelSlots });
    } finally {
      setIsSavingWheel(false);
    }
  }

  // ==================== USER WALLET AND COUPON ACTIONS ====================
  function openWalletModal(wallet: UserReward) {
    setSelectedWallet(wallet);
    setBonusPoints('');
    setPromoCode(couponCode());
  }

  async function saveWalletAdjustments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWallet) return;
    const pointsToAdd = Number(bonusPoints || 0);
    const code = promoCode.trim().toUpperCase();
    const coupons = [...(selectedWallet.coupons || []), ...(code ? [code] : [])];
    setIsSavingWallet(true);
    try {
      await setAdminDocument('user_rewards', selectedWallet.id, {
        points: Math.max(0, Number(selectedWallet.points || 0) + pointsToAdd),
        coupons,
      });
      if (code) {
        await setAdminDocument('promo_coupons', code, {
          code,
          userId: selectedWallet.id,
          createdAt: new Date().toISOString(),
          active: true,
        });
      }
      setSelectedWallet(null);
    } finally {
      setIsSavingWallet(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#E1352B]">Customer loyalty</p>
      <h2 className="mt-1 text-2xl font-black">Rewards Manager</h2>

      {/* ==================== REWARDS SUB-TAB NAVIGATION ==================== */}
      <div className="mt-5 flex flex-wrap gap-2">
        {([['gifts', 'Gifts Catalog'], ['wheel', 'Spin Wheel Config'], ['wallets', 'User Wallets & Coupons']] as const).map(([tab, label]) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-full px-4 py-2 text-xs font-black ${activeTab === tab ? 'bg-[#14140F] text-white' : 'bg-white text-black/60 shadow-sm'}`}>{label}</button>)}
      </div>

      {/* ==================== GIFTS CATALOG ==================== */}
      {activeTab === 'gifts' && <div className="mt-5"><form onSubmit={createGift} className="grid gap-3 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-2"><input required value={giftForm.title} onChange={(event) => setGiftForm((current) => ({ ...current, title: event.target.value }))} placeholder="Gift Title" className="rounded-xl bg-[#F4F4F1] p-3 text-sm outline-none" /><div className="flex items-center gap-3"><label className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold"><Upload size={15}/><input type="file" accept="image/*" onChange={uploadGiftImage} className="hidden" />{isUploading ? 'Uploading...' : 'Upload ImgBB Photo'}</label>{giftForm.imageUrl && <img src={giftForm.imageUrl} alt="Gift preview" className="h-10 w-10 rounded-lg object-cover" />}</div><input required min="0" type="number" value={giftForm.pointsCost} onChange={(event) => setGiftForm((current) => ({ ...current, pointsCost: event.target.value }))} placeholder="Required Points cost" className="rounded-xl bg-[#F4F4F1] p-3 text-sm outline-none" /><input required min="0" type="number" value={giftForm.stock} onChange={(event) => setGiftForm((current) => ({ ...current, stock: event.target.value }))} placeholder="Stock" className="rounded-xl bg-[#F4F4F1] p-3 text-sm outline-none" /><button disabled={isSavingGift || isUploading} className="flex items-center justify-center gap-2 rounded-xl bg-[#14140F] py-3 text-xs font-black text-white disabled:opacity-50 md:col-span-2">{isSavingGift ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15}/>} Add Redeemable Gift</button></form><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{gifts.map((gift) => <article key={gift.id} className="rounded-2xl bg-white p-3 shadow-sm">{gift.imageUrl ? <img src={gift.imageUrl} alt={gift.title} className="h-32 w-full rounded-xl object-cover" /> : <div className="flex h-32 items-center justify-center rounded-xl bg-[#F4F4F1]"><Gift className="text-black/25"/></div>}<div className="mt-3 flex items-start justify-between gap-2"><div><p className="font-black">{gift.title}</p><p className="mt-1 text-xs text-black/55">{gift.pointsCost} points · Stock {gift.stock}</p></div><button type="button" onClick={() => confirm(`Delete ${gift.title}?`) && deleteAdminDocument('reward_gifts', gift.id)} className="rounded-lg bg-red-50 p-2 text-[#E1352B]"><Trash2 size={15}/></button></div></article>)}{gifts.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-sm text-black/45 sm:col-span-2 lg:col-span-3">No redeemable gifts yet.</p>}</div></div>}

      {/* ==================== SPIN WHEEL PRIZE SLOTS ==================== */}
      {activeTab === 'wheel' && <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-black">Eight prize slots</h3><p className="mt-1 text-xs text-black/50">Set each prize and its relative probability weightage.</p></div><button type="button" disabled={isSavingWheel} onClick={saveWheel} className="rounded-xl bg-[#14140F] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{isSavingWheel ? 'Saving...' : 'Save Wheel'}</button></div><div className="mt-5 grid gap-3 md:grid-cols-2">{wheelSlots.map((slot) => <div key={slot.id} className="rounded-2xl bg-[#F4F4F1] p-3"><p className="text-xs font-black">Slot {slot.id}</p><div className="mt-2 grid grid-cols-2 gap-2"><input value={slot.name} onChange={(event) => updateWheelSlot(slot.id, 'name', event.target.value)} placeholder="Prize Name" className="col-span-2 rounded-lg bg-white p-2.5 text-sm outline-none" /><select value={slot.type} onChange={(event) => updateWheelSlot(slot.id, 'type', event.target.value)} className="rounded-lg bg-white p-2.5 text-sm outline-none"><option value="points">Points</option><option value="coupon">Coupon</option><option value="try-again">Try Again</option></select><input value={slot.value} onChange={(event) => updateWheelSlot(slot.id, 'value', event.target.value)} placeholder="Value" className="rounded-lg bg-white p-2.5 text-sm outline-none" /><input type="number" min="0" max="100" step="0.1" value={slot.probability} onChange={(event) => updateWheelSlot(slot.id, 'probability', event.target.value)} placeholder="Weightage %" className="col-span-2 rounded-lg bg-white p-2.5 text-sm outline-none" /></div></div>)}</div></div>}

      {/* ==================== USER REWARD WALLETS ==================== */}
      {activeTab === 'wallets' && <div className="mt-5 overflow-x-auto rounded-3xl bg-white shadow-sm"><table className="w-full min-w-[680px] text-left text-xs"><thead className="border-b border-black/10 text-black/50"><tr><th className="p-3">User ID</th><th className="p-3">Points</th><th className="p-3">Streak</th><th className="p-3">Earned Coupons</th><th className="p-3"></th></tr></thead><tbody>{wallets.map((wallet) => <tr key={wallet.id} className="border-b border-black/5 last:border-0"><td className="p-3 font-bold">{wallet.id}</td><td className="p-3">{Number(wallet.points || 0)}</td><td className="p-3">{Number(wallet.streak || 0)} days</td><td className="p-3 text-black/60">{wallet.coupons?.length ? wallet.coupons.join(', ') : 'None'}</td><td className="p-3"><button type="button" onClick={() => openWalletModal(wallet)} className="rounded-lg bg-[#14140F] px-3 py-2 text-[11px] font-black text-white">Manage</button></td></tr>)}{wallets.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-sm text-black/45">No user reward wallets yet.</td></tr>}</tbody></table></div>}

      {/* ==================== WALLET ADJUSTMENT MODAL ==================== */}
      {selectedWallet && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><form onSubmit={saveWalletAdjustments} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E1352B]">User wallet</p><h3 className="mt-1 text-lg font-black">Grant points & coupon</h3><p className="mt-1 text-xs text-black/50">{selectedWallet.id}</p></div><button type="button" onClick={() => setSelectedWallet(null)} className="rounded-full bg-[#F4F4F1] p-2"><X size={16}/></button></div><label className="mt-5 block text-xs font-bold">Bonus Points<input type="number" value={bonusPoints} onChange={(event) => setBonusPoints(event.target.value)} placeholder="e.g. 50 (use -10 to deduct)" className="mt-1.5 w-full rounded-xl bg-[#F4F4F1] p-3 text-sm outline-none" /></label><label className="mt-4 block text-xs font-bold">Custom Promo Coupon<div className="mt-1.5 flex gap-2"><input value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} className="min-w-0 flex-1 rounded-xl bg-[#F4F4F1] p-3 text-sm outline-none" /><button type="button" onClick={() => setPromoCode(couponCode())} className="rounded-xl bg-black/5 px-3 text-xs font-bold"><Sparkles size={15}/></button></div></label><button disabled={isSavingWallet} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F6A5F] py-3 text-xs font-black text-white disabled:opacity-50">{isSavingWallet ? <Loader2 size={15} className="animate-spin"/> : null}{isSavingWallet ? 'Saving...' : 'Grant & Generate Coupon'}</button></form></div>}
    </section>
  );
}
