'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Check, ChevronRight, Crown, Gift, Home, Instagram, Music2, Package, PlayCircle, Share2, ShoppingBag, Trophy, Users, WalletCards } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS, type MonthlyChallengeSettings, type ResellerTask } from '@/lib/resellerTasks';
import { getTierForMonthlyOrders, getTierProgress, getResellerTiers } from '@/lib/resellerTiers';
import type { ResellerProfile } from '@/lib/resellerTypes';

type View = 'home' | 'tasks' | 'vouchers' | 'wallet';
type SettingsSnapshot = { resellerTasks?: ResellerTask[]; resellerMonthlyChallenge?: Partial<MonthlyChallengeSettings> };
type Voucher = { id: string; title: string; description: string; value: string; icon: ReactNode; tone: string };

const settingsRef = doc(db, 'settings', 'main');
const icons: Record<string, ElementType> = { youtube: PlayCircle, instagram: Instagram, tiktok: Music2, whatsapp: Share2, refer: Users, order: ShoppingBag, wholesale: Package };

export default function ResellerDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [tasks, setTasks] = useState<ResellerTask[]>(DEFAULT_RESELLER_TASKS);
  const [challenge, setChallenge] = useState<MonthlyChallengeSettings>(DEFAULT_MONTHLY_CHALLENGE);
  const [view, setView] = useState<View>('home');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopProfile: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, user => {
      stopProfile?.();
      if (!user) { router.replace('/reseller/join'); return; }
      setLoading(true);
      stopProfile = onSnapshot(doc(db, 'reseller_profiles', user.uid), snap => {
        if (!snap.exists()) { router.replace('/reseller/join'); return; }
        setProfile(snap.data() as ResellerProfile);
        setLoading(false);
      }, () => setLoading(false));
    });
    return () => { stopAuth(); stopProfile?.(); };
  }, [router]);

  useEffect(() => onSnapshot(settingsRef, snap => {
    const data = snap.data() as SettingsSnapshot | undefined;
    if (Array.isArray(data?.resellerTasks)) setTasks(data.resellerTasks);
    if (data?.resellerMonthlyChallenge) setChallenge({ ...DEFAULT_MONTHLY_CHALLENGE, ...data.resellerMonthlyChallenge });
  }, () => undefined), []);

  const activeTasks = useMemo(() => tasks.filter(task => task.active !== false), [tasks]);
  const monthlyOrders = Number(profile?.monthlyOrders ?? 0);
  const walletAvailable = Number(profile?.walletAvailable ?? 0);
  const walletPending = Number(profile?.walletPending ?? 0);
  const tier = getTierForMonthlyOrders(monthlyOrders);
  const progress = getTierProgress(monthlyOrders);
  const target = Math.max(1, Number(challenge.targetOrders || DEFAULT_MONTHLY_CHALLENGE.targetOrders));
  const challengePercent = Math.min(100, Math.round((monthlyOrders / target) * 100));
  const remaining = Math.max(0, target - monthlyOrders);
  const vouchers: Voucher[] = [
    ...(challenge.active ? [
      { id: 'challenge-gift', title: challenge.giftTitle || 'PrimeHub Gift Box', description: 'Unlock after completing the monthly challenge.', value: 'Mystery gift', icon: <Gift size={20}/>, tone: 'from-[#FFF0B8] to-[#FFF9E6]' },
      { id: 'challenge-cash', title: 'Cash reward', description: 'Choose cash when your challenge is complete.', value: `Rs. ${Number(challenge.cashAmount || 0).toLocaleString()}`, icon: <WalletCards size={20}/>, tone: 'from-[#DDF5F0] to-[#F2FFFC]' }
    ] : []),
    { id: 'tier-voucher', title: `${tier.name} bonus`, description: `Your current ${tier.rewardPercent}% reseller rate.`, value: `${tier.rewardPercent}% off`, icon: <Crown size={20}/>, tone: 'from-[#E7E2FF] to-[#F8F6FF]' },
    { id: 'welcome-voucher', title: 'Member-only deals', description: 'New product drops reserved for club members.', value: 'View deals', icon: <ShoppingBag size={20}/>, tone: 'from-[#FFE0DC] to-[#FFF7F4]' }
  ];

  if (loading || !profile) return <main className="min-h-screen bg-[#F5F4EF] flex items-center justify-center text-sm font-bold text-black/45">Loading your Reseller Club…</main>;

  return <main className="min-h-screen bg-[#F5F4EF] text-[#14140F]">
    <div className="mx-auto min-h-screen max-w-[440px] bg-[#F5F4EF] shadow-2xl">
      <header className="bg-gradient-to-br from-[#11130E] via-[#171A12] to-[#0F665B] px-5 pb-6 pt-4 text-white">
        <Link href="/reseller" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[10px] font-black text-white/75"><ArrowLeft size={13}/> Reseller Club</Link>
        <div className="mt-5 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCF68] text-[#15150F]"><Crown size={25}/></div><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#FFCF68]">PrimeHub Reseller</p><h1 className="text-2xl font-black">Mission Board</h1></div></div>
        <p className="mt-3 text-[11px] leading-5 text-white/60">Complete missions, unlock vouchers and grow your reseller wallet.</p>
        <div className="mt-5 grid grid-cols-2 gap-2"><Stat label="This month" value={`${monthlyOrders}/${target}`} icon={<Trophy size={14}/>} /><Stat label="Wallet" value={`Rs. ${walletAvailable.toLocaleString()}`} icon={<WalletCards size={14}/>} /><Stat label="Tier" value={`${tier.name} · ${tier.rewardPercent}%`} icon={<Crown size={14}/>} /><Stat label="Live tasks" value={`${activeTasks.length}`} icon={<Check size={14}/>} /></div>
      </header>

      <nav className="flex gap-2 overflow-x-auto bg-[#F5F0E7] px-4 py-3">{(['home','tasks','vouchers','wallet'] as View[]).map(item => <button key={item} onClick={() => setView(item)} className={`rounded-full px-4 py-2 text-[10px] font-black capitalize ${view === item ? 'bg-[#14140F] text-white' : 'bg-white text-black/55'}`}>{item}</button>)}</nav>

      <section className="space-y-4 px-4 pb-8 pt-4">
        {view === 'home' && <><div className="rounded-[26px] bg-gradient-to-br from-[#FFF0B8] via-[#FFF8DE] to-[#E1F5EF] p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#C23B32]">Monthly challenge</p><h2 className="mt-1 text-xl font-black">{target} orders = your choice</h2></div><span className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-black text-[#0F6A5F]">{monthlyOrders}/{target}</span></div><p className="mt-2 text-[11px] text-black/55">Admin-managed goal and rewards update here instantly.</p><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-[#0F6A5F] transition-all" style={{ width: `${challengePercent}%` }}/></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-white/75 p-3"><Gift size={18} className="text-[#C23B32]"/><p className="mt-2 text-[11px] font-black">{challenge.giftTitle || 'PrimeHub Gift Box'}</p></div><div className="rounded-2xl bg-white/75 p-3"><WalletCards size={18} className="text-[#0F6A5F]"/><p className="mt-2 text-[11px] font-black">Rs. {Number(challenge.cashAmount || 0).toLocaleString()} cash</p></div></div><p className="mt-4 rounded-2xl bg-[#14140F] px-4 py-3 text-[10px] font-bold text-white/75">{remaining ? `${remaining} more eligible order${remaining === 1 ? '' : 's'} to unlock.` : '🎉 Challenge complete — reward selection unlocked.'}</p></div><TierCard orders={monthlyOrders} tier={tier} progress={progress}/><div className="rounded-[26px] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Quick missions</p><h2 className="mt-1 text-xl font-black">Earn more today</h2></div><button onClick={() => setView('tasks')} className="text-[10px] font-black text-[#0F6A5F]">See all</button></div><div className="mt-3 space-y-2">{activeTasks.slice(0,3).map(task => <TaskRow key={task.id} task={task}/>)}</div></div></>}

        {view === 'tasks' && <div className="rounded-[26px] bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Live missions</p><h2 className="mt-1 text-2xl font-black">Complete & earn</h2><p className="mt-2 text-[11px] text-black/50">Tasks are controlled from Admin and appear here automatically.</p><div className="mt-5 space-y-2">{activeTasks.length ? activeTasks.map(task => <TaskRow key={task.id} task={task}/>) : <p className="rounded-2xl bg-[#F7F6F2] p-4 text-sm text-black/50">No active missions right now.</p>}</div></div>}

        {view === 'vouchers' && <div className="space-y-3"><div className="px-1"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Rewards vault</p><h2 className="mt-1 text-2xl font-black">Your vouchers</h2></div>{vouchers.map(v => <div key={v.id} className={`rounded-[24px] bg-gradient-to-br ${v.tone} p-4 shadow-sm`}><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-[#0F6A5F]">{v.icon}</div><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-wider text-black/45">Reseller voucher</p><h3 className="text-sm font-black">{v.title}</h3><p className="mt-1 text-[10px] text-black/55">{v.description}</p></div><span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black">{v.value}</span></div></div>)}</div>}

        {view === 'wallet' && <div className="space-y-4"><div className="rounded-[26px] bg-gradient-to-br from-[#0F6A5F] to-[#11130E] p-5 text-white shadow-lg"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#FFCF68]">Reward wallet</p><p className="mt-2 text-3xl font-black">Rs. {walletAvailable.toLocaleString()}</p><p className="mt-1 text-[10px] text-white/55">Available balance</p><div className="mt-5 rounded-2xl bg-white/10 p-3"><p className="text-[9px] uppercase tracking-wider text-white/45">Pending approval</p><p className="mt-1 text-lg font-black">Rs. {walletPending.toLocaleString()}</p></div></div><div className="rounded-[26px] bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">How it works</p><div className="mt-4 space-y-3"><Info n="01" title="Complete an eligible mission" text="Open a task and follow its instructions."/><Info n="02" title="Admin approves your activity" text="Approved rewards are added to your wallet."/><Info n="03" title="Withdraw your earnings" text="Request a payout when your balance is ready."/></div></div></div>}
      </section>

      <footer className="sticky bottom-0 grid grid-cols-5 border-t border-black/5 bg-white/95 px-2 py-2 backdrop-blur"><Bottom href="/" label="Home" icon={<Home size={17}/>} /><Bottom href="/shop" label="Shop" icon={<ShoppingBag size={17}/>} /><Bottom href="/reseller/dashboard" label="Club" active icon={<Crown size={17}/>} /><Bottom href="/wallet" label="Wallet" icon={<WalletCards size={17}/>} /><Bottom href="/orders" label="Orders" icon={<Package size={17}/>} /></footer>
    </div>
  </main>;
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) { return <div className="rounded-2xl bg-white/[.08] p-3 ring-1 ring-white/10"><div className="flex items-center gap-1.5 text-[#FFCF68]">{icon}<span className="text-[8px] font-black uppercase tracking-wider text-white/45">{label}</span></div><p className="mt-1 text-sm font-black">{value}</p></div>; }
function TaskRow({ task }: { task: ResellerTask }) { const Icon = icons[task.icon || 'order'] || Check; return <a href={task.url || '/reseller/tasks'} target={task.url?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-[#F7F6F2] p-3 transition hover:bg-[#E9F6F2]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0F6A5F]"><Icon size={18}/></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-black">{task.title}</span><span className="mt-1 block text-[9px] text-black/45">{task.description || 'Complete this mission to earn rewards.'}</span></span><span className="text-right"><span className="block text-[10px] font-black text-[#C23B32]">Rs. {Number(task.reward || 0).toLocaleString()}</span><ChevronRight size={15} className="ml-auto mt-1 text-black/25"/></span></a>; }
function TierCard({ orders, tier, progress }: { orders: number; tier: ReturnType<typeof getTierForMonthlyOrders>; progress: ReturnType<typeof getTierProgress> }) { return <div className="rounded-[26px] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#0F6A5F]">Your tier</p><h2 className="mt-1 text-xl font-black">{tier.name} · {tier.rewardPercent}%</h2></div><Crown className="text-[#0F6A5F]"/></div><div className="mt-4 grid grid-cols-4 gap-2">{getResellerTiers().map(t => <div key={t.id} className={`rounded-xl p-2 text-center ${orders >= t.minMonthlyOrders ? 'bg-[#E5F6F1]' : 'bg-[#F7F6F2]'}`}><p className="text-[10px] font-black">{t.rewardPercent}%</p><p className="mt-1 text-[8px] text-black/40">{t.minMonthlyOrders}+</p></div>)}</div>{progress.next && <p className="mt-3 rounded-xl bg-[#FFF4D1] px-3 py-2 text-[10px] font-bold text-[#795B00]">{progress.remaining} more order{progress.remaining === 1 ? '' : 's'} to reach {progress.next.name}.</p>}</div>; }
function Info({ n, title, text }: { n: string; title: string; text: string }) { return <div className="flex gap-3"><span className="text-[10px] font-black text-[#0F6A5F]">{n}</span><div><p className="text-[11px] font-black">{title}</p><p className="mt-1 text-[10px] text-black/45">{text}</p></div></div>; }
function Bottom({ href, label, icon, active }: { href: string; label: string; icon: ReactNode; active?: boolean }) { return <Link href={href} className={`flex flex-col items-center gap-1 py-1 text-[8px] font-black ${active ? 'text-[#E1352B]' : 'text-black/35'}`}>{icon}<span>{label}</span></Link>; }
