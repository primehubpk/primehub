'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { setAdminDocument } from './shared';

const DEFAULT_TERMS='Points have no cash value. Required points are shown on eligible rewards. Points are deducted only after a successful redemption. Rewards are subject to stock and availability. Guests can earn rewards on this device, but login is required to redeem. Spin and check-in limits are controlled by PrimeHub. PrimeHub may change reward availability, point requirements, or reward rules.';

export default function RewardsTermsManager(){
 const [terms,setTerms]=useState(DEFAULT_TERMS);const [saving,setSaving]=useState(false);const [message,setMessage]=useState('');
 useEffect(()=>onSnapshot(doc(db,'settings','rewards'),s=>{const v=s.data()?.termsAndConditions;if(typeof v==='string'&&v.trim())setTerms(v)}),[]);
 async function save(){setSaving(true);setMessage('');try{await setAdminDocument('settings','rewards',{termsAndConditions:terms.trim(),updatedAt:new Date().toISOString()});setMessage('Reward terms saved.')}catch(e){setMessage(e instanceof Error?e.message:'Could not save terms.')}finally{setSaving(false)}}
 return <section className="mx-auto max-w-6xl px-4 pb-8 md:px-6"><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#E1352B]">Customer policy</p><h3 className="mt-1 text-lg font-black">Rewards Terms & Conditions</h3><p className="mt-1 text-xs text-black/45">This text appears below Rewards for customers. Keep the rules clear and customer-friendly.</p><textarea value={terms} onChange={e=>setTerms(e.target.value)} rows={7} className="mt-4 w-full rounded-2xl border border-black/10 bg-[#F4F4F1] p-4 text-xs leading-5 outline-none"/>{message&&<p className="mt-3 rounded-xl bg-[#E8F5F2] p-3 text-xs font-black text-[#0F6A5F]">{message}</p>}<button onClick={save} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white"><Save size={14}/>{saving?'Saving...':'Save Terms'}</button></div></section>;
}
