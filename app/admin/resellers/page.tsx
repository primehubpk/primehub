'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Coins,
  Gift,
  History,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

const money = (value: unknown) => `Rs. ${Number(value || 0).toLocaleString()}`;

function dateValue(value: unknown) {
  if (!value) return 0;
  if (typeof value === 'object') {
    const row = value as { seconds?: number; _seconds?: number };
    const seconds = Number(row.seconds ?? row._seconds ?? 0);
    if (seconds) return seconds * 1000;
  }
  const parsed = new Date(value as string | number | Date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function prettyDate(value: unknown) {
  const time = dateValue(value);
  if (!time) return 'Date unavailable';
  try {
    return new Intl.DateTimeFormat('en-PK', {
      timeZone: 'Asia/Karachi',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(time));
  } catch {
    return new Date(time).toLocaleString();
  }
}

function memberLabel(profile: any) {
  const displayName = String(profile?.displayName || '').trim();
  if (displayName) return displayName;
  const email = String(profile?.email || '').trim();
  return email || String(profile?.id || 'Reseller');
}

function userIdOf(row: any) {
  return String(row?.userId || row?.resellerUserId || '');
}

type ActivityItem = {
  id: string;
  time: number;
  date: unknown;
  title: string;
  detail: string;
  badge: string;
  tone: string;
};

export default function AdminResellersPage() {
  const [data, setData] = useState<any>({ stats: {}, profiles: [], withdrawals: [], ledger: [], claims: [], pointHistory: [], taskEvents: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/reseller-management', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Unable to load reseller data.');
      setData(result || {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load reseller data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(id: string, action: 'approve' | 'reject' | 'paid', kind = 'withdrawal') {
    setBusy(`${id}:${action}`);
    setError('');
    try {
      const response = await fetch('/api/admin/reseller-management', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, kind }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Action failed.');
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed.');
    } finally {
      setBusy('');
    }
  }

  const profiles = Array.isArray(data.profiles) ? data.profiles : [];
  const filteredProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter((profile: any) => [profile.displayName, profile.email, profile.id, profile.tierId, profile.status].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [profiles, search]);

  const stats = data.stats || {};
  const totalPoints = Number(stats.totalPoints || profiles.reduce((sum: number, profile: any) => sum + Number(profile.pointsBalance || 0), 0));
  const trackedMonthlyOrders = Number(stats.trackedMonthlyOrders || profiles.reduce((sum: number, profile: any) => sum + Number(profile.monthlyOrders || 0), 0));

  const selectedActivity = useMemo<ActivityItem[]>(() => {
    if (!selectedMember) return [];
    const userId = String(selectedMember.id || selectedMember.userId || '');
    const rows: ActivityItem[] = [];

    for (const item of Array.isArray(data.pointHistory) ? data.pointHistory : []) {
      if (userIdOf(item) !== userId) continue;
      rows.push({
        id: `points-${item.id}`,
        time: dateValue(item.createdAt),
        date: item.createdAt,
        title: item.reason || item.taskId || 'Reward points',
        detail: item.status ? `Point status: ${item.status}` : 'Points recorded',
        badge: `+${Number(item.points || 0)} pts`,
        tone: 'bg-[#E7F6F3] text-[#0F6A5F]',
      });
    }

    for (const item of Array.isArray(data.ledger) ? data.ledger : []) {
      if (userIdOf(item) !== userId) continue;
      rows.push({
        id: `reward-${item.id}`,
        time: dateValue(item.createdAt),
        date: item.createdAt,
        title: `Order reward${item.orderId ? ` · #${String(item.orderId).slice(-6)}` : ''}`,
        detail: `Reward status: ${item.status || 'pending'}`,
        badge: money(item.rewardAmount),
        tone: 'bg-amber-50 text-amber-700',
      });
    }

    for (const item of Array.isArray(data.taskEvents) ? data.taskEvents : []) {
      if (userIdOf(item) !== userId) continue;
      rows.push({
        id: `task-${item.id}`,
        time: dateValue(item.createdAt),
        date: item.createdAt,
        title: `${item.taskId || 'Task'} ${item.event || 'activity'}`,
        detail: 'Reseller task activity',
        badge: 'Task',
        tone: 'bg-violet-50 text-violet-700',
      });
    }

    for (const item of Array.isArray(data.claims) ? data.claims : []) {
      if (userIdOf(item) !== userId) continue;
      rows.push({
        id: `claim-${item.id}`,
        time: dateValue(item.createdAt),
        date: item.createdAt,
        title: `${item.taskId || 'Task'} proof submitted`,
        detail: `Claim status: ${item.status || 'pending'}`,
        badge: item.points ? `${item.points} pts` : 'Proof',
        tone: 'bg-sky-50 text-sky-700',
      });
    }

    for (const item of Array.isArray(data.withdrawals) ? data.withdrawals : []) {
      if (userIdOf(item) !== userId) continue;
      rows.push({
        id: `withdrawal-${item.id}`,
        time: dateValue(item.createdAt),
        date: item.createdAt,
        title: 'Withdrawal request',
        detail: `${item.method || 'Payout'} · ${item.status || 'pending'}`,
        badge: money(item.amount),
        tone: 'bg-rose-50 text-rose-700',
      });
    }

    for (const item of Array.isArray(data.orders) ? data.orders : []) {
      if (userIdOf(item) !== userId) continue;
      rows.push({
        id: `order-${item.id}`,
        time: dateValue(item.createdAt),
        date: item.createdAt,
        title: `Reseller order #${String(item.id).slice(-6)}`,
        detail: `Order status: ${item.status || 'pending'}`,
        badge: money(item.total),
        tone: 'bg-[#F4F4F1] text-[#14140F]',
      });
    }

    return rows.sort((a, b) => b.time - a.time);
  }, [data, selectedMember]);

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-24 text-[#14140F]">
      <section className="sticky top-0 z-30 border-b border-black/8 bg-white/95 px-3 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-full bg-[#F4F4F1] px-3 py-2.5 text-[10px] font-black"><ArrowLeft size={13}/> Admin</Link>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-[#14140F] px-3.5 py-2.5 text-[10px] font-black text-white disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh</button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-[#F4F4F1] p-1.5">
            <Link href="/admin/reseller-tasks" className="rounded-xl px-2 py-2.5 text-center text-[9px] font-black text-black/50">Tasks & Club</Link>
            <Link href="/admin/reseller-tasks?view=rewards" className="rounded-xl px-2 py-2.5 text-center text-[9px] font-black text-black/50">Wheel & Rewards</Link>
            <div className="rounded-xl bg-[#14140F] px-2 py-2 text-center text-white shadow-sm">
              <div className="flex items-center justify-center gap-1 text-[9px] font-black"><Users size={12}/> Members</div>
              <p className="mt-0.5 text-[7px] font-bold text-white/55">{stats.resellers || 0} active · {totalPoints.toLocaleString()} pts</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="overflow-hidden rounded-[30px] bg-[#14140F] p-5 text-white sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#FFCF68]">Reseller Intelligence</p>
              <h1 className="mt-1 text-2xl font-black sm:text-3xl">Members & history</h1>
              <p className="mt-2 max-w-xl text-xs leading-5 text-white/55">Active resellers, points, monthly orders, wallets, task activity and reward history in one mobile-friendly place.</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Sparkles size={20}/></div>
          </div>
          {data.warning ? <div className="mt-4 rounded-2xl bg-amber-300/10 px-3 py-2 text-[9px] font-semibold text-amber-100">{data.warning}</div> : null}
        </div>

        {error ? <div className="mt-3 rounded-2xl bg-[#E1352B]/10 p-3 text-[10px] font-bold text-[#B82B23]">{error}</div> : null}

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat title="Active Resellers" value={stats.resellers || 0} icon={Users} />
          <Stat title="Total Points" value={totalPoints.toLocaleString()} icon={Coins} />
          <Stat title="Orders This Month" value={trackedMonthlyOrders} icon={PackageCheck} />
          <Stat title="Wallet Liability" value={money(stats.walletLiability)} icon={WalletCards} />
        </div>

        <section className="mt-4 rounded-[26px] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#E1352B]">Members</p>
              <h2 className="mt-1 text-xl font-black">Reseller members</h2>
              <p className="mt-1 text-[10px] text-black/40">Tap History to see exactly when points, rewards, tasks and orders were recorded.</p>
            </div>
            <span className="rounded-full bg-[#DDF5F0] px-3 py-1.5 text-[9px] font-black text-[#0F6A5F]">{filteredProfiles.length} shown</span>
          </div>

          <label className="mt-4 flex items-center gap-2 rounded-2xl bg-[#F4F4F1] px-3 py-3">
            <Search size={15} className="text-black/35" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reseller, email or tier" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
          </label>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {loading ? <p className="rounded-2xl bg-[#F4F4F1] p-4 text-[10px] text-black/40">Loading reseller members…</p> : null}
            {!loading && filteredProfiles.length === 0 ? <p className="rounded-2xl bg-[#F4F4F1] p-4 text-[10px] text-black/40">No reseller profiles found.</p> : null}
            {filteredProfiles.map((profile: any) => (
              <article key={profile.id} className="rounded-[22px] border border-black/6 bg-[#FAFAF8] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase ${profile.status === 'active' ? 'bg-[#DDF5F0] text-[#0F6A5F]' : 'bg-black/5 text-black/40'}`}>{profile.status || 'active'}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase ring-1 ring-black/5">{profile.tierId || 'starter'}</span>
                    </div>
                    <h3 className="mt-2 break-words text-sm font-black">{memberLabel(profile)}</h3>
                    {profile.displayName && profile.email ? <p className="mt-1 break-all text-[9px] text-black/40">{profile.email}</p> : null}
                  </div>
                  <button type="button" onClick={() => setSelectedMember(profile)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#14140F] px-3 py-2.5 text-[9px] font-black text-white"><History size={13}/> History</button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniStat label="Points" value={Number(profile.pointsBalance || 0).toLocaleString()} />
                  <MiniStat label="Month Orders" value={Number(profile.monthlyOrders || 0).toLocaleString()} />
                  <MiniStat label="Available" value={money(profile.walletAvailable)} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 text-[9px]">
                  <span className="font-semibold text-black/40">Pending wallet</span>
                  <b>{money(profile.walletPending)}</b>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ApprovalsPanel title="Withdrawal Requests" count={(data.withdrawals || []).filter((item: any) => item.status === 'pending').length} icon={<Banknote size={16}/>}>
            {(data.withdrawals || []).length === 0 ? <Empty text="No withdrawal requests yet." /> : (data.withdrawals || []).map((item: any) => (
              <div key={item.id} className="rounded-2xl bg-[#F4F4F1] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-xs font-black">{money(item.amount)}</p><p className="mt-1 break-all text-[9px] text-black/45">{item.method || 'Payout'} · {item.userId}</p><p className="mt-1 text-[8px] font-black uppercase text-black/30">{item.status}</p></div>
                  <div className="flex shrink-0 gap-1.5">{item.status === 'pending' ? <><button disabled={Boolean(busy)} onClick={() => void review(item.id, 'approve')} className="rounded-lg bg-[#0F6A5F] px-2.5 py-2 text-[8px] font-black text-white">Approve</button><button disabled={Boolean(busy)} onClick={() => void review(item.id, 'reject')} className="rounded-lg bg-red-50 px-2.5 py-2 text-[8px] font-black text-red-700">Reject</button></> : item.status === 'approved' ? <button disabled={Boolean(busy)} onClick={() => void review(item.id, 'paid')} className="rounded-lg bg-[#14140F] px-2.5 py-2 text-[8px] font-black text-white">Mark Paid</button> : null}</div>
                </div>
              </div>
            ))}
          </ApprovalsPanel>

          <ApprovalsPanel title="Task Proof Review" count={(data.claims || []).filter((item: any) => item.status === 'pending').length} icon={<CheckCircle2 size={16}/>}>
            {(data.claims || []).length === 0 ? <Empty text="No task proof submitted yet." /> : (data.claims || []).map((item: any) => (
              <div key={item.id} className="rounded-2xl bg-[#F4F4F1] p-3">
                <p className="text-[10px] font-black">{item.taskId || 'Task'} · {item.userId}</p>
                <p className="mt-1 break-all text-[9px] text-black/45">{item.proof || 'No proof text'}</p>
                <p className="mt-1 text-[8px] font-black uppercase text-black/30">{item.status}</p>
                {item.status === 'pending' ? <div className="mt-2 flex gap-2"><button disabled={Boolean(busy)} onClick={() => void review(item.id, 'approve', 'task')} className="rounded-lg bg-[#0F6A5F] px-3 py-2 text-[8px] font-black text-white">Approve points</button><button disabled={Boolean(busy)} onClick={() => void review(item.id, 'reject', 'task')} className="rounded-lg bg-red-50 px-3 py-2 text-[8px] font-black text-red-700">Reject</button></div> : null}
              </div>
            ))}
          </ApprovalsPanel>
        </div>

        <div className="mt-4 rounded-[24px] border border-[#0F6A5F]/10 bg-[#0F6A5F]/5 p-4 text-[10px] leading-5 text-black/50">
          <div className="flex items-center gap-2 font-black text-[#14140F]"><ShieldCheck size={15} className="text-[#0F6A5F]"/> Admin-only control</div>
          <p className="mt-1">Member reads are Supabase-first. Reward, task and payout history stays attached to the reseller account and opens from the History button.</p>
        </div>
      </section>

      {selectedMember ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[250] flex items-end justify-center bg-black/55 p-2 sm:items-center sm:p-4" onClick={() => setSelectedMember(null)}>
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-white p-4 shadow-2xl sm:rounded-[30px] sm:p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[.18em] text-[#0F6A5F]">Member History</p>
                <h2 className="mt-1 break-words text-xl font-black">{memberLabel(selectedMember)}</h2>
                <p className="mt-1 break-all text-[9px] text-black/40">{selectedMember.email || selectedMember.id}</p>
              </div>
              <button type="button" onClick={() => setSelectedMember(null)} className="rounded-full bg-[#F4F4F1] p-2.5" aria-label="Close history"><X size={16}/></button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Points" value={Number(selectedMember.pointsBalance || 0).toLocaleString()} strong />
              <MiniStat label="Month Orders" value={Number(selectedMember.monthlyOrders || 0).toLocaleString()} strong />
              <MiniStat label="Available" value={money(selectedMember.walletAvailable)} strong />
              <MiniStat label="Pending" value={money(selectedMember.walletPending)} strong />
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl bg-[#F7F7F3] p-3 text-[10px] sm:grid-cols-2">
              <div><span className="font-semibold text-black/35">Tier</span><p className="mt-0.5 font-black capitalize">{selectedMember.tierId || 'starter'}</p></div>
              <div><span className="font-semibold text-black/35">Status</span><p className="mt-0.5 font-black capitalize">{selectedMember.status || 'active'}</p></div>
              <div><span className="font-semibold text-black/35">Joined</span><p className="mt-0.5 font-black">{prettyDate(selectedMember.createdAt)}</p></div>
              <div><span className="font-semibold text-black/35">Account ID</span><p className="mt-0.5 break-all font-black">{selectedMember.id}</p></div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#E1352B]">Timeline</p><h3 className="mt-1 text-sm font-black">All recorded activity</h3></div><span className="rounded-full bg-[#F4F4F1] px-2.5 py-1 text-[8px] font-black text-black/40">{selectedActivity.length} events</span></div>

            <div className="mt-3 space-y-2">
              {selectedActivity.length === 0 ? <Empty text="No reward, point, task, withdrawal or reseller order activity has been recorded for this member yet." /> : selectedActivity.map((item) => (
                <div key={item.id} className="rounded-2xl border border-black/6 p-3">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black">{item.title}</p><p className="mt-1 text-[9px] text-black/45">{item.detail}</p><p className="mt-1 text-[8px] font-semibold text-black/30">{prettyDate(item.date)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-black ${item.tone}`}>{item.badge}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Stat({ title, value, icon: Icon }: { title: string; value: React.ReactNode; icon: any }) {
  return <div className="rounded-[24px] bg-white p-4 shadow-sm"><Icon size={18} className="text-[#0F6A5F]"/><p className="mt-3 text-[8px] font-black uppercase tracking-wider text-black/35">{title}</p><p className="mt-1 break-words text-lg font-black sm:text-xl">{value}</p></div>;
}

function MiniStat({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return <div className={`rounded-xl bg-white p-2.5 ring-1 ring-black/5 ${strong ? 'min-h-[72px]' : ''}`}><p className="text-[7px] font-black uppercase tracking-wide text-black/30">{label}</p><p className="mt-1 break-words text-[10px] font-black">{value}</p></div>;
}

function ApprovalsPanel({ title, count, icon, children }: { title: string; count: number; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-[26px] bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[#0F6A5F]">{icon}<h2 className="text-sm font-black text-[#14140F]">{title}</h2></div><span className="rounded-full bg-[#F4F4F1] px-2.5 py-1 text-[8px] font-black text-black/40">{count} pending</span></div><div className="mt-3 space-y-2">{children}</div></section>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl bg-[#F4F4F1] p-4 text-[10px] leading-5 text-black/40">{text}</div>;
}
