'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gift, Plus, Save, Trash2, Upload, Zap, Trophy, PackageCheck, History } from 'lucide-react';
import { onSnapshot } from 'firebase/firestore';
import { uploadImageToImgBB, adminCollection, createAdminDocument, deleteAdminDocument, setAdminDocument, updateAdminDocument, writeAdminAuditLog, type Product } from './shared';

type Prize = { id:string; name:string; type:'try-again'|'points'|'coupon'|'free-delivery'; points:number; probability:number; active:boolean; stock:number; voucherCode?:string; imageUrl?:string };
type GiftReward = { id:string; title:string; productId?:string; imageUrl?:string; pointsCost:number; stock:number; active?:boolean; description?:string; mediaAssetId?:string };
type MediaAsset = { id:string; name?:string; url:string; type?:string; size?:number; createdAt?:string };
type RewardSettings = { dailySpinLimit:number; checkInRewards:number[]; pointsExpiryDays:number; guestMode:boolean; loginRequiredToRedeem:boolean; pointPresets:number[] };
const defaults:RewardSettings={dailySpinLimit:1,checkInRewards:[10,15,20,25,30,50,100],pointsExpiryDays:0,guestMode:true,loginRequiredToRedeem:true,pointPresets:[100,250,500,750,1000,1500,2500]};

export default function RewardsManager(){
 const [tab,setTab]=useState<'overview'|'wheel'|'checkin'|'store'|'redemptions'>('overview');
 const [settings,setSettings]=useState(defaults); const [prizes,setPrizes]=useState<Prize[]>([]); const [gifts,setGifts]=useState<GiftReward[]>([]); const [products,setProducts]=useState<Product[]>([]); const [mediaAssets,setMediaAssets]=useState<MediaAsset[]>([]); const [mediaPoints,setMediaPoints]=useState<Record<string,number>>({}); const [message,setMessage]=useState(''); const [saving,setSaving]=useState(false); const [uploading,setUploading]=useState(false);
 useEffect(()=>{const a=onSnapshot(adminCollection('settings'),s=>{const d=s.docs.find(x=>x.id==='rewards')?.data();if(d)setSettings({...defaults,...d,pointPresets:Array.isArray(d.pointPresets)?d.pointPresets:defaults.pointPresets} as RewardSettings)});const b=onSnapshot(adminCollection('reward_gifts'),s=>{const next=s.docs.map(d=>({id:d.id,...d.data()}) as GiftReward);setGifts(next);const map:Record<string,number>={};next.forEach(g=>{if(g.mediaAssetId)map[g.mediaAssetId]=Number(g.pointsCost||defaults.pointPresets[0])});setMediaPoints(map)});const c=onSnapshot(adminCollection('products'),s=>setProducts(s.docs.map(d=>({id:d.id,...d.data()}) as Product)));const d=onSnapshot(adminCollection('media_assets'),s=>setMediaAssets(s.docs.map(x=>({id:x.id,...x.data()}) as MediaAsset).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))));return()=>{a();b();c();d()}},[]);
 useEffect(()=>{const a=onSnapshot(adminCollection('settings'),s=>{const d=s.docs.find(x=>x.id==='rewards')?.data();const saved=d?.spinWheelSlots;if(Array.isArray(saved))setPrizes(saved.map((p:any,i:number)=>({id:String(p.id||i+1),name:String(p.name||''),type:['points','coupon','try-again','free-delivery'].includes(p.type)?p.type:'points',points:Number(p.points||p.value||0),probability:Number(p.probability||0),active:p.active!==false,stock:Number(p.stock||0),voucherCode:p.voucherCode||'',imageUrl:p.imageUrl||''})))});return()=>a()},[]);
 const total=useMemo(()=>prizes.filter(p=>p.active).reduce((n,p)=>n+Number(p.probability||0),0),[prizes]);
 async function saveSettings(){setSaving(true);setMessage('');try{await setAdminDocument('settings','rewards',{...settings,spinWheelSlots:prizes.map(({id,...p})=>p),updatedAt:new Date().toISOString()});try{await writeAdminAuditLog('update','rewards','settings',{settings,prizeCount:prizes.length})}catch(e){console.warn('Audit log skipped:',e)}setMessage('Rewards settings saved.')}catch(e){setMessage(e instanceof Error?e.message:'Save failed. Check your admin Firebase session.')}finally{setSaving(false)}}
 function addPrize(){setPrizes(x=>[...x,{id:crypto.randomUUID(),name:'Try Again',type:'try-again',points:0,probability:10,active:true,stock:0,imageUrl:''}])}
 async function addGift(){await createAdminDocument('reward_gifts',{title:'New Reward',productId:'',pointsCost:settings.pointPresets[0]||100,stock:1,active:true,description:'',imageUrl:'',createdAt:new Date().toISOString()})}
 async function saveGift(g:GiftReward){const {id,...data}=g;await updateAdminDocument('reward_gifts',id,{...data,updatedAt:new Date().toISOString()})}
async function selectProduct(g: GiftReward, productId: string) {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const img = typeof p.imageUrl === 'string' && p.imageUrl ? p.imageUrl : (typeof p.images?.[0] === 'string' ? p.images[0] : (p.images?.[0] as any)?.url || '');
    await updateAdminDocument('reward_gifts', g.id, { productId: p.id, title: p.title, imageUrl: img, updatedAt: new Date().toISOString() });
    setGifts(x => x.map(q => q.id === g.id ? { ...q, productId: p.id, title: p.title, imageUrl: img } : q));
  }
function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="rounded-2xl bg-white p-5 shadow-sm"><div className="h-5 w-5 text-[#E1352B]">{icon}</div><p className="mt-3 text-[9px] font-black uppercase tracking-wider text-black/40">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>}
function Field({label,value,onChange}:{label:string;value:number;onChange:(v:number)=>void}){return <label className="block"><span className="text-[9px] font-black uppercase tracking-wide text-black/45">{label}</span><input type="number" min="0" value={value} onChange={e=>onChange(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-black/10 bg-[#F4F4F1] px-3 py-2 text-xs font-black outline-none"/></label>}
