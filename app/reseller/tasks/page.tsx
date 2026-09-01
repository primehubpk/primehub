'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ChevronRight, Gift, Instagram, Music2, PlayCircle } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS, type ResellerTask } from '@/lib/resellerTasks';

const icons: Record<string, any> = { youtube: PlayCircle, instagram: Instagram, tiktok: Music2 };
const socialTaskIds = new Set(['youtube', 'instagram', 'tiktok']);

export default function ResellerTasksPage() {
  const [tasks, setTasks] = useState<ResellerTask[]>(DEFAULT_RESELLER_TASKS);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [proof, setProof] = useState<Record<string,string>>({});
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState('');
  const challenge = DEFAULT_MONTHLY_CHALLENGE;
  useEffect(() => onSnapshot(doc(db, 'settings', 'reseller'), snap => { const rows = snap.data()?.resellerTasks; if (Array.isArray(rows)) setTasks(rows as ResellerTask[]); }), []);
  const activeTasks = useMemo(() => tasks.filter(task => task.active), [tasks]);

  async function call(taskId:string, action:'open'|'submit') {
    const user=auth.currentUser; if(!user){window.location.href='/login?redirect=/reseller/tasks';return false;}
    const value=String(proof[taskId]||'').trim(); if(action==='submit'&&value.length<3){setMessage('Apna username ya proof link likhein.');return false;}
    const token=await user.getIdToken(); const response=await fetch('/api/reseller/task-claims',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({taskId,action,proof:value})}); const data=await response.json(); if(!response.ok) throw new Error(data.error||'Task action failed.'); return true;
  }
  async function openPlatform(task:ResellerTask){try{await call(task.id,'open');if(task.url) window.open(task.url,'_blank','noopener,noreferrer');else setMessage('Admin panel se is task ka platform link add karein.');}catch(error){setMessage(error instanceof Error?error.message:'Platform open nahi hua.');}}
  async function submit(taskId:string){setBusy(taskId);setMessage('');try{if(await call(taskId,'submit')){setSubmitted(current=>[...current,taskId]);setMessage('Proof admin review ke liye submit ho gaya. Points approval ke baad hi milenge.');}}catch(error){setMessage(error instanceof Error?error.message:'Task submit nahi hua.');}finally{setBusy('');}}

  return <main className="min-h-screen bg-[#F4F4F1] px-4 py-5 text-[#15150F] sm:px-6"><div className="mx-auto max-w-md space-y-4"><Link href="/reseller/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[10px] font-black shadow-sm"><ArrowLeft size={13}/> Reseller Dashboard</Link><section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#171811] via-[#174F48] to-[#0F806E] p-6 text-white shadow-xl"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCF68] text-[#15150F]"><Gift size={23}/></div><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#FFCF68]">PrimeHub Rewards</p><h1 className="text-xl font-black">Tasks & Monthly Challenge</h1></div></div><p className="mt-4 text-[11px] leading-5 text-white/70">Only YouTube, Instagram and TikTok need proof. Order tasks remain automatic.</p></section><section className="rounded-[28px] bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-[#0F806E]">Monthly Challenge</p><h2 className="mt-1 text-lg font-black">Complete {challenge.targetOrders} Orders</h2></section>{message&&<p className="rounded-2xl bg-[#E7F6F3] p-3 text-[10px] font-bold text-[#0F6A5F]">{message}</p>}<section className="space-y-3">{activeTasks.map(task=>{const Icon=icons[task.id]||CheckCircle2;const social=socialTaskIds.has(task.id);const done=submitted.includes(task.id);return <article key={task.id} className="rounded-[24px] bg-white p-4 shadow-sm"><div className="flex gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF7F4] text-[#0F806E]"><Icon size={21}/></div><div className="min-w-0 flex-1"><h3 className="text-sm font-black">{task.title}</h3><p className="mt-1 text-[10px] leading-4 text-black/45">{task.description}</p>{social?<><button type="button" onClick={()=>openPlatform(task)} className="mt-3 rounded-xl bg-[#15150F] px-3 py-2 text-[9px] font-black text-white">Open {task.id} <ChevronRight size={12} className="inline"/></button><input value={proof[task.id]||''} disabled={done} onChange={e=>setProof(current=>({...current,[task.id]:e.target.value}))} placeholder="Your username or proof link" className="mt-2 w-full rounded-xl bg-[#F4F4F1] px-3 py-2 text-[10px] outline-none"/><button type="button" disabled={done||busy===task.id} onClick={()=>submit(task.id)} className="mt-2 inline-flex gap-1.5 rounded-xl bg-[#0F6A5F] px-3 py-2 text-[9px] font-black text-white">{done?<><CheckCircle2 size={12}/> Submitted</>:busy===task.id?'Submitting…':'Submit proof'}</button></>:<p className="mt-3 text-[9px] font-black text-[#0F6A5F]">✓ Order progress is automatically verified.</p>}</div></div></article>})}</section><div className="rounded-2xl bg-[#FFF3D8] p-4 text-[9px] font-bold leading-4 text-[#765400]">Social task opens, submitted proofs and approved points are all saved in the admin history.</div></div></main>;
}