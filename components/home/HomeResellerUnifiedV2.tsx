"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { ArrowRight, CheckCircle2, ChevronRight, Gift, History, Instagram, Music2, PlayCircle, Share2, WalletCards } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS, type MonthlyChallengeSettings, type ResellerTask } from "@/lib/resellerTasks";
import { getResellerTiers } from "@/lib/resellerTiers";
import type { ResellerProfile, ResellerTier } from "@/lib/resellerTypes";
import { useSettings } from "@/lib/useSettings";
import HomeHeading from "./HomeHeading";

const GUEST_KEY = "phdeals-guest-rewards";
const GUEST_ID_KEY = "primehub_reseller_guest_id_v1";
const ORDER_PROGRESS_KEY = "primehub_reseller_order_progress_v1";
const TASK_EVENT_KEY = "primehub_reseller_task_events_v1";
const PENDING_GUEST_PRIZE_KEY = "primehub_reseller_pending_prize_v1";
const SOCIAL_TASK_IDS = new Set(["youtube", "instagram", "tiktok"]);
const CASH_TASK_IDS = new Set(["weekly-orders", "monthly-orders"]);
const EMPTY_WALLET: RewardWallet = { points: 0, streak: 0, coupons: [], freeDeliveryCredits: 0 };
const DEFAULT_REWARD_SETTINGS: RewardSettings = { guestMode: true, checkInRewards: [10, 15, 20, 25, 30, 50, 100], spinWheelSlots: [] };

type RewardWallet = { points: number; streak: number; lastCheckIn?: string; lastSpin?: string; coupons?: string[]; freeDeliveryCredits?: number; history?: unknown[] };
type RewardPrize = { id: string; name: string; type: string; points?: number; probability?: number; active?: boolean; stock?: number; productId?: string; voucherCode?: string; voucherAmount?: number; imageUrl?: string };
type RewardSettings = { guestMode?: boolean; checkInRewards?: number[]; spinWheelSlots?: RewardPrize[] };
type RewardGift = { id: string; productId?: string; pointsCost: number; active?: boolean; stock?: number; imageUrl?: string; title?: string };
type HomeSettings = { resellerHomeEnabled?: boolean; resellerTasks?: ResellerTask[]; resellerTiers?: ResellerTier[]; resellerMonthlyChallenge?: Partial<MonthlyChallengeSettings>; resellerVoucherImages?: Record<string, string> };
type Voucher = { id: string; title: string; description: string; requirement: string; art: string; icon: string; minOrders: number; imageUrl?: string };
type OrderProgress = { orderId: string; createdAt: string; wholesale?: boolean };

