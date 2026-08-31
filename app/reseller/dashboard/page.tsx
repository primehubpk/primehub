'use client';

import Link from 'next/link';
import { Outfit } from 'next/font/google';
import { useEffect, useMemo, useState, type ElementType } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Home,
  Instagram,
  Lock,
  Music2,
  Package,
  PlayCircle,
  Share2,
  ShoppingBag,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  DEFAULT_MONTHLY_CHALLENGE,
  DEFAULT_RESELLER_TASKS,
  DEFAULT_RESELLER_WHEEL,
  type MonthlyChallengeSettings,
  type ResellerTask,
  type ResellerWheelSettings,
} from '@/lib/resellerTasks';
import { getTierForMonthlyOrders } from '@/lib/resellerTiers';
import type { ResellerProfile } from '@/lib/resellerTypes';

const outfit = Outfit({ subsets: ['latin'] });

type View = 'home' | 'tasks' | 'vouchers' | 'rewards' | 'wallet';
type VoucherType = 'cash' | 'gift' | 'discount' | 'brand';
type VoucherFilter = 'all' | VoucherType;
type SettingsSnapshot = {
  resellerTasks?: ResellerTask[];
  resellerMonthlyChallenge?: Partial<MonthlyChallengeSettings>;
  resellerWheel?: Partial<ResellerWheelSettings>;
};
type RewardWallet = { points: number; streak: number; lastCheckIn?: string; lastSpin?: string; };
type RewardSettings = { checkInRewards?: number[]; };
type RewardGift = { id: string; productId: string; pointsCost: number; active?: boolean; stock?: number; imageUrl?: string; title?: string; };
type RewardProduct = { id: string; title?: string; name?: string; imageUrl?: string; image?: string; images?: string[] | { url?: string }[]; };

type Voucher = {
  id: string;
  type: VoucherType;
  title: string;
  description: string;
  requirement: string;
  icon: string;
  art: string;
  minOrders: number;
  value?: number;
};

const settingsRef = doc(db, 'settings', 'main');
const taskIcons: Record<string, ElementType> = {
  youtube: PlayCircle,
  instagram: Instagram,
  tiktok: Music2,
  whatsapp: Share2,
  refer: Users,
  order: ShoppingBag,
  wholesale: Package,
};

