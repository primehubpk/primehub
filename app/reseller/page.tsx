'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Crown,
  Gift,
  Home,
  Instagram,
  Music2,
  Package,
  PlayCircle,
  Share2,
  ShoppingBag,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
} from 'lucide-react';
import Footer from '@/components/Footer';
import { db } from '@/lib/firebase';
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS, type MonthlyChallengeSettings, type ResellerTask } from '@/lib/resellerTasks';

const settingsRef = doc(db, 'settings', 'main');

type ClubView = 'home' | 'tasks' | 'vouchers' | 'wallet';

type Voucher = {
  id: string;
  type: 'cash' | 'gift' | 'discount' | 'brand';
  title: string;
  description: string;
  need: string;
  value?: number;
  minOrders: number;
  tone: string;
  icon: string;
};

const sampleOrders = 4;
const sampleWallet = 850;
const submittedTaskIds = ['instagram'];
const taskIconMap: Record<string, any> = {
  youtube: PlayCircle,
  instagram: Instagram,
  tiktok: Music2,
  share: Share2,
  'whatsapp-share': Share2,
  'weekly-orders': ShoppingBag,
  'monthly-orders': Trophy,
  'wholesale-order': Package,
  'refer-reseller': Users,
};

function buildVouchers(challenge: MonthlyChallengeSettings): Voucher[] {
  return [
    { id: 'challenge-gift', type: 'gift', title: challenge.giftTitle || DEFAULT_MONTHLY_CHALLENGE.giftTitle, description: 'Monthly challenge gift voucher', need: `${challenge.targetOrders} orders`, minOrders: challenge.targetOrders, tone: 'bg-[#D94B3D]', icon: 'Gift' },
    { id: 'challenge-cash', type: 'cash', title: `Rs. ${Number(challenge.cashReward || 0).toLocaleString()} Cash`, description: 'Credit to reseller wallet', need: `${challenge.targetOrders} orders`, value: Number(challenge.cashReward || 0), minOrders: challenge.targetOrders, tone: 'bg-[#0E7C6F]', icon: 'Rs' },
    { id: 'starter-cash', type: 'cash', title: 'Rs. 500 Cash', description: 'First cash unlock', need: '5 orders', value: 500, minOrders: 5, tone: 'bg-[#127C6A]', icon: 'Rs' },
    { id: 'wholesale-off', type: 'discount', title: '10% Wholesale Off', description: 'Use on next wholesale order', need: '3 orders', minOrders: 3, tone: 'bg-[#E85D04]', icon: '%' },
    { id: 'free-delivery', type: 'discount', title: 'Free Delivery', description: 'One reseller order delivery voucher', need: '2 orders', minOrders: 2, tone: 'bg-[#1D4E89]', icon: 'Ship' },
    { id: 'jazzcash-300', type: 'brand', title: 'JazzCash Rs. 300', description: 'Payout voucher for active sellers', need: '8 orders', value: 300, minOrders: 8, tone: 'bg-[#C1121F]', icon: 'JC' },
    { id: 'easypaisa-300', type: 'brand', title: 'EasyPaisa Rs. 300', description: 'Payout voucher for active sellers', need: '8 orders', value: 300, minOrders: 8, tone: 'bg-[#2A9D8F]', icon: 'EP' },
    { id: 'elite-cash', type: 'cash', title: 'Rs. 2,000 Elite', description: 'Elite reseller monthly bonus', need: '40 orders', value: 2000, minOrders: 40, tone: 'bg-[#C9A227]', icon: 'VIP' },
  ];
}

