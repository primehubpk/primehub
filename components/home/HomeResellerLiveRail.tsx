"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { CheckCircle2, ChevronRight, Gift } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS, type ResellerTask } from "@/lib/resellerTasks";
import { getResellerTiers } from "@/lib/resellerTiers";
import type { ResellerProfile, ResellerTier } from "@/lib/resellerTypes";
import { useSettings } from "@/lib/useSettings";
import HomeHeading from "./HomeHeading";
import "./HomeResellerLiveRail.css";

const GUEST_WALLET_KEY = "phdeals-guest-rewards";
const GUEST_ID_KEY = "primehub_reseller_guest_id_v1";
const TASK_EVENT_KEY = "primehub_reseller_task_events_v1";
const PENDING_GUEST_PRIZE_KEY = "primehub_reseller_pending_prize_v1";

type RewardPrize = { id:string; name:string; type:string; points?:number; probability?:number; active?:boolean; stock?:number; imageUrl?:string };
type RewardSettings = { guestMode?:boolean; checkInRewards?:number[]; spinWheelSlots?:RewardPrize[] };
type RewardWallet = { points?:number; streak?:number; lastCheckIn?:string; lastSpin?:string };
type RewardGift = { id:string; title?:string; imageUrl?:string; productId?:string; pointsCost?:number; stock?:number; active?:boolean };
type RewardProduct = { id:string; title?:string; name?:string; imageUrl?:string; image?:string; images?:Array<string|{url?:string}> };
type LiveSettings = { resellerHomeEnabled?:boolean; resellerTasks?:ResellerTask[]; resellerTiers?:ResellerTier[]; resellerVoucherImages?:Record<string,string>; resellerMonthlyChallenge?:{targetOrders?:number;cashReward?:number;giftTitle?:string;active?:boolean} };
type Voucher = { id:string; title:string; description:string; requirement:string; icon:string; art:string; minOrders:number; imageUrl?:string };

