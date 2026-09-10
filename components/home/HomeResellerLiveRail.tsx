"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { DEFAULT_RESELLER_TASKS, type ResellerTask } from "@/lib/resellerTasks";
import { getResellerTiers } from "@/lib/resellerTiers";
import type { ResellerProfile, ResellerTier } from "@/lib/resellerTypes";
import { useSettings } from "@/lib/useSettings";
import HomeHeading from "./HomeHeading";
import "./HomeResellerLiveRail.css";

const GUEST_WALLET_KEY = "phdeals-guest-rewards";
const GUEST_ID_KEY = "primehub_reseller_guest_id_v1";
const TASK_EVENT_KEY = "primehub_reseller_task_events_v1";
const PENDING_GUEST_PRIZE_KEY = "primehub_reseller_pending_prize_v1";

type RewardPrize = { id: string; name: string; type: string; points?: number; probability?: number; active?: boolean; stock?: number; imageUrl?: string };
type RewardSettings = { guestMode?: boolean; checkInRewards?: number[]; spinWheelSlots?: RewardPrize[] };
type RewardWallet = { points?: number; streak?: number; lastCheckIn?: string; lastSpin?: string };
type LiveSettings = { resellerHomeEnabled?: boolean; resellerTasks?: ResellerTask[]; resellerTiers?: ResellerTier[] };

function dayKey() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()); }
function guestId() { try { let id = localStorage.getItem(GUEST_ID_KEY) || ""; if (!id) { id = `g_${crypto.randomUUID().replace(/-/g, "")}`; localStorage.setItem(GUEST_ID_KEY, id); } return id; } catch { return ""; } }
function readGuestWallet(): RewardWallet { try { return JSON.parse(localStorage.getItem(GUEST_WALLET_KEY) || "{}"); } catch { return {}; } }
function writeGuestWallet(value: RewardWallet) { try { localStorage.setItem(GUEST_WALLET_KEY, JSON.stringify(value)); } catch {} }
function readTaskEvents(): string[] { try { const x = JSON.parse(localStorage.getItem(TASK_EVENT_KEY) || "[]"); return Array.isArray(x) ? x.map(String) : []; } catch { return []; } }
function saveTaskEvent(id: string) { const current = readTaskEvents(); if (!current.includes(id)) { try { localStorage.setItem(TASK_EVENT_KEY, JSON.stringify([...current, id])); } catch {} } }