export default function ResellerDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [tasks, setTasks] = useState<ResellerTask[]>(DEFAULT_RESELLER_TASKS);
  const [challenge, setChallenge] = useState<MonthlyChallengeSettings>(DEFAULT_MONTHLY_CHALLENGE);
  const [wheel, setWheel] = useState<ResellerWheelSettings>(DEFAULT_RESELLER_WHEEL);
  const [view, setView] = useState<View>('home');
  const [filter, setFilter] = useState<VoucherFilter>('all');
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [rewardWallet, setRewardWallet] = useState<RewardWallet>({ points: 0, streak: 0 });
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>({ checkInRewards: [10, 15, 20, 25, 30, 50, 100] });
  const [rewardGifts, setRewardGifts] = useState<RewardGift[]>([]);
  const [rewardProducts, setRewardProducts] = useState<Record<string, RewardProduct>>({});
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');

  useEffect(() => {
    let stopProfile: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, user => {
      stopProfile?.();
      if (!user) {
        router.replace('/reseller/join');
        return;
      }

      setLoading(true);
      stopProfile = onSnapshot(
        doc(db, 'reseller_profiles', user.uid),
        snapshot => {
          if (!snapshot.exists()) {
            router.replace('/reseller/join');
            return;
          }
          setProfile(snapshot.data() as ResellerProfile);
          setLoading(false);
        },
        () => setLoading(false),
      );
    });

    return () => {
      stopAuth();
      stopProfile?.();
    };
  }, [router]);

  useEffect(
    () =>
      onSnapshot(
        settingsRef,
        snapshot => {
          const data = snapshot.data() as SettingsSnapshot | undefined;
          if (Array.isArray(data?.resellerTasks)) setTasks(data.resellerTasks);
          if (data?.resellerMonthlyChallenge) {
            setChallenge({ ...DEFAULT_MONTHLY_CHALLENGE, ...data.resellerMonthlyChallenge });
          }
          if (data?.resellerWheel) setWheel({ ...DEFAULT_RESELLER_WHEEL, ...data.resellerWheel });
        },
        () => undefined,
      ),
    [],
  );


  useEffect(() => {
    let stopWallet: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, user => {
      stopWallet?.();
      if (user) stopWallet = onSnapshot(doc(db, 'user_rewards', user.uid), snap => setRewardWallet({ points: 0, streak: 0, ...(snap.data() || {}) } as RewardWallet));
    });
    const stopSettings = onSnapshot(doc(db, 'settings', 'rewards'), snap => setRewardSettings({ checkInRewards: [10, 15, 20, 25, 30, 50, 100], ...(snap.data() || {}) }));
    const stopGifts = onSnapshot(collection(db, 'reward_gifts'), snap => setRewardGifts(snap.docs.map(row => ({ id: row.id, ...row.data() }) as RewardGift).filter(gift => gift.active !== false)));
    const stopProducts = onSnapshot(collection(db, 'products'), snap => {
      const next: Record<string, RewardProduct> = {};
      snap.docs.forEach(row => { next[row.id] = { id: row.id, ...row.data() } as RewardProduct; });
      setRewardProducts(next);
    });
    return () => { stopAuth(); stopWallet?.(); stopSettings(); stopGifts(); stopProducts(); };
  }, []);

  async function checkInReward() {
    const user = auth.currentUser;
    if (!user || rewardBusy || rewardWallet.lastCheckIn === rewardDayKey()) return;
    setRewardBusy(true); setRewardMessage('');
    try {
      const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date(Date.now() - 86400000));
      const streak = rewardWallet.lastCheckIn === yesterday ? Math.min(7, Math.max(1, Number(rewardWallet.streak || 0)) + 1) : 1;
      const points = Math.max(0, Number(rewardSettings.checkInRewards?.[streak - 1] ?? 10));
      await runTransaction(db, async tx => {
        const ref = doc(db, 'user_rewards', user.uid);
        const snap = await tx.get(ref);
        const current = { points: 0, streak: 0, ...(snap.data() || {}) } as RewardWallet;
        if (current.lastCheckIn === rewardDayKey()) throw new Error('Already checked in today.');
        tx.set(ref, { ...current, points: Number(current.points || 0) + points, streak, lastCheckIn: rewardDayKey(), updatedAt: serverTimestamp() }, { merge: true });
      });
      setRewardMessage(`Day ${streak} complete — +${points} points added.`);
    } catch (error) { setRewardMessage(error instanceof Error ? error.message : 'Check-in failed.'); }
    finally { setRewardBusy(false); }
  }

  const activeTasks = useMemo(() => tasks.filter(task => task.active !== false), [tasks]);
  const monthlyOrders = Number(profile?.monthlyOrders ?? 0);
  const walletAvailable = Number(profile?.walletAvailable ?? 0);
  const walletPending = Number(profile?.walletPending ?? 0);
  const tier = getTierForMonthlyOrders(monthlyOrders);
  const target = Math.max(1, Number(challenge.targetOrders || DEFAULT_MONTHLY_CHALLENGE.targetOrders));
  const challengePercent = Math.min(100, Math.round((monthlyOrders / target) * 100));
  const remaining = Math.max(0, target - monthlyOrders);

  const vouchers = useMemo<Voucher[]>(
    () => [
      {
        id: 'cash-500',
        type: 'cash',
        title: 'Rs. 500 Cash',
        description: 'Credit to wallet',
        requirement: '5 orders',
        icon: '₨',
        art: '#0E7C6F',
        minOrders: 5,
        value: 500,
      },
      {
        id: 'challenge-cash',
        type: 'cash',
        title: `Rs. ${Number(challenge.cashReward || 0).toLocaleString()} Cash`,
        description: 'Monthly challenge',
        requirement: `${target} orders`,
        icon: '₨',
        art: '#127C6A',
        minOrders: target,
        value: Number(challenge.cashReward || 0),
      },
      {
        id: 'challenge-gift',
        type: 'gift',
        title: challenge.giftTitle || 'PrimeHub Gift Box',
        description: 'Surprise bangles gift',
        requirement: `${target} orders`,
        icon: '🎁',
        art: '#D94B3D',
        minOrders: target,
      },
      {
        id: 'bridal-gift',
        type: 'gift',
        title: 'Bridal Gift Voucher',
        description: 'Free bridal pouch',
        requirement: 'Gold tier',
        icon: '💍',
        art: '#9B2C4A',
        minOrders: 25,
      },
      {
        id: 'wholesale-off',
        type: 'discount',
        title: '10% Wholesale Off',
        description: 'Next wholesale order',
        requirement: '3 orders',
        icon: '%',
        art: '#E85D04',
        minOrders: 3,
      },
      {
        id: 'free-delivery',
        type: 'discount',
        title: 'Free Delivery',
        description: 'On any one order',
        requirement: '2 orders',
        icon: '📦',
        art: '#1D4E89',
        minOrders: 2,
      },
      {
        id: 'jazzcash-300',
        type: 'brand',
        title: 'JazzCash Rs. 300',
        description: 'Payout voucher',
        requirement: '8 orders',
        icon: '📱',
        art: '#C1121F',
        minOrders: 8,
        value: 300,
      },
      {
        id: 'easypaisa-300',
        type: 'brand',
        title: 'EasyPaisa Rs. 300',
        description: 'Payout voucher',
        requirement: '8 orders',
        icon: '📱',
        art: '#2A9D8F',
        minOrders: 8,
        value: 300,
      },
      {
        id: 'kids-gift',
        type: 'gift',
        title: 'Kids Deal Box Gift',
        description: 'Kids gift voucher',
        requirement: '6 orders',
        icon: '🎀',
        art: '#7B4B94',
        minOrders: 6,
      },
      {
        id: 'elite-cash',
        type: 'cash',
        title: 'Rs. 2,000 Elite',
        description: 'Elite members only',
        requirement: 'Elite 40+',
        icon: '👑',
        art: '#C9A227',
        minOrders: 40,
        value: 2000,
      },
    ],
    [challenge.cashReward, challenge.giftTitle, target],
  );

  const filteredVouchers = vouchers.filter(voucher => filter === 'all' || voucher.type === filter);
  const nextTask = activeTasks[0];

  if (loading || !profile) {
    return (
      <main className={`${outfit.className} flex min-h-screen items-center justify-center bg-[#F6F1E8] text-sm font-bold text-black/45`}>
        Loading your Reseller Club…
      </main>
    );
  }

  return (
    <main className={`${outfit.className} min-h-screen bg-[#111] text-[#14140F]`}>
      <div className="relative mx-auto min-h-screen max-w-[1100px] overflow-hidden bg-[#F6F1E8] shadow-2xl">
        <header className="relative bg-[linear-gradient(165deg,#16332E_0%,#0C1C19_70%)] px-4 pb-[22px] pt-3 text-white">
          <Link href="/reseller" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
            <ArrowLeft size={14} /> Reseller Club
          </Link>
          <p className="mt-3 text-[9px] font-extrabold uppercase tracking-[.18em] text-[#FF9A3C]">PrimeHub Reseller</p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-[1.15]">Complete missions.<br />Unlock vouchers.</h1>
          <p className="mt-1.5 text-xs text-white/75">Complete tasks, collect points and unlock exclusive rewards.</p>

          <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="This month" value={`${monthlyOrders} / ${target}`} />
            <Stat label="Wallet" value={`Rs. ${walletAvailable.toLocaleString()}`} />
            <Stat label="Tier" value={`${tier.name} · ${tier.rewardPercent}%`} />
            <Stat label="Live missions" value={`${activeTasks.length} tasks`} />
          </div>
        </header>

        <nav className="flex gap-1.5 overflow-x-auto px-4 pt-3">
          {(['home', 'tasks', 'vouchers', 'rewards', 'wallet'] as View[]).map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold capitalize transition ${view === item ? 'bg-[#14140F] text-white' : 'bg-white text-[#6B6A62]'}`}
            >
              {item}
            </button>
          ))}
        </nav>

        <section className="px-4 pb-28 pt-3.5">
          {view === 'home' && (
            <>
              {challenge.active && (
                <section className="mb-3 rounded-[18px] bg-[#FFFDF8] p-3.5 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">Monthly challenge</span>
                    <span className="rounded-full bg-[#E7F6F3] px-2 py-1 text-[11px] font-extrabold text-[#0E7C6F]">{monthlyOrders}/{target}</span>
                  </div>
                  <h2 className="mt-1.5 text-lg font-extrabold">{target} orders = gift or cash</h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#6B6A62]">Reach the target and choose your favourite reward when the challenge is complete.</p>
                  <Progress value={challengePercent} />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => setSelectedVoucher(vouchers.find(v => v.id === 'challenge-gift') || null)} className="flex-1 rounded-xl bg-[#F1ECE3] px-3 py-2.5 text-xs font-extrabold">🎁 Gift box</button>
                    <button type="button" onClick={() => setSelectedVoucher(vouchers.find(v => v.id === 'challenge-cash') || null)} className="flex-1 rounded-xl bg-[#F1ECE3] px-3 py-2.5 text-xs font-extrabold">₨ {Number(challenge.cashReward || 0).toLocaleString()} cash</button>
                  </div>
                  <p className="mt-2.5 text-xs text-[#6B6A62]">
                    {remaining ? `${remaining} more eligible order${remaining === 1 ? '' : 's'} to unlock.` : 'Challenge complete — pick your reward.'}
                  </p>
                </section>
              )}

              <section className="mb-3 rounded-[18px] bg-[#FFFDF8] p-3.5 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">Next mission</span>
                  <button type="button" onClick={() => setView('tasks')} className="rounded-xl bg-[#0E7C6F] px-3 py-2 text-xs font-extrabold text-white">All tasks</button>
                </div>
                {nextTask ? <TaskRow task={nextTask} monthlyOrders={monthlyOrders} target={target} /> : <p className="mt-3 text-xs text-[#6B6A62]">No live missions right now.</p>}
              </section>

              <section>
                <div className="mb-2.5 flex items-center justify-between px-0.5">
                  <h2 className="text-lg font-extrabold">Gift vouchers</h2>
                  <button type="button" onClick={() => setView('vouchers')} className="rounded-xl bg-[#F1ECE3] px-3 py-2 text-xs font-extrabold">See all</button>
                </div>
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  {vouchers.slice(0, 4).map(voucher => (
                    <VoucherCard key={voucher.id} voucher={voucher} orders={monthlyOrders} onOpen={setSelectedVoucher} />
                  ))}
                </div>
              </section>
            </>
          )}

          {view === 'tasks' && (
            <section className="rounded-[18px] bg-[#FFFDF8] p-3.5 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">Reseller tasks</span>
                <span className="rounded-full bg-[#E7F6F3] px-2 py-1 text-[11px] font-extrabold text-[#0E7C6F]">{activeTasks.length} live</span>
              </div>
              <h2 className="mt-1.5 text-lg font-extrabold">Earn extra beyond orders</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#6B6A62]">Complete social and growth missions to collect points after verification.</p>
              <div className="mt-2">
                {activeTasks.length ? activeTasks.map(task => <TaskRow key={task.id} task={task} monthlyOrders={monthlyOrders} target={target} />) : <p className="py-6 text-center text-xs text-[#6B6A62]">No active missions right now.</p>}
              </div>
            </section>
          )}

          {view === 'vouchers' && (
            <>
              <div className="mb-2.5 flex gap-1.5 overflow-x-auto pb-1">
                {(['all', 'cash', 'gift', 'discount', 'brand'] as VoucherFilter[]).map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-bold capitalize ${filter === item ? 'bg-[#14140F] text-white' : 'bg-white text-[#6B6A62]'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {filteredVouchers.map(voucher => (
                  <VoucherCard key={voucher.id} voucher={voucher} orders={monthlyOrders} onOpen={setSelectedVoucher} />
                ))}
              </div>
            </>
          )}


          {view === 'rewards' && (
            <div className="space-y-3">
              <section className="rounded-[18px] bg-[#FFFDF8] p-4 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
                <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">Daily streak</p><h2 className="mt-1 text-xl font-extrabold">7-Day Check-in</h2><p className="mt-1 text-xs text-[#6B6A62]">Complete every day to unlock higher point rewards.</p></div><span className="rounded-full bg-[#FFF3E0] px-3 py-1.5 text-[10px] font-extrabold">{Math.min(7, Number(rewardWallet.streak || 0))}/7</span></div>
                <div className="mt-4 grid grid-cols-7 gap-1.5">{Array.from({ length: 7 }, (_, index) => { const complete=index<Number(rewardWallet.streak||0); return <div key={index} className={`rounded-xl p-2 text-center ${complete?'bg-[#0E7C6F] text-white':'bg-[#F1ECE3] text-[#6B6A62]'}`}><p className="text-[8px] font-extrabold">D{index+1}</p><p className="mt-1 text-[9px] font-extrabold">+{Number(rewardSettings.checkInRewards?.[index]??0)}</p><p className="text-[7px] font-bold">PTS</p></div>; })}</div>
                <button type="button" onClick={checkInReward} disabled={rewardBusy || rewardWallet.lastCheckIn===rewardDayKey()} className="mt-4 w-full rounded-xl bg-[#14140F] py-3.5 text-xs font-extrabold text-white disabled:opacity-45">{rewardWallet.lastCheckIn===rewardDayKey()?'✓ Checked in today':`Check in +${Number(rewardSettings.checkInRewards?.[Math.min(6,Number(rewardWallet.streak||0))]??10)} points`}</button>
              </section>
              {wheel.active && <RewardWheel settings={wheel} />}
              <section className="rounded-[18px] bg-[#FFFDF8] p-4 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
                <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0E7C6F]">Point store</p><h2 className="mt-1 text-xl font-extrabold">Gifts & Products</h2><p className="mt-1 text-xs text-[#6B6A62]">Rewards added from Admin appear here automatically.</p></div><span className="rounded-full bg-[#FFF3E0] px-3 py-1.5 text-[10px] font-extrabold">{Number(rewardWallet.points||0).toLocaleString()} PTS</span></div>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{rewardGifts.length ? rewardGifts.map(gift => { const product=rewardProducts[gift.productId]; const image=gift.imageUrl || rewardProductImage(product); const need=Math.max(0,Number(gift.pointsCost)-Number(rewardWallet.points||0)); return <article key={gift.id} className="overflow-hidden rounded-2xl border border-black/[.06] bg-white"><div className="aspect-[4/3] bg-[#F1ECE3]">{image?<img src={image} alt={gift.title||'Reward gift'} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-3xl">🎁</div>}</div><div className="p-3"><h3 className="text-sm font-extrabold">{gift.title||product?.title||product?.name||'Reward Gift'}</h3><p className="mt-1 text-xs font-extrabold text-[#E85D04]">{Number(gift.pointsCost).toLocaleString()} points</p><p className="mt-1 text-[10px] text-[#0E7C6F]">Free delivery included</p><Link href="/rewards#redeem-rewards" className="mt-3 block rounded-xl bg-[#14140F] px-3 py-2.5 text-center text-[10px] font-extrabold text-white">{need?`Need ${need} more points`:'Redeem gift'}</Link></div></article>; }) : <div className="rounded-2xl bg-[#F1ECE3] p-6 text-center text-xs text-[#6B6A62] sm:col-span-2 lg:col-span-3">Admin se add kiye gaye active gifts yahan show honge.</div>}</div>
              </section>
              {rewardMessage && <div className="rounded-xl bg-[#0E7C6F] p-3 text-center text-xs font-extrabold text-white">{rewardMessage}</div>}
            </div>
          )}

          {view === 'wallet' && (
            <>
              <section className="rounded-[18px] bg-[#FFFDF8] p-3.5 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">Reward wallet</span>
                <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-[#F1ECE3] p-3"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#6B6A62]">Cash wallet</p><h2 className="mt-1 text-2xl font-extrabold">Rs. {walletAvailable.toLocaleString()}</h2><p className="text-[10px] text-[#6B6A62]">Pending Rs. {walletPending.toLocaleString()}</p></div><div className="rounded-2xl bg-[#E7F6F3] p-3"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#0E7C6F]">Points wallet</p><h2 className="mt-1 text-2xl font-extrabold">{Number(rewardWallet.points||0).toLocaleString()}</h2><p className="text-[10px] text-[#0E7C6F]">Reward points</p></div></div>
                <Link href="/reseller/wallet" className="mt-3 block w-full rounded-xl bg-[#14140F] px-3 py-3 text-center text-xs font-extrabold text-white">Request withdrawal</Link>
              </section>
              <section className="mt-3 rounded-[18px] bg-[#FFFDF8] p-3.5 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">My vouchers</span>
                <p className="mt-2 text-xs leading-relaxed text-[#6B6A62]">Claimed gift vouchers appear here. JazzCash and EasyPaisa payouts are released after verification.</p>
                <button type="button" onClick={() => setView('vouchers')} className="mt-3 rounded-xl bg-[#0E7C6F] px-3 py-2.5 text-xs font-extrabold text-white">Browse vouchers</button>
              </section>
            </>
          )}
        </section>

        <footer className="sticky bottom-0 z-10 grid grid-cols-5 bg-white px-1.5 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,.06)]">
          <Bottom href="/" label="Home" icon={<Home size={17} />} />
          <Bottom href="/shop" label="Shop" icon={<ShoppingBag size={17} />} />
          <Bottom href="/reseller/dashboard" label="Club" active icon={<WalletCards size={17} />} />
          <Bottom href="/cart" label="Cart" icon={<ShoppingBag size={17} />} />
          <Bottom href="/orders" label="Orders" icon={<Package size={17} />} />
        </footer>

        {selectedVoucher && (
          <VoucherSheet voucher={selectedVoucher} orders={monthlyOrders} onClose={() => setSelectedVoucher(null)} />
        )}
      </div>
    </main>
  );
}


function rewardDayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

function rewardProductImage(product?: RewardProduct) {
  if (!product) return '';
  if (product.imageUrl) return product.imageUrl;
  if (product.image) return product.image;
  const first=product.images?.[0];
  return typeof first==='string'?first:first?.url||'';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/[.08] bg-white/[.07] px-3 py-2.5">
      <small className="block text-[9px] font-bold uppercase tracking-[.12em] text-white/55">{label}</small>
      <strong className="mt-0.5 block text-base font-extrabold">{value}</strong>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="my-2.5 h-2 overflow-hidden rounded-full bg-[#EDE8DE]">
      <div className="h-full rounded-full bg-[linear-gradient(90deg,#0E7C6F,#12A394)] transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function TaskRow({ task, monthlyOrders, target }: { task: ResellerTask; monthlyOrders: number; target: number }) {
  const Icon = taskIcons[task.icon || 'order'] || Check;
  const isMonthly = task.id.includes('monthly');
  const isOrderTask = isMonthly || task.id.includes('weekly') || task.id.includes('order');
  const taskTarget = isMonthly ? target : task.id.includes('weekly') ? 3 : 1;
  const progress = isOrderTask ? Math.min(monthlyOrders, taskTarget) : 0;
  const percent = Math.round((progress / Math.max(1, taskTarget)) * 100);
  const href = task.url || '/reseller/tasks';
  const external = href.startsWith('http');

  return (
    <div className="grid grid-cols-[42px_1fr_auto] items-center gap-2.5 border-b border-black/[.08] py-3 last:border-0 last:pb-0">
      <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#FFF3E0] text-[#0E7C6F]"><Icon size={18} /></div>
      <div className="min-w-0">
        <h3 className="text-[13px] font-bold">{task.title}</h3>
        <p className="truncate text-xs text-[#6B6A62]">{task.description}</p>
        <Progress value={percent} />
      </div>
      <div className="text-right">
        <p className="text-[11px] font-extrabold text-[#0E7C6F]">{task.id === 'weekly-orders' || task.id === 'monthly-orders' ? <>Rs. {Number(task.reward || 0).toLocaleString()}</> : <>+{Number(task.reward || 0).toLocaleString()} pts</>}</p>
        <Link href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} className="mt-1.5 inline-flex items-center gap-1 rounded-xl bg-[#F1ECE3] px-2.5 py-2 text-[11px] font-extrabold">
          {task.verification === 'manual' ? 'Submit' : 'Do'} <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}


function RewardWheel({ settings }: { settings: ResellerWheelSettings }) {
  const prizes = [
    { title: 'Try Again', icon: '↻' },
    { title: 'Free Delivery', icon: '📦' },
    { title: 'Rs. 300 Voucher', icon: '₨' },
    { title: '20 Points', icon: '⭐' },
    { title: settings.customPrizeTitle || 'Mystery Gift', icon: settings.customPrizeImage ? '🖼️' : '🎁' },
  ];
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState('');
  function spin() {
    if (spinning) return;
    const winner = Math.floor(Math.random() * prizes.length);
    setSpinning(true); setResult('');
    setRotation(current => current + 1440 + (360 - winner * 72));
    window.setTimeout(() => { setResult(prizes[winner].title); setSpinning(false); }, 3200);
  }
  return (
    <section className="overflow-hidden rounded-[18px] bg-[linear-gradient(160deg,#16332E,#0C1C19)] p-4 text-white shadow-[0_8px_24px_rgba(20,20,15,.12)]">
      <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#FF9A3C]">Spin & win</span>
      <h2 className="mt-1.5 text-xl font-extrabold">Your reward wheel</h2>
      <p className="mt-1 text-xs text-white/65">Spin to reveal today’s prize.</p>
      <div className="relative mx-auto mt-5 aspect-square w-full max-w-[300px] sm:max-w-[360px]">
        <div className="absolute left-1/2 top-[-10px] z-20 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[24px] border-x-transparent border-t-[#FF9A3C]" />
        <div className="relative h-full w-full rounded-full border-[8px] border-[#FFFDF8] shadow-2xl transition-transform duration-[3000ms] ease-out" style={{ transform: `rotate(${rotation}deg)`, background: 'conic-gradient(#E85D04 0deg 72deg,#0E7C6F 72deg 144deg,#D94B3D 144deg 216deg,#C9A227 216deg 288deg,#7B4B94 288deg 360deg)' }}>
          {prizes.map((prize, index) => { const angle=index*72+36; return <div key={prize.title} className="absolute left-1/2 top-1/2 w-[86px] text-center text-[10px] font-extrabold leading-tight" style={{ transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-105px) rotate(-${angle}deg)` }}><span className="block text-xl">{index===4 && settings.customPrizeImage ? <img src={settings.customPrizeImage} alt="" className="mx-auto h-8 w-8 rounded-full object-cover"/> : prize.icon}</span>{prize.title}</div>; })}
          <div className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[#14140F] text-[10px] font-extrabold">WIN</div>
        </div>
      </div>
      <button type="button" onClick={spin} disabled={spinning} className="mt-5 w-full rounded-xl bg-[#FF9A3C] px-4 py-3 text-sm font-extrabold text-[#14140F] disabled:opacity-60">{spinning ? 'Spinning…' : 'Spin the wheel'}</button>
      {result && <p className="mt-3 rounded-xl bg-white/10 p-3 text-center text-sm font-extrabold">You got: {result}</p>}
    </section>
  );
}

