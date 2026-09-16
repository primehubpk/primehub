'use client';

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { Check, Gift, RotateCcw, Save, Sparkles, Star, TicketPercent, Truck } from 'lucide-react';
import RewardWheelArtwork, {
  PREMIUM_REWARD_WHEEL_ORDER,
  rewardWheelArtworkKind,
  rewardWheelBackground,
  rewardWheelPrizeLabel,
  type RewardWheelArtworkKind,
} from '@/components/rewards/RewardWheelArtwork';
import { adminCollection, setAdminDocument, type Product } from './shared';

type PrizeType = 'product' | 'points' | 'free-delivery' | 'coupon' | 'try-again';

type Prize = {
  id: string;
  name: string;
  type: PrizeType;
  points?: number;
  probability: number;
  active: boolean;
  stock: number;
  productId?: string;
  voucherCode?: string;
  voucherAmount?: number;
};

type RewardSettings = Record<string, any> & { spinWheelSlots?: Prize[] };

type FixedSlot = {
  kind: RewardWheelArtworkKind;
  type: PrizeType;
  name: string;
  subtitle: string;
};

const SLOT_BY_KIND: Record<RewardWheelArtworkKind, FixedSlot> = {
  points: {
    kind: 'points',
    type: 'points',
    name: 'Free Points',
    subtitle: 'Set the exact number of free points the winner receives.',
  },
  voucher: {
    kind: 'voucher',
    type: 'coupon',
    name: 'Free Voucher',
    subtitle: 'Wheel text and voucher rupee amount are editable from Admin.',
  },
  'free-delivery': {
    kind: 'free-delivery',
    type: 'free-delivery',
    name: 'Free Delivery',
    subtitle: 'One free-delivery credit is added to the winner.',
  },
  'free-product': {
    kind: 'free-product',
    type: 'product',
    name: 'Free Deal Box',
    subtitle: 'Premium deal-box reward. Linking a product is optional.',
  },
  'try-again': {
    kind: 'try-again',
    type: 'try-again',
    name: 'Try Again',
    subtitle: 'No reward. Customer can try again on the next eligible day.',
  },
};

const FIXED_SLOTS = PREMIUM_REWARD_WHEEL_ORDER.map(kind => SLOT_BY_KIND[kind]);

function defaultPrize(kind: RewardWheelArtworkKind): Prize {
  const slot = SLOT_BY_KIND[kind];
  return {
    id: `premium-${kind}`,
    name: slot.name,
    type: slot.type,
    points: kind === 'points' ? 20 : 0,
    probability: 20,
    active: true,
    stock: 999,
    voucherAmount: kind === 'voucher' ? 300 : 0,
    voucherCode: '',
    productId: '',
  };
}

function voucherDisplayName(existing: Prize | undefined) {
  const value = String(existing?.name || '').trim();
  if (!value || value.toLowerCase() === 'voucher') return 'Free Voucher';
  return value.slice(0, 28);
}

function normalizeFiveSlots(saved: Prize[] | undefined) {
  const source = Array.isArray(saved) ? saved : [];
  return PREMIUM_REWARD_WHEEL_ORDER.map(kind => {
    const existing = source.find(prize => rewardWheelArtworkKind(prize) === kind);
    const fallback = defaultPrize(kind);
    const slot = SLOT_BY_KIND[kind];
    return {
      ...fallback,
      ...(existing || {}),
      id: existing?.id || fallback.id,
      name: kind === 'voucher' ? voucherDisplayName(existing) : slot.name,
      type: slot.type,
      active: true,
      probability: Math.min(100, Math.max(0, Number(existing?.probability ?? fallback.probability))),
      stock: Math.max(0, Math.round(Number(existing?.stock ?? fallback.stock))),
      points: kind === 'points' ? Math.max(0, Math.round(Number(existing?.points ?? fallback.points))) : 0,
      voucherAmount: kind === 'voucher' || kind === 'free-delivery'
        ? Math.max(0, Math.round(Number(existing?.voucherAmount ?? fallback.voucherAmount)))
        : 0,
      voucherCode: kind === 'voucher' ? String(existing?.voucherCode || '') : '',
      productId: kind === 'free-product' ? String(existing?.productId || '') : '',
    } as Prize;
  });
}