function dayKey(){ return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Karachi"}).format(new Date()); }
function guestId(){ try{ let id=localStorage.getItem(GUEST_ID_KEY)||""; if(!id){id=`g_${crypto.randomUUID().replace(/-/g,"")}`;localStorage.setItem(GUEST_ID_KEY,id);} return id;}catch{return "";} }
function readGuestWallet():RewardWallet{try{return JSON.parse(localStorage.getItem(GUEST_WALLET_KEY)||"{}");}catch{return{};}}
function writeGuestWallet(v:RewardWallet){try{localStorage.setItem(GUEST_WALLET_KEY,JSON.stringify(v));}catch{}}
function readTaskEvents():string[]{try{const x=JSON.parse(localStorage.getItem(TASK_EVENT_KEY)||"[]");return Array.isArray(x)?x.map(String):[];}catch{return[];}}
function saveTaskEvent(id:string){const c=readTaskEvents();if(!c.includes(id)){try{localStorage.setItem(TASK_EVENT_KEY,JSON.stringify([...c,id]));}catch{}}}
function productImage(product?:RewardProduct){if(!product)return "";if(product.imageUrl)return product.imageUrl;if(product.image)return product.image;const first=product.images?.[0];return typeof first==="string"?first:first?.url||"";}
function premiumVoucherImage(title:string,art:string,icon:string){const safe=title.replace(/[<>&]/g,"");const svg=`<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='${art}'/><stop offset='1' stop-color='#14140F'/></linearGradient></defs><rect width='640' height='360' rx='36' fill='url(#g)'/><circle cx='540' cy='60' r='110' fill='white' opacity='.12'/><text x='52' y='142' font-size='78'>${icon}</text><text x='52' y='230' fill='white' font-size='34' font-weight='800'>${safe}</text><text x='52' y='276' fill='white' opacity='.72' font-size='18' letter-spacing='4'>PRIMEHUB PREMIUM REWARD</text></svg>`;return `data:image/svg+xml,${encodeURIComponent(svg)}`;}

export default function HomeResellerLiveRail(){
  const {settings}=useSettings();
  const fallback=settings as typeof settings & LiveSettings;
  const [live,setLive]=useState<LiveSettings>({});
  const [rewardSettings,setRewardSettings]=useState<RewardSettings>({checkInRewards:[10,15,20,25,30,50,100],spinWheelSlots:[],guestMode:true});
  const [gifts,setGifts]=useState<RewardGift[]>([]);
  const [products,setProducts]=useState<Record<string,RewardProduct>>({});
  const [user,setUser]=useState<User|null>(null);
  const [profile,setProfile]=useState<ResellerProfile|null>(null);
  const [wallet,setWallet]=useState<RewardWallet>({});
  const [events,setEvents]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [rotation,setRotation]=useState(0);
  const [message,setMessage]=useState("");

  useEffect(()=>onSnapshot(doc(db,"settings","main"),s=>setLive((s.data()||{}) as LiveSettings),()=>undefined),[]);
  useEffect(()=>onSnapshot(doc(db,"settings","rewards"),s=>{const d=s.data()||{};setRewardSettings({...d,checkInRewards:Array.isArray(d.checkInRewards)?d.checkInRewards:[10,15,20,25,30,50,100],spinWheelSlots:Array.isArray(d.spinWheelSlots)?d.spinWheelSlots:[]});},()=>undefined),[]);
  useEffect(()=>{const stopG=onSnapshot(collection(db,"reward_gifts"),s=>setGifts(s.docs.map(d=>({id:d.id,...d.data()} as RewardGift)).filter(g=>g.active!==false&&Number(g.stock??1)>0)),()=>undefined);const stopP=onSnapshot(collection(db,"products"),s=>{const next:Record<string,RewardProduct>={};s.docs.forEach(d=>{next[d.id]={id:d.id,...d.data()} as RewardProduct;});setProducts(next);},()=>undefined);return()=>{stopG();stopP();};},[]);
  useEffect(()=>{setEvents(readTaskEvents());let sp:(()=>void)|undefined;let sw:(()=>void)|undefined;const stop=onAuthStateChanged(auth,u=>{sp?.();sw?.();setUser(u);if(!u){setProfile(null);setWallet(readGuestWallet());return;}sp=onSnapshot(doc(db,"reseller_profiles",u.uid),s=>setProfile(s.exists()?s.data() as ResellerProfile:null),()=>undefined);sw=onSnapshot(doc(db,"user_rewards",u.uid),s=>setWallet(s.data()||{}),()=>undefined);});return()=>{stop();sp?.();sw?.();};},[]);

  const source:LiveSettings={...fallback,...live};
  const tasks=useMemo(()=>(source.resellerTasks?.length?source.resellerTasks:DEFAULT_RESELLER_TASKS).filter(t=>t.active!==false),[source.resellerTasks]);
  const tiers=useMemo(()=>(source.resellerTiers?.length?[...source.resellerTiers]:getResellerTiers()).sort((a,b)=>a.minMonthlyOrders-b.minMonthlyOrders),[source.resellerTiers]);
  const prizes=(rewardSettings.spinWheelSlots||[]).filter(p=>p.active!==false&&Number(p.stock??1)>0);
  const today=dayKey(); const guestWallet=typeof window!=="undefined"?readGuestWallet():{}; const usedSpin=wallet.lastSpin===today||guestWallet.lastSpin===today;
  const streak=Math.max(0,Math.min(7,Number(wallet.streak||0))); const monthlyOrders=Math.max(0,Number(profile?.monthlyOrders||0));
  const cashAvailable=Math.max(0,Number(profile?.walletAvailable||0)); const cashPending=Math.max(0,Number(profile?.walletPending||0));
  const challenge={...DEFAULT_MONTHLY_CHALLENGE,...(source.resellerMonthlyChallenge||{})}; const target=Math.max(1,Number(challenge.targetOrders||10)); const vi=source.resellerVoucherImages||{};
  const vouchers:Voucher[]=[
    {id:"cash-500",title:"Rs. 500 Cash",description:"Credit to wallet",requirement:"5 orders",icon:"₨",art:"#0E7C6F",minOrders:5,imageUrl:vi["cash-500"]},
    {id:"challenge-cash",title:`Rs. ${Number(challenge.cashReward||0).toLocaleString()} Cash`,description:"Monthly challenge",requirement:`${target} orders`,icon:"₨",art:"#127C6A",minOrders:target,imageUrl:vi["challenge-cash"]},
    {id:"challenge-gift",title:challenge.giftTitle||"PrimeHub Gift Box",description:"Surprise bangles gift",requirement:`${target} orders`,icon:"🎁",art:"#D94B3D",minOrders:target,imageUrl:vi["challenge-gift"]},
    {id:"bridal-gift",title:"Bridal Gift Voucher",description:"Free bridal pouch",requirement:"Gold tier",icon:"💍",art:"#9B2C4A",minOrders:8,imageUrl:vi["bridal-gift"]},
    {id:"wholesale-off",title:"10% Wholesale Off",description:"Next wholesale order",requirement:"3 orders",icon:"%",art:"#E85D04",minOrders:3,imageUrl:vi["wholesale-off"]},
    {id:"free-delivery",title:"Free Delivery",description:"On any one order",requirement:"2 orders",icon:"📦",art:"#1D4E89",minOrders:2,imageUrl:vi["free-delivery"]},
    {id:"jazzcash-300",title:"JazzCash Rs. 300",description:"Payout voucher",requirement:"8 orders",icon:"📱",art:"#C1121F",minOrders:8,imageUrl:vi["jazzcash-300"]},
    {id:"easypaisa-300",title:"EasyPaisa Rs. 300",description:"Payout voucher",requirement:"8 orders",icon:"📱",art:"#2A9D8F",minOrders:8,imageUrl:vi["easypaisa-300"]},
    {id:"kids-gift",title:"Kids Deal Box Gift",description:"Kids gift voucher",requirement:"6 orders",icon:"🎀",art:"#7B4B94",minOrders:6,imageUrl:vi["kids-gift"]},
    {id:"elite-cash",title:"Rs. 2,000 Elite",description:"Elite members only",requirement:"Elite 40+",icon:"👑",art:"#C9A227",minOrders:40,imageUrl:vi["elite-cash"]},
  ];
  if(source.resellerHomeEnabled===false)return null;

  async function spin(){if(busy||usedSpin||!prizes.length)return;setBusy(true);setMessage("");try{let data:any;if(user){const token=await user.getIdToken();const r=await fetch("/api/reseller/reward-action",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action:"spin",guestId:guestId()})});data=await r.json();if(!r.ok)throw new Error(data.error||"Spin failed.");}else{const r=await fetch("/api/reseller/guest-reward",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"spin",guestId:guestId()})});data=await r.json();if(!r.ok)throw new Error(data.error||"Spin failed.");const next={...guestWallet,lastSpin:data.wallet?.lastSpin||today};writeGuestWallet(next);setWallet(next);if(data.prize&&data.prize.type!=="try-again")try{localStorage.setItem(PENDING_GUEST_PRIZE_KEY,JSON.stringify(data.prize));}catch{}}const winner=Math.max(0,prizes.findIndex(p=>p.id===data?.prize?.id));setRotation(v=>v+1440+(360-winner*(360/Math.max(1,prizes.length))));setMessage(data?.prize?.name?`You got: ${data.prize.name}`:"Spin complete.");}catch(e){setMessage(e instanceof Error?e.message:"Spin failed.");}finally{setBusy(false);}}
  async function checkIn(){if(busy||wallet.lastCheckIn===today)return;setBusy(true);try{if(user){const token=await user.getIdToken();const r=await fetch("/api/reseller/reward-action",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({action:"checkin",guestId:guestId()})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Check-in failed.");}else{const y=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Karachi"}).format(new Date(Date.now()-86400000));const ns=wallet.lastCheckIn===y?Math.min(7,Number(wallet.streak||0)+1):1;const pts=Number(rewardSettings.checkInRewards?.[ns-1]||10);const next={...wallet,streak:ns,lastCheckIn:today,points:Number(wallet.points||0)+pts};writeGuestWallet(next);setWallet(next);}}catch(e){setMessage(e instanceof Error?e.message:"Check-in failed.");}finally{setBusy(false);}}
  function openTask(task:ResellerTask){if(events.includes(task.id)&&!user){location.href="/login?redirect=/#reseller-tasks";return;}if(["weekly-orders","monthly-orders","wholesale-order"].includes(task.id)){location.href="/shop";return;}const url=task.url||(task.id==="refer-reseller"?`${location.origin}/reseller/join?ref=${encodeURIComponent(user?.uid||guestId())}`:"");saveTaskEvent(task.id);setEvents(readTaskEvents());if(task.id==="whatsapp-share"||task.id==="refer-reseller"){window.open(`https://wa.me/?text=${encodeURIComponent(`${task.shareText||task.description}\n${url||location.origin}`)}`,"_blank","noopener,noreferrer");return;}if(url)window.open(url,"_blank","noopener,noreferrer");}

  const count=Math.max(1,prizes.length);
  const sliceWidth=Math.min(98,Math.max(30,Math.tan(Math.PI/count)*104));
  const topBase=2+tasks.length; const bottomBase=1+tiers.length+vouchers.length; const topGiftCount=Math.max(0,Math.min(gifts.length,Math.round((bottomBase+gifts.length-topBase)/2))); const topGifts=gifts.slice(0,topGiftCount); const bottomGifts=gifts.slice(topGiftCount);
  const GiftCard=({gift}:{gift:RewardGift})=>{const image=gift.imageUrl||productImage(gift.productId?products[gift.productId]:undefined);return <article className="ph-card ph-gift"><div className="ph-gift-art">{image?<img src={image} alt={gift.title||"Gift"}/>:<Gift size={30}/>}</div><small>POINT STORE</small><h4>{gift.title||products[gift.productId||""]?.title||products[gift.productId||""]?.name||"PrimeHub Gift"}</h4><p>{Number(gift.pointsCost||0).toLocaleString()} points</p></article>;};

  return <section className="ph-live-rail" id="reseller-home">
    <HomeHeading>Reseller Club</HomeHeading>
    <div className="ph-live-tabs"><a href="#reseller-rewards">Rewards</a><a href="#reseller-tasks">Tasks</a><a href="#reseller-wallet">Wallet</a><a href="#reseller-tiers">Tiers</a><Link href="/reseller/dashboard">Open Club</Link></div>
    <div className="ph-live-hint">Swipe → all tasks, wallet, tiers, vouchers & gifts</div>
    <div className="ph-live-scroll"><div className="ph-live-grid">
      <div className="ph-live-row">
        <article className="ph-card ph-check" id="reseller-rewards"><small>WEEKLY STREAK</small><div className="ph-title"><h3>7-Day Check-in</h3><b>{streak}/7</b></div><div className="ph-days">{Array.from({length:7},(_,i)=><span key={i} className={i<streak?"done":""}>D{i+1}<b>+{rewardSettings.checkInRewards?.[i]||0}</b></span>)}</div><button onClick={()=>void checkIn()} disabled={busy||wallet.lastCheckIn===today}><CheckCircle2 size={14}/>{wallet.lastCheckIn===today?"Done today":"Check in"}</button></article>
        <article className="ph-card ph-wheel"><small>SPIN & WIN</small><h3>Your reward wheel</h3><div className="ph-wheel-wrap"><i></i><div className="ph-wheel-disc" style={{transform:`rotate(${rotation}deg)`}}>{prizes.map((p,i)=><div className="ph-prize" key={p.id} style={{width:`${sliceWidth}%`,transform:`translate(-50%,-100%) rotate(${i*(360/count)}deg)`}}>{p.imageUrl?<img src={p.imageUrl} alt={p.name}/>:<span>🎁</span>}</div>)}<em>WIN</em></div></div><button onClick={()=>void spin()} disabled={busy||usedSpin||!prizes.length}>{usedSpin?"Come tomorrow":busy?"Spinning…":"Spin the wheel"}</button></article>
        {tasks.map((task,index)=><article className="ph-card ph-task" id={index===0?"reseller-tasks":undefined} key={task.id}><div className="ph-task-head"><span>{task.icon||"✓"}</span><b>+{Number(task.reward||0)}</b></div><h4>{task.title}</h4><p>{task.description}</p><div className="ph-task-state">{events.includes(task.id)?"Completed — login to claim":"Admin task"}</div><button onClick={()=>openTask(task)}>{events.includes(task.id)&&!user?"Login to claim":"Start task"}<ChevronRight size={12}/></button></article>)}
        {topGifts.map(g=><GiftCard key={g.id} gift={g}/>) }
      </div>
      <div className="ph-live-row">
        <article className="ph-card ph-wallet" id="reseller-wallet"><small>WALLET</small><div className="ph-wallet-grid"><div><span>CASH WALLET</span><strong>Rs. {cashAvailable.toLocaleString()}</strong><b>Pending Rs. {cashPending.toLocaleString()}</b></div><div><span>POINTS WALLET</span><strong>{Number(wallet.points||0).toLocaleString()}</strong><b>Reward points</b></div></div><Link href={user?"/reseller/wallet":"/login?redirect=/reseller/wallet"}>History & withdrawal</Link></article>
        {tiers.map((tier,index)=>{const current=monthlyOrders>=tier.minMonthlyOrders&&(index===tiers.length-1||monthlyOrders<tiers[index+1].minMonthlyOrders);const need=Math.max(0,tier.minMonthlyOrders-monthlyOrders);return <article className={`ph-card ph-tier ph-tier-${Math.min(index+1,4)} ${current?"current":""}`} id={index===0?"reseller-tiers":undefined} key={tier.id}><div className="ph-tier-top"><span>{index+1}</span>{current?<em>CURRENT</em>:null}</div><h4>{tier.name}</h4><small>{tier.minMonthlyOrders}+ monthly orders</small><div className="ph-tier-discount"><strong>{Number(tier.discountPercent||0)}%</strong><i> OFF</i></div><ul>{(tier.benefits||[]).slice(0,3).map(x=><li key={x}>✓ {x}</li>)}</ul><div className="ph-tier-status">{current?"Your current tier":need?`Need ${need} orders`:"Unlocked"}</div></article>})}
        {vouchers.map(v=>{const unlocked=monthlyOrders>=v.minOrders;const image=v.imageUrl||premiumVoucherImage(v.title,v.art,v.icon);return <article className="ph-card ph-voucher" key={v.id}><div className="ph-voucher-art"><img src={image} alt={v.title}/><span className={unlocked?"unlocked":""}>{unlocked?"Unlocked":"🔒 Locked"}</span></div><div className="ph-voucher-copy"><h4>{v.title}</h4><p>{v.description}</p><b>{v.requirement}</b></div></article>})}
        {bottomGifts.map(g=><GiftCard key={g.id} gift={g}/>) }
      </div>
    </div></div>
    {message?<div className="ph-live-message">{message}</div>:null}
  </section>;
}