export default function ResellerPage() {
  const [view, setView] = useState<ClubView>('home');
  const [filter, setFilter] = useState<'all' | Voucher['type']>('all');
  const [tasks, setTasks] = useState<ResellerTask[]>(DEFAULT_RESELLER_TASKS);
  const [challenge, setChallenge] = useState<MonthlyChallengeSettings>(DEFAULT_MONTHLY_CHALLENGE);

  useEffect(() => onSnapshot(settingsRef, (snap) => {
    const data: any = snap.data() || {};
    if (Array.isArray(data.resellerTasks)) setTasks(data.resellerTasks);
    if (data.resellerMonthlyChallenge) setChallenge({ ...DEFAULT_MONTHLY_CHALLENGE, ...data.resellerMonthlyChallenge });
  }), []);

  const activeTasks = useMemo(() => tasks.filter((task) => task.active), [tasks]);
  const vouchers = useMemo(() => buildVouchers(challenge), [challenge]);
  const visibleVouchers = vouchers.filter((voucher) => filter === 'all' || voucher.type === filter);
  const challengeTarget = Math.max(1, Number(challenge.targetOrders || DEFAULT_MONTHLY_CHALLENGE.targetOrders));
  const challengePercent = Math.min(100, Math.round((sampleOrders / challengeTarget) * 100));
  const challengeRemaining = Math.max(0, challengeTarget - sampleOrders);
  const claimableTasks = activeTasks.filter((task) => submittedTaskIds.includes(task.id) || task.reward > 0).length;

  return (
    <main className="min-h-screen bg-[#111] text-[#14140F]">
      <div className="mx-auto min-h-screen max-w-[430px] overflow-hidden bg-[#F6F1E8] shadow-[0_0_45px_rgba(0,0,0,.32)]">
        <section className="bg-gradient-to-br from-[#16332E] to-[#0C1C19] px-4 pb-5 pt-4 text-white">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-white/80"><ArrowLeft size={14} /> Reseller Club</Link>
          <p className="mt-4 text-[9px] font-black uppercase tracking-[0.22em] text-[#FF9A3C]">PrimeHub Reseller</p>
          <h1 className="mt-1 text-[26px] font-black leading-[1.05] tracking-tight">Complete missions.<br />Unlock vouchers.</h1>
          <p className="mt-2 text-xs leading-5 text-white/70">Tasks, gift vouchers and cash rewards. Admin controls the challenge, task rewards and availability.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <HeroStat label="This Month" value={`${sampleOrders} / ${challengeTarget}`} />
            <HeroStat label="Wallet" value={`Rs. ${sampleWallet.toLocaleString()}`} />
            <HeroStat label="Tier" value="Starter · 5%" />
            <HeroStat label="Claimable" value={`${claimableTasks} tasks`} />
          </div>
        </section>

        <nav className="flex gap-2 overflow-x-auto px-4 pt-3">
          {[
            ['home', 'Home'],
            ['tasks', 'Tasks'],
            ['vouchers', 'Vouchers'],
            ['wallet', 'Wallet'],
          ].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setView(key as ClubView)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${view === key ? 'bg-[#14140F] text-white' : 'bg-white text-black/55'}`}>{label}</button>
          ))}
        </nav>

        <section className="space-y-3 px-4 pb-28 pt-4">
          {view === 'home' && <HomeView challenge={challenge} challengePercent={challengePercent} challengeRemaining={challengeRemaining} activeTasks={activeTasks} vouchers={vouchers} onOpenTasks={() => setView('tasks')} onOpenVouchers={() => setView('vouchers')} />}
          {view === 'tasks' && <TasksView tasks={activeTasks} />}
          {view === 'vouchers' && <VouchersView vouchers={visibleVouchers} filter={filter} onFilter={setFilter} />}
          {view === 'wallet' && <WalletView />}
        </section>

        <Link href="/admin/reseller-tasks" className="fixed bottom-[78px] left-1/2 z-20 ml-[74px] -translate-x-1/2 rounded-full bg-[#E85D04] px-3 py-2 text-[11px] font-black text-white shadow-[0_8px_20px_rgba(232,93,4,.35)]">Admin control</Link>
        <div className="fixed bottom-0 left-1/2 z-10 grid w-full max-w-[430px] -translate-x-1/2 grid-cols-5 bg-white px-2 pb-3 pt-2 shadow-[0_-8px_24px_rgba(0,0,0,.06)]">
          <BottomNav icon={<Home size={16} />} label="Home" active href="/" />
          <BottomNav icon={<ShoppingBag size={16} />} label="Shop" href="/shop" />
          <BottomNav icon={<Gift size={16} />} label="Club" href="/reseller" />
          <BottomNav icon={<WalletCards size={16} />} label="Wallet" href="/reseller/wallet" />
          <BottomNav icon={<Crown size={16} />} label="Orders" href="/orders" />
        </div>
      </div>
      <Footer />
    </main>
  );
}

function HomeView({ challenge, challengePercent, challengeRemaining, activeTasks, vouchers, onOpenTasks, onOpenVouchers }: { challenge: MonthlyChallengeSettings; challengePercent: number; challengeRemaining: number; activeTasks: ResellerTask[]; vouchers: Voucher[]; onOpenTasks: () => void; onOpenVouchers: () => void }) {
  const nextTask = activeTasks[0];
  return <>
    <section className="rounded-[18px] bg-[#FFFDF8] p-4 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
      <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#E85D04]">Monthly Challenge</p><span className="rounded-full bg-[#E7F6F3] px-2.5 py-1 text-[11px] font-black text-[#0E7C6F]">{sampleOrders}/{challenge.targetOrders}</span></div>
      <h2 className="mt-2 text-lg font-black">{challenge.targetOrders} orders = gift or cash</h2>
      <p className="mt-1 text-xs leading-5 text-black/55">Admin sets the target, gift title and cash amount. Reseller chooses the reward when complete.</p>
      <Progress value={challengePercent} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <RewardChoice icon={<Gift size={15} />} title={challenge.giftTitle} />
        <RewardChoice icon={<span className="text-sm font-black">Rs</span>} title={`${Number(challenge.cashReward || 0).toLocaleString()} cash`} />
      </div>
      <p className="mt-3 text-xs text-black/55">{challengeRemaining ? `${challengeRemaining} more eligible orders to unlock.` : 'Challenge complete. Pick your reward.'}</p>
    </section>

    {nextTask && <section className="rounded-[18px] bg-[#FFFDF8] p-4 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
      <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#E85D04]">Next Mission</p><button type="button" onClick={onOpenTasks} className="rounded-xl bg-[#0E7C6F] px-3 py-2 text-[10px] font-black text-white">All tasks</button></div>
      <TaskRow task={nextTask} compact />
    </section>}

    <section>
      <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-lg font-black">Gift vouchers</h2><button type="button" onClick={onOpenVouchers} className="rounded-xl bg-white px-3 py-2 text-[10px] font-black text-black/70">See all</button></div>
      <div className="grid grid-cols-2 gap-2.5">{vouchers.slice(0, 4).map((voucher) => <VoucherCard key={voucher.id} voucher={voucher} />)}</div>
    </section>
  </>;
}

function TasksView({ tasks }: { tasks: ResellerTask[] }) {
  return <section className="rounded-[18px] bg-[#FFFDF8] p-4 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
    <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#E85D04]">Reseller Tasks</p><h2 className="mt-1 text-lg font-black">Earn extra beyond orders</h2></div><span className="rounded-full bg-[#14140F] px-3 py-1.5 text-[10px] font-black text-white">{tasks.length} active</span></div>
    <p className="mt-2 text-xs leading-5 text-black/55">Links, rewards and availability are controlled from Admin. Rewards credit after review.</p>
    <div className="mt-2">{tasks.map((task) => <TaskRow key={task.id} task={task} />)}</div>
  </section>;
}

function VouchersView({ vouchers, filter, onFilter }: { vouchers: Voucher[]; filter: 'all' | Voucher['type']; onFilter: (filter: 'all' | Voucher['type']) => void }) {
  const filters: Array<'all' | Voucher['type']> = ['all', 'cash', 'gift', 'discount', 'brand'];
  return <>
    <div className="flex gap-2 overflow-x-auto pb-1">{filters.map((item) => <button key={item} type="button" onClick={() => onFilter(item)} className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-black capitalize ${filter === item ? 'bg-[#14140F] text-white' : 'bg-white text-black/55'}`}>{item}</button>)}</div>
    <div className="grid grid-cols-2 gap-2.5">{vouchers.map((voucher) => <VoucherCard key={voucher.id} voucher={voucher} />)}</div>
  </>;
}

