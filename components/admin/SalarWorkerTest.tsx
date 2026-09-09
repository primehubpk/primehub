'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Play } from 'lucide-react';

export default function SalarWorkerTest() {
  const [job, setJob] = useState<'catalogue'|'knowledge'>('catalogue');
  const [payload, setPayload] = useState('{\n  "q": "bangles"\n}');
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState('');

  function preset(value: string) { setPayload(value); setResult(null); setError(''); }
  async function run() {
    setRunning(true); setError('');
    try {
      const parsed = JSON.parse(payload || '{}');
      const response = await fetch('/api/admin/salar/worker-test', { method:'POST', credentials:'same-origin', cache:'no-store', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ job, payload: parsed }) });
      const data = await response.json().catch(()=>null);
      if (!response.ok) throw new Error(data?.reason || data?.error || 'Worker test failed.');
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Worker test failed.'); }
    finally { setRunning(false); }
  }

  return <div className="mt-5 rounded-3xl border border-black/8 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#0F6A5F]">Admin test</p><h2 className="mt-1 text-xl font-black">Salar Worker</h2><p className="mt-2 text-xs leading-5 text-black/50">Index-only catalogue/knowledge test. Product listing does not call Groq or Gemini.</p></div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]"><select value={job} onChange={(e)=>setJob(e.target.value as any)} className="rounded-xl border border-black/10 bg-[#F4F4F1] px-3 py-3 text-xs font-bold"><option value="catalogue">catalogue</option><option value="knowledge">knowledge</option></select><div className="flex flex-wrap gap-2"><button onClick={()=>{setJob('catalogue');preset('{\n  "q": "bangles"\n}')}} className="rounded-xl bg-[#F4F4F1] px-3 py-2 text-[10px] font-black">bangles</button><button onClick={()=>{setJob('catalogue');preset('{\n  "q": "bangles",\n  "collection": "Glass"\n}')}} className="rounded-xl bg-[#F4F4F1] px-3 py-2 text-[10px] font-black">bangles + Glass</button><button onClick={()=>{setJob('knowledge');preset('{\n  "topic": "delivery"\n}')}} className="rounded-xl bg-[#F4F4F1] px-3 py-2 text-[10px] font-black">delivery</button></div></div>
    <textarea value={payload} onChange={(e)=>setPayload(e.target.value)} rows={7} spellCheck={false} className="mt-3 w-full rounded-2xl border border-black/10 bg-[#FAFAF7] p-4 font-mono text-xs outline-none focus:border-black/30"/>
    <button onClick={()=>void run()} disabled={running} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] px-4 py-3 text-xs font-black text-white disabled:opacity-50">{running?<Loader2 size={15} className="animate-spin"/>:<Play size={15}/>}Run Worker Test</button>
    {error?<p className="mt-3 rounded-xl bg-[#E1352B]/10 px-3 py-3 text-xs font-bold text-[#E1352B]">{error}</p>:null}
    {result?<div className="mt-4 overflow-hidden rounded-2xl border border-black/8"><button onClick={()=>setOpen(v=>!v)} className="flex w-full items-center gap-2 bg-[#F4F4F1] px-4 py-3 text-left text-xs font-black">{open?<ChevronDown size={14}/>:<ChevronRight size={14}/>}JSON result</button>{open?<pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-4 text-[11px] leading-5">{JSON.stringify(result,null,2)}</pre>:null}</div>:null}
  </div>;
}
