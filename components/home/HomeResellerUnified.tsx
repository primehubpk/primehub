"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { ArrowRight, CheckCircle2, Gift, History, Sparkles, TicketPercent, WalletCards } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { DEFAULT_RESELLER_TASKS, type ResellerTask } from "@/lib/resellerTasks";
import { getResellerTiers } from "@/lib/resellerTiers";
import type { ResellerProfile, ResellerTier } from "@/lib/resellerTypes";
import { useSettings } from "@/lib/useSettings";
import HomeHeading from "./HomeHeading";

const GUEST_KEY = "phdeals-guest-rewards";
const GUEST_WINS_KEY = "phdeals-guest-reward-wins";

const EMPTY_WALLET: RewardWallet = { points: 0, streak: 0, coupons: [] };
const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  guestMode: true,
  checkInRewards: [10, 15, 20, 25, 30, 50, 100],
  spinWheelSlots: [],
};

type RewardWallet = {
  points: number;
  streak: number;
  lastCheckIn?: string;
  lastSpin?: string;
  coupons?: string[];
};

type RewardPrizeType = "product" | "points" | "free-delivery" | "coupon" | "try-again";
type RewardPrize = {
  id: string;
  name: string;
  type: RewardPrizeType;
  points: number;
  probability: number;
  active?: boolean;
  stock?: number;
  productId?: string;
  voucherCode?: string;
  voucherAmount?: number;
  imageUrl?: string;
};

type RewardSettings = {
  guestMode?: boolean;
  checkInRewards?: number[];
  spinWheelSlots?: RewardPrize[];
};

type RewardGift = {
  id: string;
  productId?: string;
  pointsCost: number;
  active?: boolean;
  stock?: number;
  imageUrl?: string;
  title?: string;
};

type HomeSettings = {
  resellerHomeEnabled?: boolean;
  resellerTasks?: ResellerTask[];
  resellerTiers?: ResellerTier[];
};

function dayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

function readGuestWallet(): RewardWallet {
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    return raw ? { ...EMPTY_WALLET, ...JSON.parse(raw) } : EMPTY_WALLET;
  } catch {
    return EMPTY_WALLET;
  }
}

function saveGuestWallet(wallet: RewardWallet) {
  try {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify(wallet));
  } catch {
    // Keep rewards usable for this visit even if storage is unavailable.
  }
}

function appendGuestWin(prize: RewardPrize, voucherCode: string) {
  if (prize.type === "points" || prize.type === "try-again") return;
  try {
    const raw = window.localStorage.getItem(GUEST_WINS_KEY);
    const current = raw ? JSON.parse(raw) : [];
    current.push({
      id: `guest-${Date.now()}`,
      prizeId: prize.id,
      name: prize.name,
      type: prize.type,
      points: Number(prize.points || 0),
      productId: prize.productId || "",
      voucherCode,
      voucherAmount: Number(prize.voucherAmount || 0),
      imageUrl: prize.imageUrl || "",
      status: "pending",
    });
    window.localStorage.setItem(GUEST_WINS_KEY, JSON.stringify(current));
  } catch {
    // Non-blocking guest history.
  }
}

function choosePrize(prizes: RewardPrize[]) {
  const active = prizes.filter((p) => p.active !== false && Number(p.probability) > 0 && Number(p.stock ?? 1) > 0);
  const total = active.reduce((sum, p) => sum + Number(p.probability || 0), 0);
  if (!active.length || total <= 0) return null;
  let cursor = Math.random() * total;
  for (const prize of active) {
    cursor -= Number(prize.probability || 0);
    if (cursor <= 0) return prize;
  }
  return active[active.length - 1];
}

function prizeText(prize: RewardPrize) {
  if (prize.type === "points") return `+${Number(prize.points || 0).toLocaleString()} points`;
  if (prize.type === "free-delivery") return "Free delivery unlocked";
  if (prize.type === "coupon") return prize.voucherAmount ? `Rs. ${Number(prize.voucherAmount).toLocaleString()} voucher` : "Voucher unlocked";
  if (prize.type === "product") return "Free product unlocked";
  return "Try again tomorrow";
}

const tabs = [
  ["Home", "#reseller-home"],
  ["Rewards", "#reseller-rewards"],
  ["Tiers", "#reseller-tiers"],
  ["Tasks", "#reseller-tasks"],
  ["Vouchers", "#reseller-vouchers"],
  ["Wallet", "#reseller-wallet"],
  ["Gifts", "#reseller-gifts"],
] as const;