function slotIcon(kind: RewardWheelArtworkKind) {
  if (kind === 'points') return Star;
  if (kind === 'voucher') return TicketPercent;
  if (kind === 'free-delivery') return Truck;
  if (kind === 'free-product') return Gift;
  return RotateCcw;
}

export default function PremiumWheelConfigurator() {
  const [settings, setSettings] = useState<RewardSettings>({});
  const [prizes, setPrizes] = useState<Prize[]>(() => normalizeFiveSlots(undefined));
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const probabilityTotal = useMemo(
    () => prizes.reduce((total, prize) => total + Math.max(0, Number(prize.probability || 0)), 0),
    [prizes],
  );
  const probabilityValid = Math.abs(probabilityTotal - 100) < 0.001;
  const probabilityDifference = 100 - probabilityTotal;

  useEffect(() => onSnapshot(adminCollection('settings'), snapshot => {
    const rewardDoc = snapshot.docs.find(row => row.id === 'rewards');
    if (!rewardDoc) return;
    const next = (rewardDoc.data() || {}) as RewardSettings;
    setSettings(next);
    setPrizes(normalizeFiveSlots(next.spinWheelSlots));
  }), []);

  useEffect(() => onSnapshot(adminCollection('products'), snapshot => {
    const rows = snapshot.docs
      .map(row => ({ id: row.id, ...row.data() } as Product))
      .filter(product => product.id && product.title)
      .sort((a, b) => String(a.title).localeCompare(String(b.title)));
    setProducts(rows);
  }), []);

  function patchPrize(kind: RewardWheelArtworkKind, patch: Partial<Prize>) {
    setMessage('');
    setPrizes(current => current.map(prize => rewardWheelArtworkKind(prize) === kind ? { ...prize, ...patch } : prize));
  }

  async function saveWheel() {
    if (!probabilityValid) {
      setMessage(`Probability total must be exactly 100%. Current total is ${probabilityTotal}%.`);
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const normalized = normalizeFiveSlots(prizes);
      await setAdminDocument('settings', 'rewards', {
        ...settings,
        spinWheelSlots: normalized,
        updatedAt: new Date().toISOString(),
      });
      setSettings(current => ({ ...current, spinWheelSlots: normalized }));
      setPrizes(normalized);
      setMessage('Premium wheel saved. Home and Reseller Club now use these exact same five rewards and probabilities.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the premium wheel.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pt-5 md:px-6 md:pt-7">
      <div className="overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-sm">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:p-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[#B7791F]">
                  <Sparkles size={16} />
                  <span className="text-[10px] font-black uppercase tracking-[.2em]">PrimeHub Premium Spin</span>
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight">One Shared 5-Prize Wheel</h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-black/50">
                  This is the single wheel configuration used on both Home and Reseller Club. The premium design stays fixed; values, voucher text and winning probability are controlled here.
                </p>
              </div>
              <button
                type="button"
                onClick={saveWheel}
                disabled={saving || !probabilityValid}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save size={15} /> {saving ? 'Saving…' : 'Save Premium Wheel'}
              </button>
            </div>

            {message ? (
              <div className={`mt-4 flex items-start gap-2 rounded-2xl p-3 text-xs font-bold ${probabilityValid ? 'bg-[#EEF8F4] text-[#0E6A55]' : 'bg-[#FFF2EE] text-[#B73820]'}`}>
                <Check size={15} className="mt-0.5 shrink-0" /> {message}
              </div>
            ) : null}

            <div className={`mt-4 rounded-2xl border p-4 ${probabilityValid ? 'border-[#BFE5D9] bg-[#EEF8F4]' : 'border-[#F1C2B5] bg-[#FFF5F1]'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.16em] text-black/40">Total winning probability</p>
                  <p className="mt-1 text-sm font-black">{probabilityTotal}% / 100%</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-[9px] font-black ${probabilityValid ? 'bg-[#0E6A55] text-white' : 'bg-[#E85D3C] text-white'}`}>
                  {probabilityValid ? 'READY' : probabilityDifference > 0 ? `${probabilityDifference}% LEFT` : `${Math.abs(probabilityDifference)}% OVER`}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full bg-[#B7791F] transition-all" style={{ width: `${Math.min(100, Math.max(0, probabilityTotal))}%` }} />
              </div>
              <p className="mt-2 text-[10px] font-bold text-black/45">Save is enabled only when all five probabilities total exactly 100%.</p>
            </div>

            <div className="mt-5 space-y-3">
              {FIXED_SLOTS.map((slot, index) => {
                const prize = prizes.find(item => rewardWheelArtworkKind(item) === slot.kind) || defaultPrize(slot.kind);
                const Icon = slotIcon(slot.kind);
                return (
                  <article key={slot.kind} className="rounded-[22px] border border-black/[.06] bg-[#FAFAF7] p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl bg-white p-2 shadow-sm">
                        <RewardWheelArtwork prize={prize} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[.14em] text-black/35">Slice {index + 1} · Fixed design</p>
                            <h3 className="mt-1 flex items-center gap-2 text-sm font-black"><Icon size={14} /> {slot.kind === 'voucher' ? prize.name : slot.name}</h3>
                            <p className="mt-1 text-[10px] leading-4 text-black/45">{slot.subtitle}</p>
                          </div>
                          <span className="rounded-full bg-[#FFF1D6] px-2.5 py-1 text-[9px] font-black text-[#7A4B00]">{rewardWheelPrizeLabel(prize)}</span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <label>
                            <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/40">Probability</span>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={Number(prize.probability || 0)}
                                onChange={event => patchPrize(slot.kind, { probability: Math.min(100, Math.max(0, Number(event.target.value || 0))) })}
                                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 pr-7 text-sm font-black outline-none focus:border-[#B7791F]"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-black/30">%</span>
                            </div>
                          </label>
                          <label>
                            <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/40">Stock</span>
                            <input
                              type="number"
                              min="0"
                              value={Number(prize.stock ?? 999)}
                              onChange={event => patchPrize(slot.kind, { stock: Math.max(0, Math.round(Number(event.target.value || 0))) })}
                              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-[#B7791F]"
                            />
                          </label>

                          {slot.kind === 'points' ? (
                            <label className="col-span-2">
                              <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/40">Free points amount</span>
                              <input
                                type="number"
                                min="0"
                                value={Number(prize.points || 0)}
                                onChange={event => patchPrize(slot.kind, { points: Math.max(0, Math.round(Number(event.target.value || 0))) })}
                                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-[#B7791F]"
                              />
                            </label>
                          ) : null}

                          {slot.kind === 'voucher' ? (
                            <>
                              <label className="col-span-2 sm:col-span-4">
                                <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/40">Wheel text (editable)</span>
                                <input
                                  value={prize.name || ''}
                                  maxLength={28}
                                  onChange={event => patchPrize(slot.kind, { name: event.target.value })}
                                  placeholder="Free Voucher"
                                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-[#B7791F]"
                                />
                                <span className="mt-1 block text-[9px] font-bold text-black/35">Whatever you type here is shown on the wheel; the design stays the same.</span>
                              </label>
                              <label>
                                <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/40">Voucher Rs.</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={Number(prize.voucherAmount || 0)}
                                  onChange={event => patchPrize(slot.kind, { voucherAmount: Math.max(0, Math.round(Number(event.target.value || 0))) })}
                                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-[#B7791F]"
                                />
                              </label>
                              <label>
                                <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/40">Code optional</span>
                                <input
                                  value={prize.voucherCode || ''}
                                  onChange={event => patchPrize(slot.kind, { voucherCode: event.target.value.toUpperCase() })}
                                  placeholder="AUTO"
                                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-black uppercase outline-none focus:border-[#B7791F]"
                                />
                              </label>
                            </>
                          ) : null}

                          {slot.kind === 'free-delivery' ? (
                            <label className="col-span-2">
                              <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/40">Delivery limit Rs. (optional)</span>
                              <input
                                type="number"
                                min="0"
                                value={Number(prize.voucherAmount || 0)}
                                onChange={event => patchPrize(slot.kind, { voucherAmount: Math.max(0, Math.round(Number(event.target.value || 0))) })}
                                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-[#B7791F]"
                              />
                            </label>
                          ) : null}

                          {slot.kind === 'free-product' ? (
                            <label className="col-span-2">
                              <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/40">Deal box product (optional)</span>
                              <select
                                value={prize.productId || ''}
                                onChange={event => patchPrize(slot.kind, { productId: event.target.value })}
                                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[11px] font-bold outline-none focus:border-[#B7791F]"
                              >
                                <option value="">Generic Free Deal Box</option>
                                {products.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}
                              </select>
                            </label>
                          ) : null}

                          {slot.kind === 'try-again' ? (
                            <div className="col-span-2 flex items-center rounded-xl bg-white px-3 py-2.5 text-[10px] font-bold text-black/45">
                              No reward value is attached to this slice.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl bg-[#F5F0E7] p-4 text-xs leading-5 text-black/55">
              <strong className="text-black">How winning works:</strong> each saved percentage is used as its real weighted chance. The five slices stay visually equal so the design remains clean; the server chooses the prize from the Admin probabilities.
            </div>
          </div>

          <div className="lg:sticky lg:top-5 lg:self-start">
            <PremiumWheelPreview prizes={prizes} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PremiumWheelPreview({ prizes }: { prizes: Prize[] }) {
  const count = 5;
  const radius = 32;
  return (
    <div className="overflow-hidden rounded-[28px] bg-[linear-gradient(155deg,#fffdf8,#f4ecdf)] p-4 text-[#17140f] shadow-[0_18px_45px_rgba(90,55,10,.15)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#B7791F]">Live customer preview</p>
          <h3 className="mt-1 text-lg font-black">PrimeHub Spin & Win</h3>
        </div>
        <span className="rounded-full border border-[#B7791F]/20 bg-white px-2.5 py-1 text-[9px] font-black">Shared wheel</span>
      </div>

      <div className="relative mx-auto mt-5 aspect-square w-full max-w-[350px]">
        <div className="absolute left-1/2 top-[-10px] z-30 h-0 w-0 -translate-x-1/2 border-x-[16px] border-t-[29px] border-x-transparent border-t-[#E6AD42] drop-shadow-md" />
        <div
          className="absolute inset-0 overflow-hidden rounded-full border-[10px] border-[#E6AD42] shadow-[0_0_0_3px_#FFF0A7,0_0_0_6px_#B97818,0_18px_40px_rgba(87,49,4,.28)]"
          style={{ background: rewardWheelBackground(count) }}
        >
          <div className="pointer-events-none absolute inset-[4%] rounded-full border border-white/45 bg-[radial-gradient(circle,rgba(255,255,255,.15)_0_29%,transparent_30%_70%,rgba(255,255,255,.11)_71%_100%)]" />
          {prizes.map((prize, index) => {
            const angle = index * (360 / count);
            const radians = (angle * Math.PI) / 180;
            const x = 50 + radius * Math.sin(radians);
            const y = 50 - radius * Math.cos(radians);
            return (
              <div
                key={prize.id}
                className="absolute z-10 h-[25%] w-[27%] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <RewardWheelArtwork prize={prize} />
              </div>
            );
          })}
          <div className="absolute left-1/2 top-1/2 z-20 grid h-[23%] w-[23%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[6px] border-[#FFF0A7] bg-[radial-gradient(circle_at_35%_28%,#FFFFFF,#FFF9EC_72%)] text-center shadow-[0_0_0_3px_#B87916,0_8px_18px_rgba(86,51,7,.30)]">
            <span className="text-[10px] font-black leading-[.9] tracking-[-.03em] text-[#1D2B4A] sm:text-xs">PrimeHub<br /><b className="mt-1 inline-block text-[8px] tracking-[.16em] text-[#B7791F]">SPIN</b></span>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#B7791F]/10 bg-white/75 p-3 text-[10px] leading-4 text-black/55">
        This exact five-slice artwork is shared by Home and Reseller Club. Voucher wording and reward values remain live Admin data.
      </div>
    </div>
  );
}
