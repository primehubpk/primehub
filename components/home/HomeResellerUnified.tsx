"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { ArrowRight, CheckCircle2, ChevronRight, Gift, History, Instagram, Music2, PlayCircle, Sparkles, WalletCards } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { DEFAULT_MONTHLY_CHALLENGE, DEFAULT_RESELLER_TASKS, type MonthlyChallengeSettings, type ResellerTask } from "@/lib/resellerTasks";
import { getResellerTiers } from "@/lib/resellerTiers";
import type { ResellerProfile, ResellerTier } from "@/lib/resellerTypes";
import { useSettings } from "@/lib/useSettings";
import HomeHeading from "./HomeHeading";

const GUEST_KEY = "phdeals-guest-rewards";
const SOCIAL_TASK_IDS = new Set(["youtube", "instagram", "tiktok"]);
const EMPTY_WALLET: RewardWallet = { points: 0, streak: 0, coupons: [] };
const DEFAULT_REWARD_SETTINGS: RewardSettings = { guestMode: true, checkInRewards: [10, 15, 20, 25, 30, 50, 100], spinWheelSlots: [] };

type RewardWallet = { points: number; streak: number; lastCheckIn?: string; lastSpin?: string; coupons?: string[] };
type RewardPrize = { id: string; name: string; type: string; points?: number; probability?: number; active?: boolean; stock?: number; productId?: string; voucherCode?: string; voucherAmount?: number; imageUrl?: string };
type RewardSettings = { guestMode?: boolean; checkInRewards?: number[]; spinWheelSlots?: RewardPrize[] };
type RewardGift = { id: string; productId?: string; pointsCost: number; active?: boolean; stock?: number; imageUrl?: string; title?: string };
type HomeSettings = { resellerHomeEnabled?: boolean; resellerTasks?: ResellerTask[]; resellerTiers?: ResellerTier[]; resellerMonthlyChallenge?: Partial<MonthlyChallengeSettings>; resellerVoucherImages?: Record<string, string> };
type Voucher = { id: string; title: string; description: string; requirement: string; art: string; icon: string; minOrders: number; imageUrl?: string };

