'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { Gift, LogIn, Sparkles } from 'lucide-react';
import { auth, db } from '@/lib/firebase';

type Reward={productId?:string;pointsCost?:number;active?:boolean;stock?:number};
const GUEST_KEY='phdeals-guest-rewards';

export default function ProductRewardInfo({productId}:{productId:string}){
 const [required,setRequired]=useState<number|null>(null);const [stock,setStock]=useState(0);const [points,setPoints]=useState(0);const [uid,setUid]=useState<string|null>(null);
 useEffect(()=>{const r=onSnapshot(collection(db,'reward_gifts'),s=>{const found=s.docs.map(d=>d.data() as Reward).find(x=>x.active!==false&&x.productId===productId&&Number(x.pointsCost)>0);setRequired(found?Number(found.pointsCost):null);setStock(Number(found?.stock??0))});return()=>r()},[productId]);
 useEffect(()=>{let stop=()=>{};const a=onAuthStateChanged(auth,u=>{stop();setUid(u?.uid||null);if(u)stop=onSnapshot(doc(db,'user_rewards',u.uid),s=>setPoints(Number(s.data()?.points||0)));else{try{setPoints(Number(JSON.parse(localStorage.getItem(GUEST_KEY)||'{}')?.points||0))}catch{setPoints(0)}}});return()=>{a();stop()}},[]);
 if(!required)return null;
 const need=Math.max(0,required-points);const can=need===0&&stock!==0;
 return <section className="mx-3 mt-3 rounded-[24px] border border-[#FFB020]/35 bg-gradient-to-r from-[#FFF8E8] to-white p-4 shadow-sm md:mx-5"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#14140F] text-[#FFB020]"><Gift size={19}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#14140F] px-2.5 py-1 text-[9px] font-black text-white">FREE REWARD</span><span className="text-[10px] font-black text-[#0F6A5F]">{required} POINTS REQUIRED</span></div><p className="mt-2 text-sm font-black text-[#14140F]">This product can be claimed with {required} points.</p><p className="mt-1 text-[10px] font-bold text-black/50">You have {points} points{need>0?` • Need ${need} more points`:can?' • You can redeem it now':''}</p>{stock===0&&<p className="mt-1 text-[10px] font-black text-[#E1352B]">Currently out of stock</p>}<div className="mt-3 flex flex-wrap gap-2">{need>0?<Link href="/rewards" className="inline-flex items-center gap-1.5 rounded-xl bg-[#E1352B] px-3 py-2 text-[10px] font-black text-white"><Sparkles size={12}/>Earn {need} More Points</Link>:<Link href="/rewards#redeem-rewards" className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F6A5F] px-3 py-2 text-[10px] font-black text-white">Redeem This Gift</Link>}{!uid&&<Link href="/login?redirect=/rewards" className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-[10px] font-black"><LogIn size={12}/>Login to save points</Link>}</div></div></div></section>;
}