function dayKey() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()); }
function sleep(ms: number) { return new Promise(resolve => window.setTimeout(resolve, ms)); }
function readGuestWallet(): RewardWallet { try { const raw = window.localStorage.getItem(GUEST_KEY); return raw ? { ...EMPTY_WALLET, ...JSON.parse(raw) } : EMPTY_WALLET; } catch { return EMPTY_WALLET; } }
function saveGuestWallet(wallet: RewardWallet) { try { window.localStorage.setItem(GUEST_KEY, JSON.stringify(wallet)); } catch {} }
function guestId() { try { let id = window.localStorage.getItem(GUEST_ID_KEY) || ""; if (!id) { id = `g_${crypto.randomUUID().replace(/-/g, "")}`; window.localStorage.setItem(GUEST_ID_KEY, id); } return id; } catch { return ""; } }
function readOrders(): OrderProgress[] { try { const parsed = JSON.parse(window.localStorage.getItem(ORDER_PROGRESS_KEY) || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function readTaskEvents(): string[] { try { const parsed = JSON.parse(window.localStorage.getItem(TASK_EVENT_KEY) || "[]"); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }
function saveTaskEvent(taskId: string) { try { const list = readTaskEvents(); if (!list.includes(taskId)) window.localStorage.setItem(TASK_EVENT_KEY, JSON.stringify([...list, taskId])); window.dispatchEvent(new Event("primehub:reseller-progress")); } catch {} }
function taskIcon(id: string) { if (id === "youtube") return PlayCircle; if (id === "instagram") return Instagram; if (id === "tiktok") return Music2; if (id === "whatsapp-share" || id === "refer-reseller") return Share2; return CheckCircle2; }
function taskRewardLabel(task: ResellerTask) { return CASH_TASK_IDS.has(task.id) ? `Rs. ${Number(task.reward || 0).toLocaleString()}` : `+${Number(task.reward || 0)}`; }
function premiumVoucherImage(title: string, art: string, icon: string) { const safe = title.replace(/[<>&]/g, ""); const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='${art}'/><stop offset='1' stop-color='#14140F'/></linearGradient></defs><rect width='640' height='360' rx='36' fill='url(#g)'/><text x='52' y='142' font-size='78'>${icon}</text><text x='52' y='230' fill='white' font-size='34' font-weight='800'>${safe}</text><text x='52' y='276' fill='white' opacity='.72' font-size='18'>PRIMEHUB PREMIUM REWARD</text></svg>`; return `data:image/svg+xml,${encodeURIComponent(svg)}`; }
function localProgress(orders: OrderProgress[]) {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startWeekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = startWeekDate.getDay();
  startWeekDate.setDate(startWeekDate.getDate() - ((day + 6) % 7));
  const startWeek = startWeekDate.getTime();
  const valid = orders.filter(order => Number.isFinite(new Date(order.createdAt).getTime()));
  return { weekly: valid.filter(order => new Date(order.createdAt).getTime() >= startWeek).length, monthly: valid.filter(order => new Date(order.createdAt).getTime() >= startMonth).length, wholesale: valid.some(order => order.wholesale === true) ? 1 : 0 };
}

const tabs = [["Home", "#reseller-home"], ["Rewards", "#reseller-rewards"], ["Tasks", "#reseller-tasks"], ["Wallet", "#reseller-wallet"], ["Tiers", "#reseller-tiers"], ["Vouchers", "#reseller-vouchers"], ["Gifts", "#reseller-gifts"]] as const;

export default function HomeResellerUnifiedV2() {
  const { settings } = useSettings();
  const homeSettings = settings as typeof settings & HomeSettings;
  const challenge = { ...DEFAULT_MONTHLY_CHALLENGE, ...(homeSettings.resellerMonthlyChallenge || {}) };
  const tasks = useMemo(() => (homeSettings.resellerTasks?.length ? homeSettings.resellerTasks : DEFAULT_RESELLER_TASKS).filter(task => task.active !== false), [homeSettings.resellerTasks]);
  const tiers = useMemo(() => (homeSettings.resellerTiers?.length ? [...homeSettings.resellerTiers] : getResellerTiers()).sort((a, b) => a.minMonthlyOrders - b.minMonthlyOrders), [homeSettings.resellerTiers]);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [wallet, setWallet] = useState<RewardWallet>(EMPTY_WALLET);
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>(DEFAULT_REWARD_SETTINGS);
  const [gifts, setGifts] = useState<RewardGift[]>([]);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [message, setMessage] = useState("");
  const [spinPrize, setSpinPrize] = useState<RewardPrize | null>(null);
  const [orders, setOrders] = useState<OrderProgress[]>([]);
  const [taskEvents, setTaskEvents] = useState<string[]>([]);
  const [pendingGuestPrize, setPendingGuestPrize] = useState<RewardPrize | null>(null);

  useEffect(() => {
    const refreshLocal = () => { setOrders(readOrders()); setTaskEvents(readTaskEvents()); try { const raw = localStorage.getItem(PENDING_GUEST_PRIZE_KEY); setPendingGuestPrize(raw ? JSON.parse(raw) : null); } catch {} };
    refreshLocal(); window.addEventListener("primehub:reseller-progress", refreshLocal); return () => window.removeEventListener("primehub:reseller-progress", refreshLocal);
  }, []);

  useEffect(() => {
    let stopWallet: (() => void) | undefined; let stopProfile: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, current => {
      stopWallet?.(); stopProfile?.(); setUser(current); setProfile(null);
      if (!current) { setWallet(readGuestWallet()); return; }
      stopWallet = onSnapshot(doc(db, "user_rewards", current.uid), snap => setWallet({ ...EMPTY_WALLET, ...(snap.data() || {}) } as RewardWallet), () => undefined);
      stopProfile = onSnapshot(doc(db, "reseller_profiles", current.uid), snap => setProfile(snap.exists() ? (snap.data() as ResellerProfile) : null), () => undefined);
    });
    return () => { stopAuth(); stopWallet?.(); stopProfile?.(); };
  }, []);

  useEffect(() => {
    const stopRewards = onSnapshot(doc(db, "settings", "rewards"), snap => { const data = snap.data() || {}; setRewardSettings({ ...DEFAULT_REWARD_SETTINGS, ...data, spinWheelSlots: Array.isArray(data.spinWheelSlots) ? data.spinWheelSlots : [] }); }, () => undefined);
    const stopGifts = onSnapshot(collection(db, "reward_gifts"), snap => setGifts(snap.docs.map(row => ({ id: row.id, ...row.data() }) as RewardGift).filter(gift => gift.active !== false && Number(gift.stock ?? 1) > 0)), () => undefined);
    return () => { stopRewards(); stopGifts(); };
  }, []);

  if (homeSettings.resellerHomeEnabled === false) return null;

  const today = dayKey();
  const guestWallet = typeof window !== "undefined" ? readGuestWallet() : EMPTY_WALLET;
  const streak = Math.min(7, Math.max(0, Number(wallet.streak || 0)));
  const storedProgress = localProgress(orders);
  const profileMonthlyOrders = Math.max(0, Number(profile?.monthlyOrders || 0));
  const monthlyOrders = Math.max(profileMonthlyOrders, storedProgress.monthly);
  const weeklyOrders = storedProgress.weekly;
  const cashAvailable = Math.max(0, Number(profile?.walletAvailable || 0));
  const cashPending = Math.max(0, Number(profile?.walletPending || 0));
  const wheelSlots = (rewardSettings.spinWheelSlots || []).filter(slot => slot.active !== false && Number(slot.stock ?? 1) > 0);
  const wheelStep = 360 / Math.max(1, wheelSlots.length);
  const spinUsedToday = wallet.lastSpin === today || guestWallet.lastSpin === today;
  const target = Math.max(1, Number(challenge.targetOrders || 10));
  const voucherImages = homeSettings.resellerVoucherImages || {};
  const vouchers: Voucher[] = [
    { id: "cash-500", title: "Rs. 500 Cash", description: "Credit to wallet", requirement: "5 orders", icon: "₨", art: "#0E7C6F", minOrders: 5, imageUrl: voucherImages["cash-500"] },
    { id: "challenge-cash", title: `Rs. ${Number(challenge.cashReward || 0).toLocaleString()} Cash`, description: "Monthly challenge", requirement: `${target} orders`, icon: "₨", art: "#127C6A", minOrders: target, imageUrl: voucherImages["challenge-cash"] },
    { id: "challenge-gift", title: challenge.giftTitle || "PrimeHub Gift Box", description: "Surprise bangles gift", requirement: `${target} orders`, icon: "🎁", art: "#D94B3D", minOrders: target, imageUrl: voucherImages["challenge-gift"] },
    { id: "bridal-gift", title: "Bridal Gift Voucher", description: "Free bridal pouch", requirement: "Gold tier", icon: "💍", art: "#9B2C4A", minOrders: 25, imageUrl: voucherImages["bridal-gift"] },
    { id: "wholesale-off", title: "10% Wholesale Off", description: "Next wholesale order", requirement: "3 orders", icon: "%", art: "#E85D04", minOrders: 3, imageUrl: voucherImages["wholesale-off"] },
    { id: "free-delivery", title: "Free Delivery", description: "On any one order", requirement: "2 orders", icon: "📦", art: "#1D4E89", minOrders: 2, imageUrl: voucherImages["free-delivery"] },
    { id: "jazzcash-300", title: "JazzCash Rs. 300", description: "Payout voucher", requirement: "8 orders", icon: "📱", art: "#C1121F", minOrders: 8, imageUrl: voucherImages["jazzcash-300"] },
    { id: "easypaisa-300", title: "EasyPaisa Rs. 300", description: "Payout voucher", requirement: "8 orders", icon: "📱", art: "#2A9D8F", minOrders: 8, imageUrl: voucherImages["easypaisa-300"] },
    { id: "kids-gift", title: "Kids Deal Box Gift", description: "Kids gift voucher", requirement: "6 orders", icon: "🎀", art: "#7B4B94", minOrders: 6, imageUrl: voucherImages["kids-gift"] },
    { id: "elite-cash", title: "Rs. 2,000 Elite", description: "Elite members only", requirement: "Elite 40+", icon: "👑", art: "#C9A227", minOrders: 40, imageUrl: voucherImages["elite-cash"] },
  ];

  const topBaseCount = 3 + tasks.length; const bottomBaseCount = tiers.length + vouchers.length;
  const topGiftCount = Math.max(0, Math.min(gifts.length, Math.round((bottomBaseCount + gifts.length - topBaseCount) / 2)));
  const topGifts = gifts.slice(0, topGiftCount); const bottomGifts = gifts.slice(topGiftCount);

  async function rewardAction(action: "checkin" | "spin") {
    if (busy || (action === "spin" && spinUsedToday)) return;
    setBusy(true); setMessage(""); setSpinPrize(null); if (action === "spin") setSpinning(true);
    try {
      let data: any;
      if (user) {
        const token = await user.getIdToken();
        const responsePromise = fetch("/api/reseller/reward-action", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, guestId: guestId() }) });
        if (action === "spin") await sleep(250);
        const response = await responsePromise; data = await response.json(); if (!response.ok) throw new Error(data.error || "Reward action failed.");
        if (data.wallet) setWallet({ ...EMPTY_WALLET, ...data.wallet });
      } else if (action === "spin" && rewardSettings.guestMode !== false) {
        const responsePromise = fetch("/api/reseller/guest-reward", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "spin", guestId: guestId() }) });
        await sleep(250); const response = await responsePromise; data = await response.json(); if (!response.ok) throw new Error(data.error || "Spin failed.");
        const next = { ...wallet, lastSpin: data.wallet?.lastSpin || today }; setWallet(next); saveGuestWallet(next);
        if (data.prize && data.prize.type !== "try-again") { setPendingGuestPrize(data.prize); try { localStorage.setItem(PENDING_GUEST_PRIZE_KEY, JSON.stringify(data.prize)); } catch {} }
      } else if (!user && rewardSettings.guestMode !== false && action === "checkin") {
        if (wallet.lastCheckIn === today) return;
        const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(Date.now() - 86400000));
        const nextStreak = wallet.lastCheckIn === yesterday ? Math.min(7, Math.max(1, Number(wallet.streak || 0)) + 1) : 1;
        const points = Math.max(0, Number(rewardSettings.checkInRewards?.[nextStreak - 1] ?? 10));
        const next = { ...wallet, points: Number(wallet.points || 0) + points, streak: nextStreak, lastCheckIn: today }; setWallet(next); saveGuestWallet(next); return;
      } else { window.location.href = "/reseller/join?redirect=/"; return; }

      if (action === "spin" && data?.prize) {
        const winner = Math.max(0, wheelSlots.findIndex(slot => slot.id === data.prize.id));
        setRotation(current => current + 1440 + (360 - winner * wheelStep));
        await sleep(3000);
        setSpinPrize(data.prize);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reward action failed."); }
    finally { setSpinning(false); setBusy(false); }
  }

  async function claimGuestPrize() {
    if (!pendingGuestPrize) return;
    if (!user) { window.location.href = "/login?redirect=/#reseller-rewards"; return; }
    setBusy(true); setMessage("");
    try { const token = await user.getIdToken(); const response = await fetch("/api/reseller/guest-reward", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "claim", guestId: guestId() }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Reward claim failed."); if (data.wallet) setWallet({ ...EMPTY_WALLET, ...data.wallet }); setPendingGuestPrize(null); try { localStorage.removeItem(PENDING_GUEST_PRIZE_KEY); } catch {} setMessage(data.prize?.type === "free-delivery" ? "Free Delivery claimed — checkout delivery will be Rs. 0 on your next order." : "Reward claimed successfully."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Reward claim failed."); }
    finally { setBusy(false); }
  }

  function taskProgress(task: ResellerTask) { if (task.id === "weekly-orders") return { value: weeklyOrders, target: 3 }; if (task.id === "monthly-orders") return { value: monthlyOrders, target }; if (task.id === "wholesale-order") return { value: storedProgress.wholesale, target: 1 }; return { value: taskEvents.includes(task.id) ? 1 : 0, target: 1 }; }
  function markTaskComplete(taskId: string) { saveTaskEvent(taskId); setTaskEvents(readTaskEvents()); }
  async function startTask(task: ResellerTask) {
    setMessage("");
    const progress = taskProgress(task);
    const complete = progress.value >= progress.target;
    if (complete && !user) { window.location.href = "/login?redirect=/#reseller-tasks"; return; }
    if (task.id === "weekly-orders" || task.id === "monthly-orders" || task.id === "wholesale-order") {
      if (complete && user) { setMessage("Task completed. Your reseller account is ready for reward review."); return; }
      window.location.href = "/shop"; return;
    }
    const shareUrl = String(task.url || (typeof window !== "undefined" ? `${window.location.origin}/reseller/join?ref=${encodeURIComponent(user?.uid || guestId())}` : "")).trim();
    const shareText = String(task.shareText || task.description || task.title).trim();
    if (task.id === "whatsapp-share") { const text = `${shareText}\n${shareUrl || window.location.origin}`.trim(); markTaskComplete(task.id); window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer"); return; }
    if (task.id === "refer-reseller") { const url = shareUrl || `${window.location.origin}/reseller/join?ref=${encodeURIComponent(user?.uid || guestId())}`; try { if (navigator.share) await navigator.share({ title: "PrimeHub Reseller Club", text: shareText, url }); else { await navigator.clipboard.writeText(`${shareText}\n${url}`); setMessage("Referral link copied — ab share karein."); } markTaskComplete(task.id); } catch {} return; }
    if (SOCIAL_TASK_IDS.has(task.id)) {
      if (user) { try { const token = await user.getIdToken(); await fetch("/api/reseller/task-claims", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ taskId: task.id, action: "open" }) }); } catch {} }
      if (task.url) { markTaskComplete(task.id); window.open(task.url, "_blank", "noopener,noreferrer"); } else setMessage("Admin panel se is task ka platform link add karein.");
      return;
    }
    if (task.url) { markTaskComplete(task.id); window.open(task.url, "_blank", "noopener,noreferrer"); return; }
    markTaskComplete(task.id);
    setMessage("Task marked complete on this device. Login is required when you claim the reward.");
  }

  const renderGift = (gift: RewardGift, index: number, first = false) => <Link id={first ? "reseller-gifts" : undefined} href="/rewards#redeem-rewards" className="hru-rail-card hru-gift" key={`${gift.id}-${index}`}>{gift.imageUrl ? <img src={normalizeImageUrl(gift.imageUrl)} alt={gift.title || "Reward gift"} /> : <Gift size={30} />}<h4>{gift.title || "PrimeHub Reward Gift"}</h4><strong>{Number(gift.pointsCost || 0).toLocaleString()} points</strong></Link>;

  return (
    <section className="home-reseller-unified" id="reseller-home">
      <HomeHeading>Reseller Club</HomeHeading>
      <div className="hru-tabs">{tabs.map(([label, href], index) => <a key={label} className={index === 0 ? "active" : ""} href={href}>{label}</a>)}</div>
      <div className="hru-master-track" aria-label="Reseller Club swipe trail"><div className="hru-master-inner">
        <div className="hru-master-row hru-top-row">
          <article className="hru-rail-card hru-checkin-card" id="reseller-rewards"><div className="hru-card-kicker">Weekly streak</div><div className="hru-card-title-row"><h3>7-Day Check-in</h3><span>{streak}/7</span></div><div className="hru-days">{Array.from({ length: 7 }, (_, index) => <div key={index} className={index < streak ? "done" : ""}><b>D{index + 1}</b><strong>+{Number(rewardSettings.checkInRewards?.[index] ?? 0)}</strong></div>)}</div><button className="hru-primary-button" type="button" disabled={busy || wallet.lastCheckIn === today} onClick={() => void rewardAction("checkin")}><CheckCircle2 size={15} />{wallet.lastCheckIn === today ? "Done today" : "Check in"}</button></article>

          <article className="hru-rail-card hru-wheel-card">
            <div className="hru-card-kicker">Spin & Win</div><h3>Your reward wheel</h3><p className="hru-wheel-copy">Spin to reveal today&apos;s prize.</p>
            <div className="hru-wheel-stage"><div className="hru-wheel-pointer" /><div className="hru-wheel" style={{ transform: `rotate(${rotation}deg)` }}>
              {(wheelSlots.length ? wheelSlots : [{ id: "empty", name: "Admin reward", type: "try-again" }]).map((slot, index, all) => { const step = 360 / Math.max(1, all.length); const angle = index * step + step / 2; return <div className="hru-wheel-radial-slot" key={slot.id} style={{ transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-38px) rotate(-${angle}deg)` }}>{slot.imageUrl ? <img src={normalizeImageUrl(slot.imageUrl)} alt="" /> : <span className="hru-wheel-fallback">🎁</span>}<span>{slot.name}</span></div>; })}
              <div className="hru-wheel-center">WIN</div></div></div>
            <button className="hru-spin-button" type="button" onClick={() => void rewardAction("spin")} disabled={busy || spinUsedToday}>{spinning ? "Spinning…" : spinUsedToday ? "Come tomorrow" : "Spin the wheel"}</button>
            {spinPrize ? <div className="hru-spin-result">{spinPrize.imageUrl ? <img src={normalizeImageUrl(spinPrize.imageUrl)} alt={spinPrize.name} /> : null}<span>You got: {spinPrize.name}</span></div> : null}
            {pendingGuestPrize ? <button className="hru-claim-button" type="button" onClick={() => void claimGuestPrize()}>{user ? "Claim reward" : "Login to claim"}</button> : null}
          </article>

          {tasks.map((task, index) => { const Icon = taskIcon(task.id); const progress = taskProgress(task); const complete = progress.value >= progress.target; return <article className="hru-rail-card hru-task" id={index === 0 ? "reseller-tasks" : undefined} key={task.id}><div className="hru-task-top"><div className="hru-task-icon"><Icon size={18} /></div><span>{taskRewardLabel(task)}</span></div><h4>{task.title}</h4><p>{task.description}</p><b className={`hru-auto-task ${complete ? "complete" : ""}`}><CheckCircle2 size={12} />{Math.min(progress.value, progress.target)}/{progress.target} {complete ? "— reward unlocked" : "completed"}</b><button className="hru-task-open" type="button" onClick={() => void startTask(task)}>{complete ? (user ? "Reward ready" : "Login to claim") : task.id === "whatsapp-share" ? "Share now" : task.id === "refer-reseller" ? "Share referral" : "Start task"}<ChevronRight size={12} /></button></article>; })}

          <article className="hru-rail-card hru-wallet-card" id="reseller-wallet"><div className="hru-wallet-head"><WalletCards size={20} /><div><small>Reward wallet</small><strong>Rs. {cashAvailable.toLocaleString()}</strong></div></div><div className="hru-wallet-stats"><span>Pending <b>Rs. {cashPending.toLocaleString()}</b></span><span>Points <b>{Number(wallet.points || 0).toLocaleString()}</b></span></div>{Number(wallet.freeDeliveryCredits || 0) > 0 ? <div className="hru-free-delivery">🎁 Free Delivery × {Number(wallet.freeDeliveryCredits || 0)}</div> : null}<div className="hru-wallet-actions"><Link href="/reseller/wallet"><History size={13} /> History</Link><Link href="/reseller/wallet">Withdraw <ArrowRight size={13} /></Link></div></article>
          {topGifts.map((gift, index) => renderGift(gift, index, index === 0))}
        </div>

        <div className="hru-master-row hru-bottom-row">
          {tiers.map((tier, index) => { const current = monthlyOrders >= Number(tier.minMonthlyOrders || 0) && (index === tiers.length - 1 || monthlyOrders < Number(tiers[index + 1]?.minMonthlyOrders || Infinity)); return <article className={`hru-rail-card hru-tier ${current ? "current" : ""}`} id={index === 0 ? "reseller-tiers" : undefined} key={tier.id || tier.name}><span className="hru-tier-number">{index + 1}</span><small>{current ? "CURRENT" : `${Number(tier.minMonthlyOrders || 0)}+ orders`}</small><h4>{tier.name}</h4><strong>{Number(tier.discountPercent || 0)}% <em>OFF</em></strong></article>; })}
          {vouchers.map((voucher, index) => <article className="hru-rail-card hru-voucher" id={index === 0 ? "reseller-vouchers" : undefined} key={voucher.id}><img src={voucher.imageUrl ? normalizeImageUrl(voucher.imageUrl) : premiumVoucherImage(voucher.title, voucher.art, voucher.icon)} alt={voucher.title} /><small>{monthlyOrders < voucher.minOrders ? "Locked" : user ? "Available" : "Login to claim"}</small><h4>{voucher.title}</h4><p>{voucher.requirement}</p></article>)}
          {bottomGifts.map((gift, index) => renderGift(gift, index, topGifts.length === 0 && index === 0))}
          {!gifts.length ? <Link id="reseller-gifts" href="/rewards#redeem-rewards" className="hru-rail-card hru-gift"><Gift size={30} /><h4>Reward gifts</h4><strong>Admin-controlled products</strong></Link> : null}
        </div>
      </div></div>
      {message ? <div className="hru-message" role="status">{message}</div> : null}
    </section>
  );
}
