'use client';

import { useEffect, useState } from 'react';
import { Loader2, Radio, ShieldCheck } from 'lucide-react';
import SalarChats from './SalarChats';
import SalarBrainFiles from './SalarBrainFiles';
import SalarCatalogueRefresh from './SalarCatalogueRefresh';
import SalarWorkerTest from './SalarWorkerTest';

export default function SalarManager() {
  const [loading, setLoading] = useState(true); const [pinging, setPinging] = useState(false); const [status, setStatus] = useState('');
  useEffect(() => { fetch('/api/admin/salar/settings', { credentials: 'same-origin', cache: 'no-store' }).then(async r=>{const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.error||'Unable to load Salar setting.');setStatus(d?.preview_enabled===true?'Public preview active on feature/salar. Main branch is unchanged.':d?.salar_public_enabled===true?'Salar public setting is ON.':'Salar is private outside the approved preview.');}).catch(e=>setStatus(e instanceof Error?e.message:'Unable to load Salar setting.')).finally(()=>setLoading(false)); }, []);
  async function pingProvider(){setPinging(true);setStatus('');try{const r=await fetch('/api/admin/salar/ping',{method:'POST',credentials:'same-origin',cache:'no-store'});const d=await r.json().catch(()=>null);if(!r.ok||d?.ok!==true)throw new Error(d?.error||'Salar ping failed.');setStatus(`Provider ping OK: ${d.provider} / ${d.model} / key slot ${Number(d.keyIndex)+1}.`);}catch(e){setStatus(e instanceof Error?e.message:'Salar ping failed.');}finally{setPinging(false);}}
  if(loading)return <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-black/50">Loading Salar settings…</div>;
  return <section className="mx-auto max-w-5xl px-4 py-7 sm:px-6"><div className="rounded-3xl border border-black/8 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#0F6A5F]/10 text-[#0F6A5F]"><ShieldCheck size={20}/></div><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#E1352B]">Visibility</p><h2 className="mt-1 text-xl font-black">Public preview testing</h2><p className="mt-2 text-xs leading-5 text-black/55">feature/salar preview par Salar public hai. Main branch aur production deployment is change se untouched hain.</p></div></div><button onClick={()=>void pingProvider()} disabled={pinging} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F4F4F1] px-4 py-3 text-xs font-black disabled:opacity-50">{pinging?<Loader2 size={15} className="animate-spin"/>:<Radio size={15}/>}Test active AI provider</button>{status?<p className="mt-4 rounded-xl bg-[#F4F4F1] px-3 py-3 text-xs font-semibold">{status}</p>:null}</div><SalarBrainFiles/><SalarCatalogueRefresh/><SalarWorkerTest/><SalarChats/></section>;
}