export default function HomeResellerLiveRail() {
  const { settings } = useSettings();
  const fallback = settings as typeof settings & LiveSettings;
  const [live, setLive] = useState<LiveSettings>({});
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>({ checkInRewards: [10,15,20,25,30,50,100], spinWheelSlots: [], guestMode: true });
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [wallet, setWallet] = useState<RewardWallet>({});
  const [events, setEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => onSnapshot(doc(db, "settings", "main"), snap => setLive((snap.data() || {}) as LiveSettings), () => undefined), []);
  useEffect(() => onSnapshot(doc(db, "settings", "rewards"), snap => { const d = snap.data() || {}; setRewardSettings({ ...d, checkInRewards: Array.isArray(d.checkInRewards) ? d.checkInRewards : [10,15,20,25,30,50,100], spinWheelSlots: Array.isArray(d.spinWheelSlots) ? d.spinWheelSlots : [] }); }, () => undefined), []);
  useEffect(() => { setEvents(readTaskEvents()); let stopProfile: (()=>void)|undefined; let stopWallet: (()=>void)|undefined; const stop = onAuthStateChanged(auth, current => { stopProfile?.(); stopWallet?.(); setUser(current); if (!current) { setProfile(null); setWallet(readGuestWallet()); return; } stopProfile = onSnapshot(doc(db,"reseller_profiles",current.uid), s => setProfile(s.exists() ? s.data() as ResellerProfile : null),()=>undefined); stopWallet = onSnapshot(doc(db,"user_rewards",current.uid), s => setWallet(s.data() || {}),()=>undefined); }); return () => { stop(); stopProfile?.(); stopWallet?.(); }; }, []);

  const source: LiveSettings = { ...fallback, ...live };
  const tasks = useMemo(() => (source.resellerTasks?.length ? source.resellerTasks : DEFAULT_RESELLER_TASKS).filter(t => t.active !== false), [source.resellerTasks]);
  const tiers = useMemo(() => (source.resellerTiers?.length ? [...source.resellerTiers] : getResellerTiers()).sort((a,b)=>a.minMonthlyOrders-b.minMonthlyOrders), [source.resellerTiers]);
  const prizes = (rewardSettings.spinWheelSlots || []).filter(p => p.active !== false && Number(p.stock ?? 1) > 0);
  const today = dayKey();
  const guestWallet = typeof window !== "undefined" ? readGuestWallet() : {};
  const usedSpin = wallet.lastSpin === today || guestWallet.lastSpin === today;
  const streak = Math.max(0, Math.min(7, Number(wallet.streak || 0)));
  const monthlyOrders = Math.max(0, Number(profile?.monthlyOrders || 0));
  if (source.resellerHomeEnabled === false) return null;

  async function spin() {
    if (busy || usedSpin || !prizes.length) return;
    setBusy(true); setMessage("");
    try {
      let data: any;
      if (user) {
        const token = await user.getIdToken();
        const r = await fetch("/api/reseller/reward-action", { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify({action:"spin",guestId:guestId()}) });
        data = await r.json(); if (!r.ok) throw new Error(data.error || "Spin failed.");
      } else {
        const r = await fetch("/api/reseller/guest-reward", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"spin",guestId:guestId()}) });
        data = await r.json(); if (!r.ok) throw new Error(data.error || "Spin failed.");
        const next = { ...guestWallet, lastSpin: data.wallet?.lastSpin || today }; writeGuestWallet(next); setWallet(next);
        if (data.prize && data.prize.type !== "try-again") try { localStorage.setItem(PENDING_GUEST_PRIZE_KEY, JSON.stringify(data.prize)); } catch {}
      }
      const winner = Math.max(0, prizes.findIndex(p => p.id === data?.prize?.id));
      setRotation(v => v + 1440 + (360 - winner * (360 / Math.max(1, prizes.length))));
      setMessage(data?.prize?.name ? `You got: ${data.prize.name}` : "Spin complete.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Spin failed."); }
    finally { setBusy(false); }
  }

  async function checkIn() {
    if (busy || wallet.lastCheckIn === today) return;
    setBusy(true); setMessage("");
    try {
      if (user) {
        const token = await user.getIdToken(); const r = await fetch("/api/reseller/reward-action", { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify({action:"checkin",guestId:guestId()}) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Check-in failed.");
      } else {
        const yesterday = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Karachi"}).format(new Date(Date.now()-86400000));
        const nextStreak = wallet.lastCheckIn === yesterday ? Math.min(7, Number(wallet.streak || 0)+1) : 1;
        const pts = Number(rewardSettings.checkInRewards?.[nextStreak-1] || 10);
        const next = { ...wallet, streak:nextStreak, lastCheckIn:today, points:Number(wallet.points||0)+pts }; writeGuestWallet(next); setWallet(next);
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Check-in failed."); }
    finally { setBusy(false); }
  }

  function openTask(task: ResellerTask) {
    if (events.includes(task.id) && !user) { window.location.href = "/login?redirect=/#reseller-tasks"; return; }
    if (["weekly-orders","monthly-orders","wholesale-order"].includes(task.id)) { window.location.href = "/shop"; return; }
    const url = task.url || (task.id === "refer-reseller" ? `${window.location.origin}/reseller/join?ref=${encodeURIComponent(user?.uid || guestId())}` : "");
    saveTaskEvent(task.id); setEvents(readTaskEvents());
    if (task.id === "whatsapp-share" || task.id === "refer-reseller") { const text = `${task.shareText || task.description}\n${url || window.location.origin}`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer"); return; }
    if (url) window.open(url,"_blank","noopener,noreferrer");
  }

  const imageSize = prizes.length <= 2 ? 48 : prizes.length === 3 ? 42 : prizes.length === 4 ? 38 : prizes.length === 5 ? 34 : prizes.length <= 7 ? 30 : 26;
  const radius = prizes.length <= 3 ? 29 : prizes.length <= 5 ? 33 : 35;

  return <section className="ph-live-rail" id="reseller-home">
    <HomeHeading>Reseller Club</HomeHeading>
    <div className="ph-live-tabs"><a href="#reseller-rewards">Rewards</a><a href="#reseller-tasks">Tasks</a><a href="#reseller-tiers">Tiers</a><Link href="/reseller/dashboard">Open Club</Link></div>
    <div className="ph-live-hint">Swipe → all admin tasks, tiers & rewards</div>
    <div className="ph-live-scroll"><div className="ph-live-grid">
      <div className="ph-live-row">
        <article className="ph-card ph-check" id="reseller-rewards"><small>WEEKLY STREAK</small><div className="ph-title"><h3>7-Day Check-in</h3><b>{streak}/7</b></div><div className="ph-days">{Array.from({length:7},(_,i)=><span key={i} className={i<streak?"done":""}>D{i+1}<b>+{rewardSettings.checkInRewards?.[i] || 0}</b></span>)}</div><button onClick={()=>void checkIn()} disabled={busy || wallet.lastCheckIn===today}><CheckCircle2 size={14}/>{wallet.lastCheckIn===today?"Done today":"Check in"}</button></article>
        <article className="ph-card ph-wheel"><small>SPIN & WIN</small><h3>Your reward wheel</h3><div className="ph-wheel-wrap"><i></i><div className="ph-wheel-disc" style={{transform:`rotate(${rotation}deg)`}}>{prizes.map((p,i)=>{const angle=i*(360/Math.max(1,prizes.length))+(180/Math.max(1,prizes.length));return <div className="ph-prize" key={p.id} style={{transform:`translate(-50%,-50%) rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)`,width:imageSize,height:imageSize}}>{p.imageUrl?<img src={p.imageUrl} alt={p.name}/>:<span>🎁</span>}</div>})}<em>WIN</em></div></div><button onClick={()=>void spin()} disabled={busy||usedSpin||!prizes.length}>{usedSpin?"Come tomorrow":busy?"Spinning…":"Spin the wheel"}</button></article>
        {tasks.map((task,index)=><article className="ph-card ph-task" id={index===0?"reseller-tasks":undefined} key={task.id}><div className="ph-task-head"><span>{task.icon || "✓"}</span><b>+{Number(task.reward||0)}</b></div><h4>{task.title}</h4><p>{task.description}</p><div className="ph-task-state">{events.includes(task.id)?"Completed — login to claim":"Admin task"}</div><button onClick={()=>openTask(task)}>{events.includes(task.id)&&!user?"Login to claim":"Start task"}<ChevronRight size={12}/></button></article>)}
      </div>
      <div className="ph-live-row">
        {tiers.map((tier,index)=>{const current=monthlyOrders>=tier.minMonthlyOrders&&(index===tiers.length-1||monthlyOrders<tiers[index+1].minMonthlyOrders);return <article className={`ph-card ph-tier ${current?"current":""}`} id={index===0?"reseller-tiers":undefined} key={tier.id}><span className="ph-tier-no">{index+1}</span><small>{current?"CURRENT":`${tier.minMonthlyOrders}+ orders`}</small><h4>{tier.name}</h4><strong>{Number(tier.discountPercent||0)}%</strong><em>OFF</em>{tier.benefits?.length?<p>{tier.benefits[0]}</p>:null}</article>})}
      </div>
    </div></div>
    {message?<div className="ph-live-message">{message}</div>:null}
  </section>;
}
