'use client';

import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { adminCollection, updateAdminDocument } from './shared';

type Redemption={id:string;userId:string;giftId:string;title:string;pointsCost:number;status:string;createdAt?:unknown};
const statuses=['pending','approved','processing','shipped','completed','cancelled'];
export default function RewardRedemptionQueue(){const [rows,setRows]=useState<Redemption[]>([]);useEffect(()=>onSnapshot(adminCollection('reward_redemptions'),s=>setRows(s.docs.map(d=>({id:d.id,...d.data()}) as Redemption))),[]);return <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b border-black/10 text-black/45"><tr><th className="p-4">Reward</th><th className="p-4">Customer</th><th className="p-4">Points</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-b border-black/5 last:border-0"><td className="p-4 font-black">{r.title}</td><td className="p-4 font-mono text-[10px]">{r.userId}</td><td className="p-4">{r.pointsCost}</td><td className="p-4"><span className="rounded-full bg-[#F4F4F1] px-3 py-1 text-[9px] font-black">{r.status}</span></td><td className="p-4"><select value={r.status} onChange={e=>updateAdminDocument('reward_redemptions',r.id,{status:e.target.value,updatedAt:new Date().toISOString()})} className="rounded-xl border border-black/10 px-3 py-2 text-[10px] font-black">{statuses.map(s=><option key={s}>{s}</option>)}</select></td></tr>)}{rows.length===0&&<tr><td colSpan={5} className="p-10 text-center text-black/40">No reward redemptions yet.</td></tr>}</tbody></table></div>}