function WalletView() {
  return <>
    <section className="rounded-[18px] bg-[#FFFDF8] p-4 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#E85D04]">Reward Wallet</p>
      <h2 className="mt-1 text-[32px] font-black leading-none">Rs. {sampleWallet.toLocaleString()}</h2>
      <p className="mt-2 text-xs text-black/55">Available now. Pending rewards move here after Admin approval.</p>
      <Link href="/reseller/wallet" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-3 text-xs font-black text-white">Request withdrawal <ChevronRight size={14} /></Link>
    </section>
    <section className="rounded-[18px] bg-[#FFFDF8] p-4 shadow-[0_8px_24px_rgba(20,20,15,.05)]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0E7C6F]">My Vouchers</p>
      <p className="mt-2 text-xs leading-5 text-black/55">Claimed gift vouchers, JazzCash and EasyPaisa rewards will appear here after approval.</p>
    </section>
  </>;
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[14px] border border-white/10 bg-white/[.07] px-3 py-2.5"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/50">{label}</p><p className="mt-1 text-base font-black">{value}</p></div>;
}

function Progress({ value }: { value: number }) {
  return <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDE8DE]"><div className="h-full rounded-full bg-gradient-to-r from-[#0E7C6F] to-[#12A394]" style={{ width: `${value}%` }} /></div>;
}