function dayKey() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date()); }
function readGuestWallet(): RewardWallet { try { const raw = window.localStorage.getItem(GUEST_KEY); return raw ? { ...EMPTY_WALLET, ...JSON.parse(raw) } : EMPTY_WALLET; } catch { return EMPTY_WALLET; } }
function saveGuestWallet(wallet: RewardWallet) { try { window.localStorage.setItem(GUEST_KEY, JSON.stringify(wallet)); } catch {} }
function taskIcon(id: string) { if (id === "youtube") return PlayCircle; if (id === "instagram") return Instagram; if (id === "tiktok") return Music2; return CheckCircle2; }
function premiumVoucherImage(title: string, art: string, icon: string) { const safe = title.replace(/[<>&]/g, ""); const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='${art}'/><stop offset='1' stop-color='#14140F'/></linearGradient></defs><rect width='640' height='360' rx='36' fill='url(#g)'/><text x='52' y='142' font-size='78'>${icon}</text><text x='52' y='230' fill='white' font-size='34' font-weight='800'>${safe}</text><text x='52' y='276' fill='white' opacity='.72' font-size='18'>PRIMEHUB PREMIUM REWARD</text></svg>`; return `data:image/svg+xml,${encodeURIComponent(svg)}`; }

const tabs = [["Home", "#reseller-home"], ["Rewards", "#reseller-rewards"], ["Tasks", "#reseller-tasks"], ["Wallet", "#reseller-wallet"], ["Tiers", "#reseller-tiers"], ["Vouchers", "#reseller-vouchers"], ["Gifts", "#reseller-gifts"]] as const;

export default function HomeResellerUnified() {
  const { settings } = useSettings();
  const homeSettings = settings as typeof settings & HomeSettings;
  const challenge = { ...DEFAULT_MONTHLY_CHALLENGE, ...(homeSettings.resellerMonthlyChallenge || {}) };
  const tasks = useMemo(() => (homeSettings.resellerTasks?.length ? homeSettings.resellerTasks : DEFAULT_RESELLER_TASKS).filter((task) => task.active !== false), [homeSettings.resellerTasks]);
  const tiers = useMemo(() => (homeSettings.resellerTiers?.length ? [...homeSettings.resellerTiers] : getResellerTiers()).sort((a, b) => a.minMonthlyOrders - b.minMonthlyOrders), [homeSettings.resellerTiers]);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [wallet, setWallet] = useState<RewardWallet>(EMPTY_WALLET);
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>(DEFAULT_REWARD_SETTINGS);
  const [gifts, setGifts] = useState<RewardGift[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [spinPrize, setSpinPrize] = useState<RewardPrize | null>(null);

  useEffect(() => {
    let stopWallet: (() => void) | undefined;
    let stopProfile: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (current) => {
      stopWallet?.(); stopProfile?.(); setUser(current); setProfile(null);
      if (!current) { setWallet(readGuestWallet()); return; }
      stopWallet = onSnapshot(doc(db, "user_rewards", current.uid), (snap) => setWallet({ ...EMPTY_WALLET, ...(snap.data() || {}) } as RewardWallet), () => undefined);
      stopProfile = onSnapshot(doc(db, "reseller_profiles", current.uid), (snap) => setProfile(snap.exists() ? (snap.data() as ResellerProfile) : null), () => undefined);
    });
    return () => { stopAuth(); stopWallet?.(); stopProfile?.(); };
  }, []);

  useEffect(() => {
    const stopRewards = onSnapshot(doc(db, "settings", "rewards"), (snap) => {
      const data = snap.data() || {};
      setRewardSettings({ ...DEFAULT_REWARD_SETTINGS, ...data, spinWheelSlots: Array.isArray(data.spinWheelSlots) ? data.spinWheelSlots : [] });
    }, () => undefined);
    const stopGifts = onSnapshot(collection(db, "reward_gifts"), (snap) => setGifts(snap.docs.map((row) => ({ id: row.id, ...row.data() }) as RewardGift).filter((gift) => gift.active !== false && Number(gift.stock ?? 1) > 0)), () => undefined);
    return () => { stopRewards(); stopGifts(); };
  }, []);

  if (homeSettings.resellerHomeEnabled === false) return null;

  const today = dayKey();
  const streak = Math.min(7, Math.max(0, Number(wallet.streak || 0)));
  const monthlyOrders = Math.max(0, Number(profile?.monthlyOrders || 0));
  const cashAvailable = Math.max(0, Number(profile?.walletAvailable || 0));
  const cashPending = Math.max(0, Number(profile?.walletPending || 0));
  const wheelSlots = (rewardSettings.spinWheelSlots || []).filter((slot) => slot.active !== false && Number(slot.stock ?? 1) > 0).slice(0, 5);
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

  async function rewardAction(action: "checkin" | "spin") {
    if (busy) return;
    setBusy(true); setMessage(action === "spin" ? "Spinning…" : ""); setSpinPrize(null);
    try {
      if (user) {
        const token = await user.getIdToken();
        const response = await fetch("/api/reseller/reward-action", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Reward action failed.");
        if (data.wallet) setWallet({ ...EMPTY_WALLET, ...data.wallet });
        if (data.prize) setSpinPrize(data.prize);
        setMessage(action === "spin" ? (data.prize?.name || "Spin complete") : "Check-in complete.");
      } else if (rewardSettings.guestMode !== false && action === "checkin") {
        if (wallet.lastCheckIn === today) return;
        const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(Date.now() - 86400000));
        const nextStreak = wallet.lastCheckIn === yesterday ? Math.min(7, Math.max(1, Number(wallet.streak || 0)) + 1) : 1;
        const points = Math.max(0, Number(rewardSettings.checkInRewards?.[nextStreak - 1] ?? 10));
        const next = { ...wallet, points: Number(wallet.points || 0) + points, streak: nextStreak, lastCheckIn: today };
        setWallet(next); saveGuestWallet(next); setMessage(`+${points} points collected.`);
      } else window.location.href = "/reseller/join?redirect=/";
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reward action failed."); }
    finally { setBusy(false); }
  }

  async function openTask(task: ResellerTask) {
    const current = auth.currentUser;
    if (!current) { window.location.href = "/login?redirect=/#reseller-tasks"; return; }
    try {
      const token = await current.getIdToken();
      const response = await fetch("/api/reseller/task-claims", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ taskId: task.id, action: "open" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Task open failed.");
      if (task.url) window.open(task.url, "_blank", "noopener,noreferrer"); else setMessage("Admin panel se is task ka platform link add karein.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Task open nahi hua."); }
  }

  return (
    <section className="home-reseller-unified" id="reseller-home">
      <HomeHeading>Reseller Club</HomeHeading>
      <div className="hru-tabs">{tabs.map(([label, href], index) => <a key={label} className={index === 0 ? "active" : ""} href={href}>{label}</a>)}</div>

      <div className="hru-master-track" aria-label="Reseller Club swipe trail">
        <div className="hru-master-inner">
          <div className="hru-master-row hru-top-row">
            <article className="hru-rail-card hru-checkin-card" id="reseller-rewards">
              <div className="hru-card-kicker">Weekly streak</div>
              <div className="hru-card-title-row"><h3>7-Day Check-in</h3><span>{streak}/7</span></div>
              <div className="hru-days">{Array.from({ length: 7 }, (_, index) => <div key={index} className={index < streak ? "done" : ""}><b>D{index + 1}</b><strong>+{Number(rewardSettings.checkInRewards?.[index] ?? 0)}</strong></div>)}</div>
              <button className="hru-primary-button" type="button" disabled={busy || wallet.lastCheckIn === today} onClick={() => void rewardAction("checkin")}><CheckCircle2 size={15} />{wallet.lastCheckIn === today ? "Done today" : "Check in"}</button>
            </article>

            <article className="hru-rail-card hru-wheel-card">
              <div className="hru-card-kicker">Spin & Win</div>
              <h3>Your reward wheel</h3>
              <div className={`hru-wheel ${busy ? "spinning" : ""}`}>
                <div className="hru-wheel-pointer" />
                {(wheelSlots.length ? wheelSlots : [{ id: "empty", name: "Admin reward", type: "try-again" }]).map((slot, index) => {
                  const angle = index * 72 + 36;
                  return <div className="hru-wheel-radial-slot" key={slot.id} style={{ transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-42%) rotate(-${angle}deg)` }}>{slot.imageUrl ? <img src={normalizeImageUrl(slot.imageUrl)} alt="" /> : <Sparkles size={13} />}<span>{slot.name}</span></div>;
                })}
                <button type="button" onClick={() => void rewardAction("spin")} disabled={busy || wallet.lastSpin === today}>WIN</button>
              </div>
              {spinPrize ? <div className="hru-spin-result">{spinPrize.imageUrl ? <img src={normalizeImageUrl(spinPrize.imageUrl)} alt={spinPrize.name} /> : null}<span>{spinPrize.name}</span></div> : <div className="hru-wheel-status">{wallet.lastSpin === today ? "Come tomorrow" : "1 spin today"}</div>}
            </article>

            {tasks.map((task, index) => {
              const Icon = taskIcon(task.id); const social = SOCIAL_TASK_IDS.has(task.id); const isMonthly = task.id.includes("monthly"); const isWeekly = task.id.includes("weekly"); const autoTarget = isMonthly ? target : isWeekly ? 3 : 1;
              return <article className="hru-rail-card hru-task" id={index === 0 ? "reseller-tasks" : undefined} key={task.id}><div className="hru-task-top"><div className="hru-task-icon"><Icon size={18} /></div><span>+{Number(task.reward || 0)}</span></div><h4>{task.title}</h4><p>{task.description}</p>{social ? <button className="hru-task-open" type="button" onClick={() => void openTask(task)}>Open {task.id}<ChevronRight size={12} /></button> : <b className="hru-auto-task"><CheckCircle2 size={12} />{Math.min(monthlyOrders, autoTarget)}/{autoTarget} completed</b>}</article>;
            })}

            <article className="hru-rail-card hru-wallet-card" id="reseller-wallet">
              <div className="hru-wallet-head"><WalletCards size={20} /><div><small>Reward wallet</small><strong>Rs. {cashAvailable.toLocaleString()}</strong></div></div>
              <div className="hru-wallet-stats"><span>Pending <b>Rs. {cashPending.toLocaleString()}</b></span><span>Points <b>{Number(wallet.points || 0).toLocaleString()}</b></span></div>
              <div className="hru-wallet-actions"><Link href="/reseller/wallet"><History size={13} /> History</Link><Link href="/reseller/wallet">Withdraw <ArrowRight size={13} /></Link></div>
            </article>
          </div>

          <div className="hru-master-row hru-bottom-row">
            {tiers.map((tier, index) => { const current = monthlyOrders >= Number(tier.minMonthlyOrders || 0) && (index === tiers.length - 1 || monthlyOrders < Number(tiers[index + 1]?.minMonthlyOrders || Infinity)); return <article className={`hru-rail-card hru-tier ${current ? "current" : ""}`} id={index === 0 ? "reseller-tiers" : undefined} key={tier.id || tier.name}><span className="hru-tier-number">{index + 1}</span><small>{current ? "CURRENT" : `${Number(tier.minMonthlyOrders || 0)}+ orders`}</small><h4>{tier.name}</h4><strong>{Number(tier.discountPercent || 0)}% <em>OFF</em></strong></article>; })}

            {vouchers.map((voucher, index) => <article className="hru-rail-card hru-voucher" id={index === 0 ? "reseller-vouchers" : undefined} key={voucher.id}><img src={voucher.imageUrl ? normalizeImageUrl(voucher.imageUrl) : premiumVoucherImage(voucher.title, voucher.art, voucher.icon)} alt={voucher.title} /><small>{monthlyOrders < voucher.minOrders ? "Locked" : "Available"}</small><h4>{voucher.title}</h4><p>{voucher.requirement}</p></article>)}

            {gifts.length ? gifts.map((gift, index) => <Link id={index === 0 ? "reseller-gifts" : undefined} href="/rewards#redeem-rewards" className="hru-rail-card hru-gift" key={gift.id}>{gift.imageUrl ? <img src={normalizeImageUrl(gift.imageUrl)} alt={gift.title || "Reward gift"} /> : <Gift size={30} />}<h4>{gift.title || "PrimeHub Reward Gift"}</h4><strong>{Number(gift.pointsCost || 0).toLocaleString()} points</strong></Link>) : <Link id="reseller-gifts" href="/rewards#redeem-rewards" className="hru-rail-card hru-gift"><Gift size={30} /><h4>Reward gifts</h4><strong>Admin-controlled products</strong></Link>}
          </div>
        </div>
      </div>

      {message ? <div className="hru-message" role="status">{message}</div> : null}
    </section>
  );
}
