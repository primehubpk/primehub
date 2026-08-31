'use client';

import Link from 'next/link';
import { Outfit } from 'next/font/google';
import { useEffect, useMemo, useState, type ElementType } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
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
  type MonthlyChallengeSettings,
  type ResellerTask,
} from '@/lib/resellerTasks';
import { getTierForMonthlyOrders } from '@/lib/resellerTiers';
import type { ResellerProfile } from '@/lib/resellerTypes';

const outfit = Outfit({ subsets: ['latin'] });

type View = 'home' | 'tasks' | 'vouchers' | 'wallet';
type VoucherType = 'cash' | 'gift' | 'discount' | 'brand';
type VoucherFilter = 'all' | VoucherType;
type SettingsSnapshot = {
  resellerTasks?: ResellerTask[];
  resellerMonthlyChallenge?: Partial<MonthlyChallengeSettings>;
};
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
  const [view, setView] = useState<View>('home');
  const [filter, setFilter] = useState<VoucherFilter>('all');
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);

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
        },
        () => undefined,
      ),
    [],
  );

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
      <div className="relative mx-auto min-h-screen max-w-[430px] overflow-hidden bg-[#F6F1E8] shadow-2xl">
        <header className="relative bg-[linear-gradient(165deg,#16332E_0%,#0C1C19_70%)] px-4 pb-[22px] pt-3 text-white">
          <Link href="/reseller" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
            <ArrowLeft size={14} /> Reseller Club
          </Link>
          <p className="mt-3 text-[9px] font-extrabold uppercase tracking-[.18em] text-[#FF9A3C]">PrimeHub Reseller</p>
          <h1 className="mt-1 text-[22px] font-extrabold leading-[1.15]">Complete missions.<br />Unlock vouchers.</h1>
          <p className="mt-1.5 text-xs text-white/75">Complete tasks, collect points and unlock exclusive rewards.</p>

          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <Stat label="This month" value={`${monthlyOrders} / ${target}`} />
            <Stat label="Wallet" value={`Rs. ${walletAvailable.toLocaleString()}`} />
            <Stat label="Tier" value={`${tier.name} · ${tier.rewardPercent}%`} />
            <Stat label="Live missions" value={`${activeTasks.length} tasks`} />
          </div>
        </header>

        <nav className="flex gap-1.5 overflow-x-auto px-4 pt-3">
          {(['home', 'tasks', 'vouchers', 'wallet'] as View[]).map(item => (
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
                <div className="grid grid-cols-2 gap-2.5">
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
              <div className="grid grid-cols-2 gap-2.5">
                {filteredVouchers.map(voucher => (
                  <VoucherCard key={voucher.id} voucher={voucher} orders={monthlyOrders} onOpen={setSelectedVoucher} />
                ))}
              </div>
            </>
          )}

          {view === 'wallet' && (
            <>
              <section className="rounded-[18px] bg-[#FFFDF8] p-3.5 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
                <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">Reward wallet</span>
                <h2 className="mt-1.5 text-[32px] font-extrabold">Rs. {walletAvailable.toLocaleString()}</h2>
                <p className="text-xs text-[#6B6A62]">Available now · Pending Rs. {walletPending.toLocaleString()}</p>
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
        <p className="text-[11px] font-extrabold text-[#0E7C6F]">+{Number(task.reward || 0).toLocaleString()} pts</p>
        <Link href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} className="mt-1.5 inline-flex items-center gap-1 rounded-xl bg-[#F1ECE3] px-2.5 py-2 text-[11px] font-extrabold">
          {task.verification === 'manual' ? 'Submit' : 'Do'} <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
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
