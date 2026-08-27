'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS, type MonthlyChallengeSettings, type ResellerTask } from '@/lib/resellerTasks';

const settingsRef = doc(db, 'settings', 'main');

export default function ResellerTasksAdminPage() {
  const [tasks, setTasks] = useState<ResellerTask[]>(DEFAULT_RESELLER_TASKS);
  const [challenge, setChallenge] = useState<MonthlyChallengeSettings>(DEFAULT_MONTHLY_CHALLENGE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => onSnapshot(settingsRef, snap => {
    const data: any = snap.data() || {};
    if (Array.isArray(data.resellerTasks)) setTasks(data.resellerTasks);
    if (data.resellerMonthlyChallenge) setChallenge({ ...DEFAULT_MONTHLY_CHALLENGE, ...data.resellerMonthlyChallenge });
  }), []);

  async function save() {
    setSaving(true); setSaved(false);
    await setDoc(settingsRef, { resellerTasks: tasks, resellerMonthlyChallenge: challenge }, { merge: true });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1800);
  }

  function updateTask(id: string, patch: Partial<ResellerTask>) { setTasks(current => current.map(task => task.id === id ? { ...task, ...patch } : task)); }

  return <section className="mx-auto max-w-6xl px-4 py-5">
    <div className="mb-5 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#0F806E]">Admin Control</p><h2 className="text-2xl font-black">Reseller Tasks & Challenge</h2><p className="mt-1 text-xs text-black/45">Manage links, rewards and availability from one place.</p></div><button onClick={save} disabled={saving} className="rounded-2xl bg-[#14140F] px-4 py-3 text-[10px] font-black text-white disabled:opacity-50">{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}</button></div>
    <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <div className="space-y-3">{tasks.map(task => <div key={task.id} className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{task.title}</h3><p className="mt-1 text-xs text-black/45">{task.description}</p></div><button onClick={() => updateTask(task.id,{active:!task.active})} className={`rounded-full px-3 py-1.5 text-[9px] font-black ${task.active?'bg-[#DDF5F0] text-[#0F806E]':'bg-black/5 text-black/40'}`}>{task.active?'ON':'OFF'}</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><label className="text-[9px] font-black uppercase text-black/40">Task Link<input value={task.url||''} onChange={e=>updateTask(task.id,{url:e.target.value})} placeholder="https://..." className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-2.5 text-xs font-medium outline-none"/></label><label className="text-[9px] font-black uppercase text-black/40">Reward (Rs.)<input type="number" min="0" value={task.reward} onChange={e=>updateTask(task.id,{reward:Math.max(0,Number(e.target.value)||0)})} className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-2.5 text-xs font-medium outline-none"/></label></div></div>)}</div>
      <div className="h-fit rounded-3xl bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-[#0F806E]">Monthly Challenge</p><h3 className="mt-1 text-lg font-black">10 Order Reward</h3><div className="mt-4 space-y-3"><label className="block text-[9px] font-black uppercase text-black/40">Target Orders<input type="number" min="1" value={challenge.targetOrders} onChange={e=>setChallenge(v=>({...v,targetOrders:Math.max(1,Number(e.target.value)||1)}))} className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm outline-none"/></label><label className="block text-[9px] font-black uppercase text-black/40">Gift Title<input value={challenge.giftTitle} onChange={e=>setChallenge(v=>({...v,giftTitle:e.target.value}))} className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm outline-none"/></label><label className="block text-[9px] font-black uppercase text-black/40">Cash Option (Rs.)<input type="number" min="0" value={challenge.cashReward} onChange={e=>setChallenge(v=>({...v,cashReward:Math.max(0,Number(e.target.value)||0)}))} className="mt-1 w-full rounded-xl bg-[#F4F4F1] px-3 py-3 text-sm outline-none"/></label><button onClick={()=>setChallenge(v=>({...v,active:!v.active}))} className={`w-full rounded-xl py-3 text-[10px] font-black ${challenge.active?'bg-[#DDF5F0] text-[#0F806E]':'bg-black/5 text-black/45'}`}>Challenge {challenge.active?'ON':'OFF'}</button></div></div>
    </div>
  </section>;
}