export default function HomeResellerUnified() {
  const { settings } = useSettings();
  const homeSettings = settings as typeof settings & HomeSettings;
  const tasks = useMemo(
    () => (homeSettings.resellerTasks?.length ? homeSettings.resellerTasks : DEFAULT_RESELLER_TASKS).filter((task) => task.active !== false),
    [homeSettings.resellerTasks],
  );
  const tiers = useMemo(
    () => (homeSettings.resellerTiers?.length ? [...homeSettings.resellerTiers] : getResellerTiers()).sort((a, b) => a.minMonthlyOrders - b.minMonthlyOrders),
    [homeSettings.resellerTiers],
  );

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
    const stopAuth = onAuthStateChanged(auth, (currentUser) => {
      stopWallet?.();
      stopProfile?.();
      setUser(currentUser);
      setProfile(null);
      if (!currentUser) {
        setWallet(readGuestWallet());
        return;
      }
      stopWallet = onSnapshot(doc(db, "user_rewards", currentUser.uid), (snap) => {
        setWallet({ ...EMPTY_WALLET, ...(snap.data() || {}) } as RewardWallet);
      }, () => undefined);
      stopProfile = onSnapshot(doc(db, "reseller_profiles", currentUser.uid), (snap) => {
        setProfile(snap.exists() ? (snap.data() as ResellerProfile) : null);
      }, () => undefined);
    });
    return () => {
      stopAuth();
      stopWallet?.();
      stopProfile?.();
    };
  }, []);

  useEffect(() => {
    const stopRewards = onSnapshot(doc(db, "settings", "rewards"), (snap) => {
      const data = snap.data() || {};
      setRewardSettings({
        ...DEFAULT_REWARD_SETTINGS,
        ...data,
        spinWheelSlots: Array.isArray(data.spinWheelSlots) ? data.spinWheelSlots : [],
      });
    }, () => undefined);
    const stopGifts = onSnapshot(collection(db, "reward_gifts"), (snap) => {
      setGifts(snap.docs.map((row) => ({ id: row.id, ...row.data() }) as RewardGift).filter((gift) => gift.active !== false && Number(gift.stock ?? 1) > 0));
    }, () => undefined);
    return () => {
      stopRewards();
      stopGifts();
    };
  }, []);

  if (homeSettings.resellerHomeEnabled === false) return null;

  const today = dayKey();
  const streak = Math.min(7, Math.max(0, Number(wallet.streak || 0)));
  const monthlyOrders = Math.max(0, Number(profile?.monthlyOrders || 0));
  const cashAvailable = Math.max(0, Number(profile?.walletAvailable || 0));
  const cashPending = Math.max(0, Number(profile?.walletPending || 0));
  const wheelSlots = (rewardSettings.spinWheelSlots || []).filter((slot) => slot.active !== false).slice(0, 8);

  async function checkIn() {
    if (busy || wallet.lastCheckIn === today) return;
    setBusy(true);
    setMessage("");
    try {
      const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date(Date.now() - 86400000));
      const nextStreak = wallet.lastCheckIn === yesterday ? Math.min(7, Math.max(1, Number(wallet.streak || 0)) + 1) : 1;
      const points = Math.max(0, Number(rewardSettings.checkInRewards?.[nextStreak - 1] ?? 10));
      if (user) {
        await runTransaction(db, async (tx) => {
          const ref = doc(db, "user_rewards", user.uid);
          const snap = await tx.get(ref);
          const current = { ...EMPTY_WALLET, ...(snap.data() || {}) } as RewardWallet;
          if (current.lastCheckIn === today) throw new Error("Already checked in today.");
          tx.set(ref, {
            ...current,
            points: Number(current.points || 0) + points,
            streak: nextStreak,
            lastCheckIn: today,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        });
      } else if (rewardSettings.guestMode !== false) {
        const next = { ...wallet, points: Number(wallet.points || 0) + points, streak: nextStreak, lastCheckIn: today };
        setWallet(next);
        saveGuestWallet(next);
      } else {
        window.location.href = "/reseller/join?redirect=/";
        return;
      }
      setMessage(`+${points.toLocaleString()} points collected.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Check-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function spin() {
    if (busy || wallet.lastSpin === today) return;
    if (!user && rewardSettings.guestMode === false) {
      window.location.href = "/reseller/join?redirect=/";
      return;
    }
    const prize = choosePrize(rewardSettings.spinWheelSlots || []);
    if (!prize) {
      setMessage("Spin prizes are being refreshed from Admin.");
      return;
    }
    setBusy(true);
    setMessage("Spinning…");
    setSpinPrize(null);
    try {
      const points = prize.type === "points" ? Math.max(0, Number(prize.points || 0)) : 0;
      const voucherCode = prize.type === "coupon" || prize.type === "free-delivery"
        ? prize.voucherCode?.trim() || `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
        : "";
      if (user) {
        await runTransaction(db, async (tx) => {
          const walletRef = doc(db, "user_rewards", user.uid);
          const snap = await tx.get(walletRef);
          const current = { ...EMPTY_WALLET, ...(snap.data() || {}) } as RewardWallet;
          if (current.lastSpin === today) throw new Error("Come back tomorrow for your next spin.");
          tx.set(walletRef, {
            ...current,
            points: Number(current.points || 0) + points,
            lastSpin: today,
            coupons: voucherCode ? [...(current.coupons || []), voucherCode] : current.coupons || [],
            updatedAt: serverTimestamp(),
          }, { merge: true });
          if (prize.type !== "points" && prize.type !== "try-again") {
            tx.set(doc(collection(db, "reward_wins")), {
              userId: user.uid,
              prizeId: prize.id,
              name: prize.name,
              type: prize.type,
              points,
              productId: prize.productId || "",
              voucherCode,
              voucherAmount: Number(prize.voucherAmount || 0),
              imageUrl: prize.imageUrl || "",
              status: "pending",
              createdAt: serverTimestamp(),
            });
          }
        });
      } else {
        const next = {
          ...wallet,
          points: Number(wallet.points || 0) + points,
          lastSpin: today,
          coupons: voucherCode ? [...(wallet.coupons || []), voucherCode] : wallet.coupons || [],
        };
        setWallet(next);
        saveGuestWallet(next);
        appendGuestWin(prize, voucherCode);
      }
      window.setTimeout(() => {
        setSpinPrize(prize);
        setMessage(prizeText(prize));
        setBusy(false);
      }, 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Spin failed.");
      setBusy(false);
    }
  }

  return (
    <section className="home-reseller-unified" id="reseller-home">
      <HomeHeading>Reseller Club</HomeHeading>
      <div className="hru-tabs" aria-label="Reseller Club sections">
        {tabs.map(([label, href], index) => <a key={label} className={index === 0 ? "active" : ""} href={href}>{label}</a>)}
      </div>

      <div className="hru-feature-row" id="reseller-rewards">
        <article className="hru-checkin-card">
          <div className="hru-card-kicker">Weekly streak</div>
          <div className="hru-card-title-row"><div><h3>7-Day Check-in</h3><p>Check in every day and unlock higher point rewards.</p></div><span>{streak}/7</span></div>
          <div className="hru-days">
            {Array.from({ length: 7 }, (_, index) => <div key={index} className={index < streak ? "done" : ""}><b>D{index + 1}</b><strong>+{Number(rewardSettings.checkInRewards?.[index] ?? 0)}</strong><small>PTS</small></div>)}
          </div>
          <button className="hru-primary-button" type="button" disabled={busy || wallet.lastCheckIn === today} onClick={() => void checkIn()}>
            <CheckCircle2 size={18} /> {wallet.lastCheckIn === today ? "Checked in today" : "Check in now"}
          </button>
        </article>

        <article className="hru-wheel-card">
          <div className="hru-card-kicker">Spin & Win</div>
          <h3>Your reward wheel</h3>
          <p>Same Admin rewards, same daily count, whether you spin here or inside Reseller Club.</p>
          <div className={`hru-wheel ${busy ? "spinning" : ""}`}>
            <div className="hru-wheel-grid">
              {(wheelSlots.length ? wheelSlots : [{ id: "empty", name: "Admin rewards", type: "try-again", points: 0, probability: 1 } as RewardPrize]).map((slot) => (
                <div className="hru-wheel-slot" key={slot.id} title={slot.name}>
                  {slot.imageUrl ? <img src={normalizeImageUrl(slot.imageUrl)} alt="" loading="lazy" /> : <Sparkles size={18} />}
                  <span>{slot.name}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => void spin()} disabled={busy || wallet.lastSpin === today}>WIN</button>
          </div>
          {spinPrize?.imageUrl ? <div className="hru-spin-result"><img src={normalizeImageUrl(spinPrize.imageUrl)} alt={spinPrize.name} /><span>{spinPrize.name}</span></div> : null}
          <div className="hru-wheel-status">{wallet.lastSpin === today ? "Come back tomorrow" : "1 spin available today"}</div>
        </article>
      </div>

      <section className="hru-section" id="reseller-tiers">
        <div className="hru-section-head"><div><small>Tiers</small><h3>Your reseller level</h3></div><Link href="/reseller/dashboard">Open club <ArrowRight size={14} /></Link></div>
        <div className="hru-horizontal-row hru-tier-row">
          {tiers.map((tier, index) => {
            const current = monthlyOrders >= Number(tier.minMonthlyOrders || 0) && (index === tiers.length - 1 || monthlyOrders < Number(tiers[index + 1]?.minMonthlyOrders || Infinity));
            return <article className={`hru-mini-card hru-tier ${current ? "current" : ""}`} key={tier.id || tier.name}>
              <span className="hru-tier-number">{index + 1}</span><small>{current ? "Current" : `${Number(tier.minMonthlyOrders || 0)}+ orders`}</small><h4>{tier.name}</h4><strong>{Number(tier.discountPercent || 0)}% <em>OFF</em></strong>
            </article>;
          })}
        </div>
      </section>

      <section className="hru-section" id="reseller-tasks">
        <div className="hru-section-head"><div><small>Tasks</small><h3>Complete & earn</h3></div><Link href="/reseller/tasks">All tasks <ArrowRight size={14} /></Link></div>
        <div className="hru-horizontal-row">
          {tasks.map((task) => <Link href={`/reseller/tasks#${encodeURIComponent(task.id)}`} className="hru-mini-card hru-task" key={task.id}><span>+{Number(task.reward || 0)}</span><h4>{task.title}</h4><p>{task.description}</p><b>Open task <ArrowRight size={12} /></b></Link>)}
        </div>
      </section>

      <section className="hru-section" id="reseller-vouchers">
        <div className="hru-section-head"><div><small>Vouchers</small><h3>Your reward vouchers</h3></div><Link href="/reseller/dashboard">View all <ArrowRight size={14} /></Link></div>
        <div className="hru-horizontal-row">
          {(wallet.coupons?.length ? wallet.coupons : ["Spin & Win to unlock"]).map((code, index) => {
            const matching = wheelSlots.find((slot) => slot.voucherCode === code || (slot.type === "coupon" && index === 0));
            return <article className="hru-mini-card hru-voucher" key={`${code}-${index}`}>
              {matching?.imageUrl ? <img src={normalizeImageUrl(matching.imageUrl)} alt="" loading="lazy" /> : <TicketPercent size={28} />}
              <small>PrimeHub voucher</small><h4>{code}</h4><p>{matching?.name || "Reward voucher"}</p>
            </article>;
          })}
        </div>
      </section>

      <section className="hru-section" id="reseller-wallet">
        <div className="hru-section-head"><div><small>Wallet</small><h3>Points & reseller earnings</h3></div></div>
        <div className="hru-wallet-card">
          <div><WalletCards size={24} /><small>Reward points</small><strong>{Number(wallet.points || 0).toLocaleString()}</strong></div>
          <div><small>Cash available</small><strong>Rs. {cashAvailable.toLocaleString()}</strong><span>Rs. {cashPending.toLocaleString()} pending</span></div>
          <div className="hru-wallet-actions"><Link href="/reseller/wallet"><History size={15} /> History</Link><Link href="/reseller/wallet">Withdrawal <ArrowRight size={14} /></Link></div>
        </div>
      </section>

      <section className="hru-section" id="reseller-gifts">
        <div className="hru-section-head"><div><small>Gifts & products</small><h3>Redeem your points</h3></div><Link href="/rewards#redeem-rewards">See all <ArrowRight size={14} /></Link></div>
        <div className="hru-horizontal-row">
          {gifts.length ? gifts.map((gift) => <Link href="/rewards#redeem-rewards" className="hru-mini-card hru-gift" key={gift.id}>
            {gift.imageUrl ? <img src={normalizeImageUrl(gift.imageUrl)} alt={gift.title || "Reward gift"} loading="lazy" /> : <Gift size={30} />}
            <h4>{gift.title || "PrimeHub Reward Gift"}</h4><strong>{Number(gift.pointsCost || 0).toLocaleString()} points</strong>
          </Link>) : <Link href="/rewards#redeem-rewards" className="hru-mini-card hru-gift"><Gift size={30} /><h4>Reward gifts</h4><strong>Admin-controlled products</strong></Link>}
        </div>
      </section>

      {message ? <div className="hru-message" role="status">{message}</div> : null}
    </section>
  );
}