function RewardChoice({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="rounded-[14px] bg-[#F1ECE3] px-3 py-2.5"><div className="flex items-center gap-2 text-xs font-black text-[#14140F]">{icon}{title}</div></div>;
}

function TaskRow({ task, compact = false }: { task: ResellerTask; compact?: boolean }) {
  const Icon = taskIconMap[task.id] || CheckCircle2;
  const submitted = submittedTaskIds.includes(task.id);
  return <article className="grid grid-cols-[42px_1fr_auto] items-center gap-2.5 border-b border-black/[.08] py-3 last:border-b-0 last:pb-0">
    <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#E7F6F3] text-[#0E7C6F]"><Icon size={19} /></div>
    <div className="min-w-0"><h3 className="text-[13px] font-black leading-4">{task.title}</h3><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-black/50">{task.description}</p>{!compact && <Progress value={submitted ? 100 : 35} />}</div>
    <div className="text-right"><p className="text-[11px] font-black text-[#0E7C6F]">Rs. {Number(task.reward || 0).toLocaleString()}</p><Link href={task.url || '/reseller/tasks'} className={`mt-1.5 inline-flex rounded-xl px-3 py-2 text-[10px] font-black ${submitted ? 'bg-[#E7F6F3] text-[#0E7C6F]' : 'bg-[#F1ECE3] text-[#14140F]'}`}>{submitted ? 'Done' : 'Do'}</Link></div>
  </article>;
}

function VoucherCard({ voucher }: { voucher: Voucher }) {
  const locked = sampleOrders < voucher.minOrders;
  return <Link href="/reseller/tasks" className="overflow-hidden rounded-[16px] bg-white text-left shadow-[0_8px_20px_rgba(20,20,15,.05)]">
    <div className={`relative grid h-[78px] place-items-center ${voucher.tone} text-sm font-black text-white`}><span>{voucher.icon}</span>{locked && <span className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[10px] font-black">Locked</span>}</div>
    <div className="p-2.5"><h3 className="text-[13px] font-black leading-4">{voucher.title}</h3><p className="mt-1 text-[11px] leading-4 text-black/50">{voucher.description}<br />{voucher.need}</p></div>
  </Link>;
}

function BottomNav({ icon, label, href, active = false }: { icon: React.ReactNode; label: string; href: string; active?: boolean }) {
  return <Link href={href} className={`flex flex-col items-center gap-1 text-[10px] font-black ${active ? 'text-[#0E7C6F]' : 'text-black/35'}`}>{icon}<span>{label}</span></Link>;
}
