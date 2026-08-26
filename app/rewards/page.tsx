'use client';

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { addDoc, collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import {
  ArrowRight,
  CheckCircle2,
  Gift,
  History,
  Lock,
  LogIn,
  RotateCw,
  Sparkles,
  TicketPercent,
  Trophy,
  Truck,
  Zap,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';

type PrizeType = 'product' | 'points' | 'free-delivery' | 'coupon' | 'try-again';

type Prize = {
  id: string;
  name: string;
  type: PrizeType;
  points: number;
  probability: number;
  active?: boolean;
  stock?: number;
  productId?: string;
  voucherCode?: string;
  voucherAmount?: number;
  imageUrl?: string;
};

type RewardSettings = {
  dailySpinLimit: number;
  checkInRewards: number[];
  guestMode: boolean;
  loginRequiredToRedeem: boolean;
  pointsExpiryDays: number;
  spinWheelSlots?: Prize[];
  termsAndConditions?: string;
};

type Wallet = {
  points: number;
  streak: number;
  lastCheckIn?: string;
  lastSpin?: string;
  coupons?: string[];
};

type RewardGift = {
  id: string;
  productId: string;
  pointsCost: number;
  active?: boolean;
  stock?: number;
  imageUrl?: string;
  title?: string;
};

type Product = {
  id: string;
  title?: string;
  name?: string;
  imageUrl?: string;
  image?: string;
  images?: string[] | { url?: string }[];
};

type RewardWin = {
  id: string;
  userId?: string;
  prizeId: string;
  name: string;
  type: PrizeType;
  points: number;
  productId?: string;
  voucherCode?: string;
  voucherAmount?: number;
  imageUrl?: string;
  status: 'pending' | 'redeemed';
  createdAt?: unknown;
};

const GUEST_KEY = 'phdeals-guest-rewards';
const GUEST_WINS_KEY = 'phdeals-guest-reward-wins';
const DEFAULT_TERMS = 'Points have no cash value. Required points are shown on eligible rewards. Points are deducted only after a successful redemption. Rewards are subject to stock and availability. Guests can earn rewards on this device, but login is required to redeem. Spin and check-in limits are controlled by PrimeHub. PrimeHub may change reward availability, point requirements, or reward rules.';
const defaultSettings: RewardSettings = {
  dailySpinLimit: 1,
  checkInRewards: [10, 15, 20, 25, 30, 50, 100],
  guestMode: true,
  loginRequiredToRedeem: true,
  pointsExpiryDays: 0,
  termsAndConditions: DEFAULT_TERMS,
};
const emptyWallet: Wallet = { points: 0, streak: 0, coupons: [] };

function dayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

function weighted(prizes: Prize[]) {
  const active = prizes.filter(p => p.active !== false && Number(p.probability) > 0 && Number(p.stock ?? 1) > 0);
  const total = active.reduce((sum, prize) => sum + Number(prize.probability), 0);
  if (!active.length || total <= 0) return null;
  let cursor = Math.random() * total;
  for (const prize of active) {
    cursor -= Number(prize.probability);
    if (cursor <= 0) return prize;
  }
  return active[active.length - 1];
}

function prizeLabel(prize: Pick<Prize, 'type' | 'points' | 'voucherAmount'>) {
  if (prize.type === 'try-again') return 'TRY AGAIN';
  if (prize.type === 'points') return `+${Number(prize.points || 0)} PTS`;
  if (prize.type === 'free-delivery') return prize.voucherAmount ? `FREE • Rs ${Number(prize.voucherAmount).toLocaleString()}` : 'FREE DELIVERY';
  if (prize.type === 'coupon') return prize.voucherAmount ? `Rs ${Number(prize.voucherAmount).toLocaleString()} OFF` : 'VOUCHER';
  return 'FREE PRODUCT';
}

function rewardText(prize: Prize) {
  if (prize.type === 'points') return `+${Number(prize.points || 0)} points added to your wallet.`;
  if (prize.type === 'free-delivery') return prize.voucherAmount ? `Free delivery voucher up to Rs ${Number(prize.voucherAmount).toLocaleString()}.` : 'Free delivery voucher unlocked.';
  if (prize.type === 'coupon') return `Voucher reward${prize.voucherAmount ? ` worth Rs ${Number(prize.voucherAmount).toLocaleString()}` : ''}.`;
  if (prize.type === 'product') return 'You won a FREE PRODUCT. Claim it from My Won Rewards.';
  return 'No reward this time. Your next spin is tomorrow.';
}

function imageForProduct(product?: Product) {
  if (!product) return '';
  if (typeof product.imageUrl === 'string' && product.imageUrl) return product.imageUrl;
  if (typeof product.image === 'string' && product.image) return product.image;
  const first = product.images?.[0];
  return typeof first === 'string' ? first : first?.url || '';
}

export default function RewardsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [wallet, setWallet] = useState<Wallet>(emptyWallet);
  const [settings, setSettings] = useState(defaultSettings);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [gifts, setGifts] = useState<RewardGift[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [wins, setWins] = useState<RewardWin[]>([]);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Prize | null>(null);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'rewards'), snapshot => {
      const data = snapshot.data() || {};
      const merged = { ...defaultSettings, ...data } as RewardSettings;
      setSettings(merged);
      setPrizes(Array.isArray(data.spinWheelSlots) ? data.spinWheelSlots : []);
    });
    const giftUnsub = onSnapshot(collection(db, 'reward_gifts'), snapshot => {
      setGifts(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as RewardGift).filter(g => g.active !== false && Number(g.pointsCost) > 0));
    });
    const productUnsub = onSnapshot(collection(db, 'products'), snapshot => {
      const next: Record<string, Product> = {};
      snapshot.docs.forEach(d => { next[d.id] = { id: d.id, ...d.data() } as Product; });
      setProducts(next);
    });
    return () => { unsub(); giftUnsub(); productUnsub(); };
  }, []);

  useEffect(() => {
    if (!user) {
      try {
        const rawWallet = localStorage.getItem(GUEST_KEY);
        setWallet(rawWallet ? { ...emptyWallet, ...JSON.parse(rawWallet) } : emptyWallet);
        const rawWins = localStorage.getItem(GUEST_WINS_KEY);
        setWins(rawWins ? JSON.parse(rawWins) : []);
      } catch {
        setWallet(emptyWallet);
        setWins([]);
      }
      setReady(true);
      return;
    }

    const authenticatedUser = user;
    const walletUnsub = onSnapshot(doc(db, 'user_rewards', authenticatedUser.uid), snapshot => {
      setWallet({ ...emptyWallet, ...(snapshot.data() || {}) } as Wallet);
    });
    const winsQuery = query(collection(db, 'reward_wins'), where('userId', '==', authenticatedUser.uid));
    const winsUnsub = onSnapshot(winsQuery, snapshot => {
      const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as RewardWin);
      rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      setWins(rows);
    });

    async function migrateGuestData() {
      try {
        const rawWallet = localStorage.getItem(GUEST_KEY);
        const guestWallet = rawWallet ? ({ ...emptyWallet, ...JSON.parse(rawWallet) } as Wallet) : emptyWallet;
        const rawWins = localStorage.getItem(GUEST_WINS_KEY);
        const guestWins: RewardWin[] = rawWins ? JSON.parse(rawWins) : [];
        if (guestWins.length) {
          for (const win of guestWins) {
            await addDoc(collection(db, 'reward_wins'), {
              userId: authenticatedUser.uid,
              prizeId: win.prizeId,
              name: win.name,
              type: win.type,
              points: Number(win.points || 0),
              productId: win.productId || '',
              voucherCode: win.voucherCode || '',
              voucherAmount: Number(win.voucherAmount || 0),
              imageUrl: win.imageUrl || '',
              status: 'pending',
              createdAt: serverTimestamp(),
            });
          }
          localStorage.removeItem(GUEST_WINS_KEY);
        }
        const guestPoints = Math.max(0, Number(guestWallet.points || 0));
        if (guestPoints > 0) {
          let remaining = guestPoints;
          while (remaining > 0) {
            const chunk = Math.min(100, remaining);
            await runTransaction(db, async tx => {
              const ref = doc(db, 'user_rewards', authenticatedUser.uid);
              const snap = await tx.get(ref);
              const current = { ...emptyWallet, ...(snap.data() || {}) } as Wallet;
              tx.set(ref, { ...current, points: Number(current.points) + chunk, updatedAt: serverTimestamp() }, { merge: true });
            });
            remaining -= chunk;
          }
          localStorage.removeItem(GUEST_KEY);
        }
      } catch {
        // Keep guest data if migration fails; the customer can retry after reload.
      }
    }

    migrateGuestData();
    setReady(true);
    return () => { walletUnsub(); winsUnsub(); };
  }, [user]);

  const activePrizes = useMemo(() => prizes.filter(p => p.active !== false && Number(p.stock ?? 1) > 0), [prizes]);
  const wheelCount = Math.max(1, activePrizes.length);
  const slice = 360 / wheelCount;

  function saveGuestWallet(next: Wallet) {
    setWallet(next);
    try { localStorage.setItem(GUEST_KEY, JSON.stringify(next)); } catch {}
  }

  function saveGuestWins(next: RewardWin[]) {
    setWins(next);
    try { localStorage.setItem(GUEST_WINS_KEY, JSON.stringify(next)); } catch {}
  }

  async function checkIn() {
    if (wallet.lastCheckIn === dayKey() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() - 86400000));
      const streak = wallet.lastCheckIn === yesterday ? Math.min(7, Math.max(1, Number(wallet.streak || 0)) + 1) : 1;
      const points = Math.min(100, Math.max(0, Number(settings.checkInRewards?.[streak - 1] ?? 10)));
      if (user) {
        await runTransaction(db, async tx => {
          const ref = doc(db, 'user_rewards', user.uid);
          const snap = await tx.get(ref);
          const current = { ...emptyWallet, ...(snap.data() || {}) } as Wallet;
          if (current.lastCheckIn === dayKey()) throw new Error('Already checked in today.');
          tx.set(ref, { ...current, points: Number(current.points) + points, streak, lastCheckIn: dayKey(), updatedAt: serverTimestamp() }, { merge: true });
        });
      } else if (settings.guestMode !== false) {
        saveGuestWallet({ ...wallet, points: Number(wallet.points) + points, streak, lastCheckIn: dayKey() });
      } else {
        throw new Error('Please login to use rewards.');
      }
      setMessage(`Day ${streak} complete — +${points} points added.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Check-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function spin() {
    if (wallet.lastSpin === dayKey() || spinning || busy) return;
    if (settings.guestMode === false && !user) {
      window.location.href = '/login?redirect=/rewards';
      return;
    }
    if (!activePrizes.length) {
      setMessage('Spin prizes are not configured yet.');
      return;
    }
    const prize = weighted(activePrizes);
    if (!prize) return;
    setBusy(true);
    setSpinning(true);
    setMessage('');
    setResult(null);
    const index = Math.max(0, activePrizes.findIndex(item => item.id === prize.id));
    const target = 360 * 6 + (360 - (index * slice + slice / 2));
    setRotation(current => current + target);

    try {
      const points = prize.type === 'points' ? Math.min(100, Math.max(0, Number(prize.points || 0))) : 0;
      const voucherCode = (prize.type === 'coupon' || prize.type === 'free-delivery')
        ? (prize.voucherCode?.trim() || `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`)
        : '';
      const win: RewardWin = {
        id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prizeId: prize.id,
        name: prize.name,
        type: prize.type,
        points,
        productId: prize.productId || '',
        voucherCode,
        voucherAmount: Number(prize.voucherAmount || 0),
        imageUrl: prize.imageUrl || '',
        status: 'pending',
      };

      if (user) {
        await runTransaction(db, async tx => {
          const ref = doc(db, 'user_rewards', user.uid);
          const snap = await tx.get(ref);
          const current = { ...emptyWallet, ...(snap.data() || {}) } as Wallet;
          if (current.lastSpin === dayKey()) throw new Error('Come back tomorrow for your next spin.');
          tx.set(ref, {
            ...current,
            points: Number(current.points) + points,
            lastSpin: dayKey(),
            coupons: voucherCode ? [...(current.coupons || []), voucherCode] : (current.coupons || []),
            updatedAt: serverTimestamp(),
          }, { merge: true });
          if (prize.type !== 'points' && prize.type !== 'try-again') {
            tx.set(doc(collection(db, 'reward_wins')), { ...win, userId: user.uid, createdAt: serverTimestamp() });
          }
        });
      } else {
        const nextWallet = { ...wallet, points: Number(wallet.points) + points, lastSpin: dayKey(), coupons: voucherCode ? [...(wallet.coupons || []), voucherCode] : (wallet.coupons || []) };
        saveGuestWallet(nextWallet);
        if (prize.type !== 'points' && prize.type !== 'try-again') saveGuestWins([...wins, win]);
      }

      window.setTimeout(() => {
        setSpinning(false);
        setBusy(false);
        setResult(prize);
        setMessage(prize.type === 'try-again' ? 'Better luck tomorrow — your next spin is waiting.' : `🎉 ${prize.name} won!`);
      }, 1900);
    } catch (error) {
      setSpinning(false);
      setBusy(false);
      setMessage(error instanceof Error ? error.message : 'Spin failed.');
    }
  }

  async function redeemWin(win: RewardWin) {
    if (!user) {
      window.location.href = '/login?redirect=/rewards#wins';
      return;
    }
    if (win.status === 'redeemed') return;
    setRedeeming(win.id);
    setMessage('');
    try {
      await runTransaction(db, async tx => {
        const winRef = doc(db, 'reward_wins', win.id);
        const winSnap = await tx.get(winRef);
        if (!winSnap.exists()) throw new Error('This reward is no longer available.');
        const current = winSnap.data() as RewardWin;
        if (current.status === 'redeemed') throw new Error('This reward was already claimed.');
        const redemptionRef = doc(collection(db, 'reward_redemptions'));
        tx.set(redemptionRef, {
          userId: user.uid,
          giftId: `wheel:${current.prizeId}`,
          wheelWinId: win.id,
          pointsCost: 0,
          rewardType: current.type,
          rewardName: current.name,
          productId: current.productId || '',
          voucherCode: current.voucherCode || '',
          voucherAmount: Number(current.voucherAmount || 0),
          status: 'pending',
          fulfillment: 'reward',
          freeDelivery: current.type === 'free-delivery' || current.type === 'product',
          deliveryFee: 0,
          createdAt: serverTimestamp(),
        });
        tx.update(winRef, { status: 'redeemed', redeemedAt: serverTimestamp() });
      });
      setMessage('Reward claimed! Admin will process your reward fulfilment.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not redeem reward.');
    } finally {
      setRedeeming(null);
    }
  }

  async function redeemGift(gift: RewardGift) {
    if (!user) {
      window.location.href = '/login?redirect=/rewards#redeem-rewards';
      return;
    }
    if (wallet.points < gift.pointsCost) {
      setMessage(`You need ${gift.pointsCost - wallet.points} more points.`);
      return;
    }
    if (Number(gift.stock ?? 1) < 1) {
      setMessage('This reward is out of stock.');
      return;
    }
    setRedeeming(gift.id);
    setMessage('');
    try {
      await runTransaction(db, async tx => {
        const walletRef = doc(db, 'user_rewards', user.uid);
        const redemptionRef = doc(collection(db, 'reward_redemptions'));
        const snap = await tx.get(walletRef);
        const current = { ...emptyWallet, ...(snap.data() || {}) } as Wallet;
        if (Number(current.points) < gift.pointsCost) throw new Error(`You need ${gift.pointsCost - Number(current.points)} more points.`);
        tx.set(walletRef, { ...current, points: Number(current.points) - gift.pointsCost, updatedAt: serverTimestamp() }, { merge: true });
        tx.set(redemptionRef, {
          userId: user.uid,
          giftId: gift.id,
          productId: gift.productId || '',
          pointsCost: gift.pointsCost,
          status: 'pending',
          fulfillment: 'reward',
          freeDelivery: true,
          deliveryFee: 0,
          createdAt: serverTimestamp(),
          rewardType: 'points-store',
          rewardName: gift.title || 'Reward Gift',
        });
      });
      setWallet(current => ({ ...current, points: Number(current.points) - gift.pointsCost }));
      setMessage('Reward claimed! Points deducted and FREE DELIVERY is included.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Redemption failed. Please try again.');
    } finally {
      setRedeeming(null);
    }
  }

  if (!ready) return <main className="min-h-screen bg-[#F4F4F1]" />;

  return (
    <main className="min-h-screen bg-[#F4F4F1] px-3 py-4 pb-28 sm:px-4 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="relative overflow-hidden rounded-[32px] bg-[#14140F] p-6 text-white shadow-xl sm:p-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#E1352B]/15 blur-2xl" />
          <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-[#FFB020]/10 blur-3xl" />
          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div><div className="flex items-center gap-2 text-[#FFB020]"><Sparkles size={17} /><span className="text-[10px] font-black uppercase tracking-[.25em]">Customer Loyalty & Gamification</span></div><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Rewards & Loyalty Hub</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/55">Spin daily, build your 7-day streak, and turn your points into real rewards.</p>{!user && <a href="/login?redirect=/rewards" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black"><LogIn size={14} /> Login to save rewards permanently</a>}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:min-w-44"><p className="text-[9px] font-black uppercase tracking-[.18em] text-white/40">Your balance</p><p className="mt-1 text-3xl font-black text-[#FFB020]">{Number(wallet.points || 0).toLocaleString()}</p><p className="text-[10px] font-bold text-white/45">reward points</p></div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Stat icon={<Zap />} label="Today" value={wallet.lastSpin === dayKey() ? 'Spin used' : '1 spin available'} />
          <Stat icon={<Trophy />} label="Streak" value={`${Math.min(7, Number(wallet.streak || 0))}/7 days`} />
          <Stat icon={<Gift />} label="Won rewards" value={String(wins.filter(w => w.status !== 'redeemed').length)} />
        </section>

        <section className="rounded-[30px] border border-black/5 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Daily streak</p><h2 className="mt-1 text-2xl font-black">7-Day Check-in</h2><p className="mt-1 text-xs text-black/45">Complete every day to unlock the higher point rewards.</p></div><div className="rounded-full bg-[#FFF1D6] px-3 py-1.5 text-[9px] font-black">{Math.min(7, Number(wallet.streak || 0))}/7</div></div>
          <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">{Array.from({ length: 7 }, (_, index) => { const complete = index < Number(wallet.streak || 0); return <div key={index} className={`rounded-xl p-2 text-center sm:rounded-2xl sm:p-3 ${complete ? 'bg-[#0F6A5F] text-white' : 'bg-[#F4F4F1] text-black/45'}`}><p className="text-[8px] font-black sm:text-[9px]">D{index + 1}</p><p className="mt-1 text-[9px] font-black sm:text-xs">+{Number(settings.checkInRewards?.[index] ?? 0)}</p><p className="text-[7px] font-bold sm:text-[8px]">PTS</p></div>; })}</div>
          <button type="button" disabled={busy || wallet.lastCheckIn === dayKey()} onClick={checkIn} className="mt-5 w-full rounded-2xl bg-[#14140F] py-3.5 text-xs font-black text-white shadow-sm disabled:opacity-45">{wallet.lastCheckIn === dayKey() ? '✓ Checked in today' : `Check in +${Number(settings.checkInRewards?.[Math.min(6, Number(wallet.streak || 0))] ?? 10)} points`}</button>
        </section>

        <section className="overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-sm">
          <div className="bg-[#14140F] px-5 py-5 text-white sm:px-6"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#FFB020]">Daily chance</p><h2 className="mt-1 text-2xl font-black">Spin & Win</h2></div><span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-black text-white/70">1 spin / day</span></div><p className="mt-2 text-xs leading-5 text-white/45">Every prize is configured by PrimeHub. Bigger prizes can stay rare while Try Again remains common.</p></div>
          <div className="p-5 sm:p-7">
            <div className="relative mx-auto h-[min(82vw,360px)] w-[min(82vw,360px)] max-w-full">
              <div className="absolute -top-3 left-1/2 z-30 -translate-x-1/2 text-2xl text-[#E1352B] drop-shadow">▼</div>
              <div className="absolute inset-0 rounded-full border-[10px] border-[#14140F] bg-white p-3 shadow-2xl" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 1.9s cubic-bezier(.12,.72,.16,1)' : 'none' }}>
                <div className="relative h-full w-full overflow-hidden rounded-full" style={{ background: `conic-gradient(${activePrizes.map((_, i) => `${i % 2 ? '#FFF1D6' : '#F4F4F1'} ${i * slice}deg ${(i + 1) * slice}deg`).join(',') || '#F4F4F1 0deg 360deg'})` }}>
                  {activePrizes.map((prize, index) => <div key={prize.id} className="absolute left-1/2 top-1/2 h-1/2 w-[40%] origin-bottom -translate-x-1/2 -translate-y-full text-center" style={{ transform: `translateX(-50%) rotate(${index * slice + slice / 2}deg)` }}><div className="mx-auto h-11 w-11 overflow-hidden rounded-full border-2 border-white bg-white shadow-md sm:h-12 sm:w-12">{prize.imageUrl ? <img src={prize.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[9px] font-black">{prize.type === 'points' ? prize.points : '★'}</div>}</div><span className="mt-1 block truncate text-[7px] font-black text-black/80">{prizeLabel(prize)}</span></div>)}
                  <div className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-white bg-[#E1352B] text-white shadow-xl"><RotateCw size={22} /></div>
                </div>
              </div>
            </div>
            <button type="button" disabled={busy || wallet.lastSpin === dayKey() || !activePrizes.length} onClick={spin} className="mx-auto mt-6 flex w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-[#E1352B] py-4 text-xs font-black text-white shadow-lg shadow-[#E1352B]/15 disabled:opacity-45">{wallet.lastSpin === dayKey() ? 'Come back tomorrow' : spinning ? 'Spinning...' : <><RotateCw size={15} /> SPIN THE WHEEL</>}</button>
            {!activePrizes.length && <p className="mt-3 text-center text-[10px] font-bold text-black/40">The wheel is waiting for admin prize settings.</p>}
          </div>
        </section>

        {result && result.type !== 'try-again' && <section className="overflow-hidden rounded-[28px] border border-[#FFB020]/30 bg-[#FFF9ED] p-5 shadow-sm sm:p-6"><div className="flex items-center gap-4"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm">{result.imageUrl ? <img src={result.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#E1352B]"><Gift /></div>}</div><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Congratulations</p><h3 className="mt-1 text-xl font-black">{result.name}</h3><p className="mt-1 text-xs leading-5 text-black/55">{rewardText(result)}</p></div></div><a href="#wins" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-4 py-2.5 text-[10px] font-black text-white">View my reward <ArrowRight size={13} /></a></section>}

        <section id="wins" className="scroll-mt-5 rounded-[30px] border border-black/5 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Your prizes</p><h2 className="mt-1 text-2xl font-black">My Won Rewards</h2><p className="mt-1 text-xs text-black/45">A reward won from the wheel is yours to claim. Login is required for redemption.</p></div><span className="rounded-full bg-[#FFF1D6] px-3 py-1.5 text-[9px] font-black">{wins.length} total</span></div><div className="mt-5 space-y-3">{wins.length ? wins.map(win => { const product = products[win.productId || '']; const image = win.imageUrl || imageForProduct(product); const canRedeem = win.status !== 'redeemed'; return <article key={win.id} className="overflow-hidden rounded-2xl border border-black/5 bg-[#FAFAF7]"><div className="flex gap-3 p-3 sm:p-4"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-black/20"><Gift size={22} /></div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-black">{win.name}</h3><p className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#0F6A5F]">{prizeLabel(win)}</p></div><span className={`rounded-full px-2 py-1 text-[8px] font-black ${win.status === 'redeemed' ? 'bg-black/5 text-black/35' : 'bg-[#E8F5F2] text-[#0F6A5F]'}`}>{win.status === 'redeemed' ? 'CLAIMED' : 'READY'}</span></div>{win.voucherCode && <p className="mt-2 flex items-center gap-1 text-[10px] font-black text-[#E1352B]"><TicketPercent size={12} /> {win.voucherCode}</p>}{win.voucherAmount ? <p className="mt-1 text-[10px] font-bold text-black/45">Voucher value: Rs {Number(win.voucherAmount).toLocaleString()}</p> : null}</div></div><div className="border-t border-black/5 px-3 py-3 sm:px-4">{!user ? <button type="button" onClick={() => window.location.href = '/login?redirect=/rewards#wins'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-2.5 text-[10px] font-black text-white"><Lock size={12} /> Login to Redeem</button> : <button type="button" disabled={!canRedeem || redeeming === win.id} onClick={() => redeemWin(win)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E1352B] py-2.5 text-[10px] font-black text-white disabled:opacity-45">{redeeming === win.id ? 'Claiming...' : canRedeem ? <><CheckCircle2 size={13} /> Claim Reward</> : 'Already Claimed'}</button>}</div></article>; }) : <div className="rounded-2xl bg-[#F7F7F2] p-7 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black/20"><Gift size={20} /></div><p className="mt-3 text-sm font-black">No wheel rewards yet</p><p className="mt-1 text-xs text-black/40">Your winning rewards will appear here after a successful spin.</p></div>}</div></section>

        <section id="redeem-rewards" className="scroll-mt-5 rounded-[30px] border border-black/5 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#0F6A5F]">Point store</p><h2 className="mt-1 text-2xl font-black">Redeem Rewards</h2><p className="mt-1 text-xs text-black/45">Use points to claim eligible gifts. FREE DELIVERY is included.</p></div><span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-[9px] font-black">{Number(wallet.points || 0).toLocaleString()} PTS</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{gifts.length ? gifts.map(gift => { const product = products[gift.productId]; const image = gift.imageUrl || imageForProduct(product); const need = Math.max(0, Number(gift.pointsCost) - Number(wallet.points || 0)); const can = need === 0 && Number(gift.stock ?? 1) > 0; return <article key={gift.id} className="overflow-hidden rounded-2xl border border-black/5 bg-[#FAFAF7]"><div className="flex gap-3 p-3"><div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white">{image ? <img src={image} alt={gift.title || 'Reward'} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-black/20"><Gift /></div>}</div><div className="min-w-0 flex-1"><h3 className="text-sm font-black">{gift.title || product?.title || 'Reward Gift'}</h3><p className="mt-1 text-[11px] font-black text-[#E1352B]">{Number(gift.pointsCost).toLocaleString()} points</p><p className="mt-1 flex items-center gap-1 text-[9px] font-bold text-[#0F6A5F]"><Truck size={11} /> FREE DELIVERY included</p><p className="mt-1 text-[9px] font-bold text-black/40">{need ? `Need ${need} more points` : can ? 'You can redeem this reward now' : 'Out of stock'}</p></div></div><div className="px-3 pb-3">{!user ? <button type="button" onClick={() => window.location.href = '/login?redirect=/rewards#redeem-rewards'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-2.5 text-[10px] font-black text-white"><LogIn size={12} /> Login to Redeem</button> : <button type="button" disabled={!can || redeeming === gift.id} onClick={() => redeemGift(gift)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E1352B] py-2.5 text-[10px] font-black text-white disabled:opacity-45">{redeeming === gift.id ? 'Claiming...' : can ? <><CheckCircle2 size={13} /> Redeem Gift</> : `Need ${need} more points`}</button>}</div></article>; }) : <div className="rounded-2xl bg-[#F7F7F2] p-7 text-center text-xs font-bold text-black/40 sm:col-span-2">No point-store rewards are active yet. Add them from Admin → Rewards → Reward Store.</div>}</div></section>

        <section className="rounded-[30px] border border-black/5 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><History size={17} className="text-[#0F6A5F]" /><h2 className="text-lg font-black">Rewards Terms & Conditions</h2></div><p className="mt-3 whitespace-pre-line text-[11px] leading-5 text-black/55">{settings.termsAndConditions || DEFAULT_TERMS}</p>{settings.loginRequiredToRedeem !== false && <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#F7F7F2] p-3 text-[10px] font-black leading-5 text-black/60"><Lock size={13} className="mt-1 shrink-0" /> Guests can collect rewards on this device, but login is required before any reward redemption.</div>}</section>

        {message && <div className="rounded-2xl bg-[#0F6A5F] p-3 text-center text-xs font-black text-white shadow-sm">{message}</div>}
        <div className="flex items-center justify-center gap-1 pb-2 text-[9px] font-bold text-black/35"><Lock size={11} /> Login saves your rewards permanently; guest mode uses this device.</div>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1D6] text-[#E1352B]">{icon}</div><p className="mt-3 text-[9px] font-black uppercase tracking-[.18em] text-black/35">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}