function Mini({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-[10px] font-semibold text-[#6B6A62]">{icon}{text}</div>;
}

function VoucherCard({ voucher, orders, onOpen }: { voucher: Voucher; orders: number; onOpen: (voucher: Voucher) => void }) {
  const locked = orders < voucher.minOrders;
  return (
    <button type="button" onClick={() => onOpen(voucher)} className="w-full overflow-hidden rounded-2xl bg-white text-left shadow-[0_8px_20px_rgba(20,20,15,.05)]">
      <div className="relative grid h-[78px] place-items-center text-[28px] text-white" style={{ background: voucher.art }}>
        {voucher.icon}
        {locked && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[9px] font-extrabold"><Lock size={9} /> Locked</span>}
      </div>
      <div className="p-2.5">
        <h3 className="text-[13px] font-bold">{voucher.title}</h3>
        <p className="text-xs leading-snug text-[#6B6A62]">{voucher.description}<br />{voucher.requirement}</p>
      </div>
    </button>
  );
}

function VoucherSheet({ voucher, orders, onClose }: { voucher: Voucher; orders: number; onClose: () => void }) {
  const locked = orders < voucher.minOrders;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45" role="dialog" aria-modal="true" aria-label={voucher.title}>
      <button type="button" aria-label="Close voucher" onClick={onClose} className="absolute inset-0" />
      <div className="relative w-full max-w-[430px] rounded-t-[22px] bg-white p-4 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full bg-[#F1ECE3] p-2"><X size={16} /></button>
        <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">{voucher.type} voucher</p>
        <h2 className="mt-1.5 pr-10 text-xl font-extrabold">{voucher.title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-[#6B6A62]">{voucher.description}. Unlock requirement: {voucher.requirement}. Reward release is completed after verification.</p>
        {locked ? (
          <button type="button" disabled className="mt-3 w-full rounded-xl bg-[#14140F] px-3 py-3 text-xs font-extrabold text-white opacity-45">Locked — more orders needed</button>
        ) : (
          <Link href="/reseller/rewards-preview" className="mt-3 block w-full rounded-xl bg-[#14140F] px-3 py-3 text-center text-xs font-extrabold text-white">Redeem / choose this</Link>
        )}
        <button type="button" onClick={onClose} className="mt-2 w-full rounded-xl bg-[#F1ECE3] px-3 py-3 text-xs font-extrabold">Close</button>
      </div>
    </div>
  );
}

function Bottom({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-1 py-1 text-[10px] font-bold ${active ? 'text-[#0E7C6F]' : 'text-[#9A9890]'}`}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}
