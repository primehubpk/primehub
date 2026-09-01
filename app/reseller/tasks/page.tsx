'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronRight, Gift, Instagram, Music2, PlayCircle, Share2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS } from '@/lib/resellerTasks';

const icons: Record<string, any> = { youtube: PlayCircle, instagram: Instagram, tiktok: Music2, 'whatsapp-share': Share2 };

export default function ResellerTasksPage() {
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [proof, setProof] = useState<Record<string,string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const challenge = DEFAULT_MONTHLY_CHALLENGE;
  const tasks = useMemo(() => DEFAULT_RESELLER_TASKS.filter(t => t.active), []);

  async function submit(taskId: string) {
    const value = String(proof[taskId] || '').trim();
    if (value.length < 3) { setMessage('Apna account name, post link, ya proof link likhein.'); return; }
    const user = auth.currentUser;
    if (!user) { window.location.href = '/login?redirect=/reseller/tasks'; return; }
    setBusy(taskId); setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/reseller/task-claims', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ taskId, proof: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Task submit nahi hua.');
      setSubmitted(current => [...current, taskId]); setMessage('Task admin review ke liye submit ho gaya. Points approval ke baad hi add honge.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Task submit nahi hua.'); } finally { setBusy(''); }
  }

  return <main className="min-h-screen bg-[#F4F4F1] px-4 py-5 text-[#15150F] sm:px-6"><div className="mx-auto max-w-md space-y-4"><Link href="/reseller/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[10px] font-black shadow-sm"><ArrowLeft size={13}/> Reseller Dashboard</Link><section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#171811] via-[#174F48] to-[#0F806E] p-6 text-white shadow-xl"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCF68] text-[#15150F]"><Gift size={23}/></div><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#FFCF68]">PrimeHub Rewards</p><h1 className="text-xl font-black">Tasks & Monthly Challenge</h1></div></div><p className="mt-4 text-[11px] leading-5 text-white/70">Social tasks are never rewarded on a simple click. Submit proof, then admin verifies it.</p></section><section className="rounded-[28px] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-widest text-[#0F806E]">Monthly Challenge</p><h2 className="mt-1 text-lg font-black">Complete {challenge.targetOrders} Orders</h2></div><div className="rounded-2xl bg-[#FFF0C8] px-3 py-2 text-center"><p className="text-[9px] font-black">CHOOSE</p><p className="text-[10px] font-black">GIFT / CASH</p></div></div></section>{message&&<p className="rounded-2xl bg-[#E7F6F3] p-3 text-[10px] font-bold text-[#0F6A5F]">{message}</p>}<section className="space-y-3"><div className="flex items-end justify-between px-1"><div><p className="text-[9px] font-black uppercase tracking-widest text-black/35">Extra Rewards</p><h2 className="text-lg font-black">Complete Tasks</h2></div><span className="rounded-full bg-[#15150F] px-3 py-1.5 text-[9px] font-black text-white">{tasks.length} ACTIVE</span></div>{tasks.map(task=>{const Icon=icons[task.id]||CheckCircle2;const done=submitted.includes(task.id);return <article key={task.id} className="rounded-[24px] bg-white p-4 shadow-sm"><div className="flex gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF7F4] text-[#0F806E]"><Icon size={21}/></div><div className="min-w-0 flex-1"><h3 className="text-sm font-black">{task.title}</h3><p className="mt-1 text-[10px] leading-4 text-black/45">{task.description}</p><input value={proof[task.id]||''} disabled={done} onChange={e=>setProof(current=>({...current,[task.id]:e.target.value}))} placeholder="Your username or proof link" className="mt-3 w-full rounded-xl bg-[#F4F4F1] px-3 py-2 text-[10px] outline-none"/><button type="button" disabled={done||busy===task.id} onClick={()=>submit(task.id)} className={`mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[9px] font-black ${done?'bg-[#E5F8F3] text-[#0F806E]':'bg-[#15150F] text-white'}`}>{done?<><CheckCircle2 size={12}/> Submitted for Review</>:busy===task.id?'Submitting…':<>Submit proof <ChevronRight size={12}/></>}</button></div></div></article>})}</section><div className="rounded-2xl bg-[#FFF3D8] p-4 text-[9px] font-bold leading-4 text-[#765400]">YouTube subscription cannot be automatically proven by a browser. PrimeHub verifies the supplied proof before points are credited.</div></div></main>;
}