"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import {
  ArrowRight,
  Check,
  Coins,
  Gift,
  Instagram,
  Lock,
  Music2,
  Package,
  PlayCircle,
  Share2,
  ShoppingBag,
  Users,
  WalletCards,
} from "lucide-react";
import HomeHeading from "./HomeHeading";
import { useSettings } from "@/lib/useSettings";
import { DEFAULT_RESELLER_TASKS, type ResellerTask } from "@/lib/resellerTasks";
import { getResellerTiers } from "@/lib/resellerTiers";
import type { ResellerProfile, ResellerTier } from "@/lib/resellerTypes";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { auth, db } from "@/lib/firebase";
import "./HomeResellerClubRail.css";

const GUEST_KEY = "phdeals-guest-rewards";
const GUEST_WINS_KEY = "phdeals-guest-reward-wins";
const SOCIAL_TASK_IDS = new Set(["youtube", "instagram", "tiktok"]);
const WHEEL_COLORS = ["#E85D04", "#0E7C6F", "#D94B3D", "#C9A227", "#7B4B94", "#1D4E89", "#9B2C4A", "#127C6A"];

const taskIcons: Record<string, typeof Check> = {
  youtube: PlayCircle,
  instagram: Instagram,
  tiktok: Music2,
  "weekly-orders": ShoppingBag,
  "monthly-orders": ShoppingBag,
  "wholesale-order": Package,
  "whatsapp-share": Share2,
  "refer-reseller": Users,
};

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

type RewardProduct = {
  id: string;
  title?: string;
  name?: string;
  imageUrl?: string;
  image?: string;
  images?: Array<string | { url?: string }>;
};

type GuestRewardWin = {
  id: string;
  prizeId: string;
  name: string;
  type: RewardPrizeType;
  points: number;
  productId?: string;
  voucherCode?: string;
  voucherAmount?: number;
  imageUrl?: string;
  status: "pending";
};

type ResellerHomeSettings = {
  resellerTasks?: ResellerTask[];
  resellerTiers?: ResellerTier[];
  resellerVoucherImages?: Record<string, string>;
  resellerMonthlyChallenge?: { targetOrders?: number; cashReward?: number; giftTitle?: string; active?: boolean };
};

type Voucher = {
  id: string;
  title: string;
  description: string;
  requirement: string;
  icon: string;
  art: string;
  minOrders: number;
  imageUrl?: string;
};

function rewardDayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

function weightedPrize(prizes: RewardPrize[]) {
  const active = prizes.filter(
    (prize) => prize.active !== false && Number(prize.probability) > 0 && Number(prize.stock ?? 1) > 0,
  );
  const total = active.reduce((sum, prize) => sum + Number(prize.probability || 0), 0);
  if (!active.length || total <= 0) return null;
  let cursor = Math.random() * total;
  for (const prize of active) {
    cursor -= Number(prize.probability || 0);
    if (cursor <= 0) return prize;
  }
  return active[active.length - 1];
}

function readGuestWallet() {
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    return raw ? ({ ...EMPTY_WALLET, ...JSON.parse(raw) } as RewardWallet) : EMPTY_WALLET;
  } catch {
    return EMPTY_WALLET;
  }
}

function appendGuestWin(win: GuestRewardWin) {
  try {
    const raw = window.localStorage.getItem(GUEST_WINS_KEY);
    const current: GuestRewardWin[] = raw ? JSON.parse(raw) : [];
    window.localStorage.setItem(GUEST_WINS_KEY, JSON.stringify([...current, win]));
  } catch {
    // Keep the visible win even if guest storage is unavailable.
  }
}

function rewardLabel(prize: RewardPrize) {
  if (prize.type === "points") return `+${Number(prize.points || 0).toLocaleString()} points`;
  if (prize.type === "free-delivery") return "Free delivery unlocked";
  if (prize.type === "coupon") {
    return prize.voucherAmount
      ? `Rs. ${Number(prize.voucherAmount).toLocaleString()} voucher`
      : "Voucher unlocked";
  }
  if (prize.type === "product") return prize.name || "Free product unlocked";
  return "Try again tomorrow";
}

function premiumVoucherImage(title: string, art: string, icon: string) {
  const safeTitle = title.replace(/[<>&]/g, "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='${art}'/><stop offset='1' stop-color='#14140F'/></linearGradient></defs><rect width='640' height='360' rx='36' fill='url(#g)'/><circle cx='540' cy='60' r='110' fill='white' opacity='.12'/><text x='52' y='142' font-size='78' font-family='Arial'>${icon}</text><text x='52' y='230' fill='white' font-size='34' font-weight='800' font-family='Arial'>${safeTitle}</text><text x='52' y='276' fill='white' opacity='.72' font-size='18' font-family='Arial' letter-spacing='4'>PRIMEHUB PREMIUM REWARD</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function rewardProductImage(product?: RewardProduct) {
  if (!product) return "";
  if (product.imageUrl) return product.imageUrl;
  if (product.image) return product.image;
  const first = product.images?.[0];
  return typeof first === "string" ? first : first?.url || "";
}

export default function HomeResellerClubRail() {
  const { settings } = useSettings();
  const homeSettings = settings as typeof settings & ResellerHomeSettings;
  const tasks = useMemo(
    () => (homeSettings.resellerTasks?.length ? homeSettings.resellerTasks : DEFAULT_RESELLER_TASKS)
      .filter((task) => task.active !== false),
    [homeSettings.resellerTasks],
  );
  const tiers = useMemo(
    () => (homeSettings.resellerTiers?.length ? [...homeSettings.resellerTiers] : getResellerTiers())
      .sort((a, b) => a.minMonthlyOrders - b.minMonthlyOrders),
    [homeSettings.resellerTiers],
  );

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [wallet, setWallet] = useState<RewardWallet>(EMPTY_WALLET);
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>(DEFAULT_REWARD_SETTINGS);
  const [rewardGifts, setRewardGifts] = useState<RewardGift[]>([]);
  const [rewardProducts, setRewardProducts] = useState<Record<string, RewardProduct>>({});
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelResult, setWheelResult] = useState("");

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
      stopWallet = onSnapshot(doc(db, "user_rewards", currentUser.uid), (snapshot) => {
        setWallet({ ...EMPTY_WALLET, ...(snapshot.data() || {}) } as RewardWallet);
      }, () => undefined);
      stopProfile = onSnapshot(doc(db, "reseller_profiles", currentUser.uid), (snapshot) => {
        setProfile(snapshot.exists() ? (snapshot.data() as ResellerProfile) : null);
      }, () => undefined);
    });
    return () => {
      stopAuth();
      stopWallet?.();
      stopProfile?.();
    };
  }, []);

  useEffect(() => {
    const stopSettings = onSnapshot(doc(db, "settings", "rewards"), (snapshot) => {
      const data = snapshot.data() || {};
      setRewardSettings({
        ...DEFAULT_REWARD_SETTINGS,
        ...data,
        spinWheelSlots: Array.isArray(data.spinWheelSlots) ? data.spinWheelSlots : [],
      });
    }, () => undefined);
    const stopGifts = onSnapshot(collection(db, "reward_gifts"), (snapshot) => {
      setRewardGifts(snapshot.docs
        .map((row) => ({ id: row.id, ...row.data() }) as RewardGift)
        .filter((gift) => gift.active !== false && Number(gift.pointsCost || 0) > 0 && Number(gift.stock ?? 1) > 0));
    }, () => undefined);
    const stopProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const next: Record<string, RewardProduct> = {};
      snapshot.docs.forEach((row) => { next[row.id] = { id: row.id, ...row.data() } as RewardProduct; });
      setRewardProducts(next);
    }, () => undefined);
    return () => { stopSettings(); stopGifts(); stopProducts(); };
  }, []);

  function saveGuestWallet(next: RewardWallet) {
    setWallet(next);
    try { window.localStorage.setItem(GUEST_KEY, JSON.stringify(next)); } catch { /* keep in-memory state */ }
  }

  async function checkInReward() {
    if (rewardBusy || wallet.lastCheckIn === rewardDayKey()) return;
    setRewardBusy(true);
    setRewardMessage("");
    try {
      const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" })
        .format(new Date(Date.now() - 86400000));
      const nextStreak = wallet.lastCheckIn === yesterday
        ? Math.min(7, Math.max(1, Number(wallet.streak || 0)) + 1)
        : 1;
      const points = Math.max(0, Number(rewardSettings.checkInRewards?.[nextStreak - 1] ?? 10));
      if (user) {
        await runTransaction(db, async (transaction) => {
          const ref = doc(db, "user_rewards", user.uid);
          const snapshot = await transaction.get(ref);
          const current = { ...EMPTY_WALLET, ...(snapshot.data() || {}) } as RewardWallet;
          if (current.lastCheckIn === rewardDayKey()) throw new Error("Already checked in today.");
          transaction.set(ref, {
            ...current,
            points: Number(current.points || 0) + points,
            streak: nextStreak,
            lastCheckIn: rewardDayKey(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        });
      } else if (rewardSettings.guestMode !== false) {
        saveGuestWallet({ ...wallet, points: Number(wallet.points || 0) + points, streak: nextStreak, lastCheckIn: rewardDayKey() });
      } else {
        throw new Error("Rewards are temporarily available to members only.");
      }
      setRewardMessage(`+${points} points collected.`);
    } catch (error) {
      setRewardMessage(error instanceof Error ? error.message : "Check-in failed.");
    } finally {
      setRewardBusy(false);
    }
  }

  async function commitSpinPrize(prize: RewardPrize) {
    const points = prize.type === "points" ? Math.max(0, Number(prize.points || 0)) : 0;
    const voucherCode = prize.type === "coupon" || prize.type === "free-delivery"
      ? prize.voucherCode?.trim() || `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      : "";
    const win: GuestRewardWin = {
      id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      prizeId: prize.id,
      name: prize.name,
      type: prize.type,
      points,
      productId: prize.productId || "",
      voucherCode,
      voucherAmount: Number(prize.voucherAmount || 0),
      imageUrl: prize.imageUrl || "",
      status: "pending",
    };

    if (user) {
      await runTransaction(db, async (transaction) => {
        const walletRef = doc(db, "user_rewards", user.uid);
        const snapshot = await transaction.get(walletRef);
        const current = { ...EMPTY_WALLET, ...(snapshot.data() || {}) } as RewardWallet;
        if (current.lastSpin === rewardDayKey()) throw new Error("Come back tomorrow for your next spin.");
        transaction.set(walletRef, {
          ...current,
          points: Number(current.points || 0) + points,
          lastSpin: rewardDayKey(),
          coupons: voucherCode ? [...(current.coupons || []), voucherCode] : current.coupons || [],
          updatedAt: serverTimestamp(),
        }, { merge: true });
        if (prize.type !== "points" && prize.type !== "try-again") {
          transaction.set(doc(collection(db, "reward_wins")), { ...win, userId: user.uid, createdAt: serverTimestamp() });
        }
      });
    } else {
      saveGuestWallet({
        ...wallet,
        points: Number(wallet.points || 0) + points,
        lastSpin: rewardDayKey(),
        coupons: voucherCode ? [...(wallet.coupons || []), voucherCode] : wallet.coupons || [],
      });
      if (prize.type !== "points" && prize.type !== "try-again") appendGuestWin(win);
    }
  }

  function spinReward() {
    if (rewardBusy || wallet.lastSpin === rewardDayKey()) return;
    if (!user && rewardSettings.guestMode === false) {
      window.location.href = "/reseller/join?redirect=/";
      return;
    }
    const prizes = (rewardSettings.spinWheelSlots || []).filter(
      (prize) => prize.active !== false && Number(prize.stock ?? 1) > 0 && Number(prize.probability || 0) > 0,
    );
    const prize = weightedPrize(prizes);
    if (!prize) {
      setRewardMessage("Spin prizes are being refreshed.");
      return;
    }
    const winnerIndex = Math.max(0, prizes.findIndex((item) => item.id === prize.id));
    const slice = 360 / Math.max(1, prizes.length);
    const target = 360 - (winnerIndex * slice + slice / 2);
    setRewardBusy(true);
    setWheelResult("");
    setRewardMessage("Spinning…");
    setWheelRotation((current) => current + 1440 + target);
    window.setTimeout(async () => {
      try {
        await commitSpinPrize(prize);
        const label = rewardLabel(prize);
        setWheelResult(label);
        setRewardMessage(label);
      } catch (error) {
        setRewardMessage(error instanceof Error ? error.message : "Spin failed.");
      } finally {
        setRewardBusy(false);
      }
    }, 3200);
  }

  async function redeemGift(gift: RewardGift) {
    if (rewardBusy) return;
    if (!user) {
      window.location.href = "/reseller/join?redirect=/";
      return;
    }
    const cost = Math.max(0, Number(gift.pointsCost || 0));
    if (Number(wallet.points || 0) < cost) {
      setRewardMessage(`You need ${(cost - Number(wallet.points || 0)).toLocaleString()} more points.`);
      return;
    }
    setRewardBusy(true);
    setRewardMessage("");
    try {
      await runTransaction(db, async (transaction) => {
        const walletRef = doc(db, "user_rewards", user.uid);
        const redemptionRef = doc(collection(db, "reward_redemptions"));
        const snapshot = await transaction.get(walletRef);
        const current = { ...EMPTY_WALLET, ...(snapshot.data() || {}) } as RewardWallet;
        if (Number(current.points || 0) < cost) throw new Error("Not enough points.");
        transaction.set(walletRef, { ...current, points: Number(current.points || 0) - cost, updatedAt: serverTimestamp() }, { merge: true });
        transaction.set(redemptionRef, {
          userId: user.uid,
          giftId: gift.id,
          productId: gift.productId || "",
          pointsCost: cost,
          status: "pending",
          fulfillment: "reward",
          freeDelivery: true,
          deliveryFee: 0,
          createdAt: serverTimestamp(),
          rewardType: "points-store",
          rewardName: gift.title || "Reward Gift",
        });
      });
      setRewardMessage("Gift redeemed — FREE DELIVERY included.");
    } catch (error) {
      setRewardMessage(error instanceof Error ? error.message : "Gift redemption failed.");
    } finally {
      setRewardBusy(false);
    }
  }

  const monthlyOrders = Math.max(0, Number(profile?.monthlyOrders || 0));
  const cashAvailable = Math.max(0, Number(profile?.walletAvailable || 0));
  const cashPending = Math.max(0, Number(profile?.walletPending || 0));
  const currentTier = [...tiers].reverse().find((tier) => monthlyOrders >= Number(tier.minMonthlyOrders || 0)) || tiers[0];
  const currentTierIndex = Math.max(0, tiers.findIndex((tier) => tier.id === currentTier?.id));
  const challenge = homeSettings.resellerMonthlyChallenge || {};
  const challengeTarget = Math.max(1, Number(challenge.targetOrders || 10));
  const voucherImages = homeSettings.resellerVoucherImages || {};

  const vouchers = useMemo<Voucher[]>(() => [
    { id: "cash-500", title: "Rs. 500 Cash", description: "Credit to wallet", requirement: "5 orders", icon: "₨", art: "#0E7C6F", minOrders: 5, imageUrl: voucherImages["cash-500"] },
    { id: "challenge-cash", title: `Rs. ${Number(challenge.cashReward || 1000).toLocaleString()} Cash`, description: "Monthly challenge", requirement: `${challengeTarget} orders`, icon: "₨", art: "#127C6A", minOrders: challengeTarget, imageUrl: voucherImages["challenge-cash"] },
    { id: "challenge-gift", title: challenge.giftTitle || "PrimeHub Gift Box", description: "Surprise bangles gift", requirement: `${challengeTarget} orders`, icon: "🎁", art: "#D94B3D", minOrders: challengeTarget, imageUrl: voucherImages["challenge-gift"] },
    { id: "bridal-gift", title: "Bridal Gift Voucher", description: "Free bridal pouch", requirement: "Gold tier", icon: "💍", art: "#9B2C4A", minOrders: 20, imageUrl: voucherImages["bridal-gift"] },
    { id: "wholesale-off", title: "10% Wholesale Off", description: "Next wholesale order", requirement: "3 orders", icon: "%", art: "#E85D04", minOrders: 3, imageUrl: voucherImages["wholesale-off"] },
    { id: "free-delivery", title: "Free Delivery", description: "On any one order", requirement: "2 orders", icon: "📦", art: "#1D4E89", minOrders: 2, imageUrl: voucherImages["free-delivery"] },
    { id: "jazzcash-300", title: "JazzCash Rs. 300", description: "Payout voucher", requirement: "8 orders", icon: "📱", art: "#C1121F", minOrders: 8, imageUrl: voucherImages["jazzcash-300"] },
    { id: "easypaisa-300", title: "EasyPaisa Rs. 300", description: "Payout voucher", requirement: "8 orders", icon: "📱", art: "#2A9D8F", minOrders: 8, imageUrl: voucherImages["easypaisa-300"] },
    { id: "kids-gift", title: "Kids Deal Box Gift", description: "Kids gift voucher", requirement: "6 orders", icon: "🎀", art: "#7B4B94", minOrders: 6, imageUrl: voucherImages["kids-gift"] },
    { id: "elite-cash", title: "Rs. 2,000 Elite", description: "Elite members only", requirement: "Elite 40+", icon: "👑", art: "#C9A227", minOrders: 40, imageUrl: voucherImages["elite-cash"] },
  ], [challenge.cashReward, challenge.giftTitle, challengeTarget, voucherImages]);

  const wheelPrizes = (rewardSettings.spinWheelSlots || []).filter(
    (prize) => prize.active !== false && Number(prize.stock ?? 1) > 0 && Number(prize.probability || 0) > 0,
  );
  const wheelGradient = wheelPrizes.length
    ? `conic-gradient(${wheelPrizes.map((_, index) => {
        const slice = 360 / wheelPrizes.length;
        return `${WHEEL_COLORS[index % WHEEL_COLORS.length]} ${index * slice}deg ${(index + 1) * slice}deg`;
      }).join(",")})`
    : "conic-gradient(#E85D04 0 72deg,#0E7C6F 72deg 144deg,#D94B3D 144deg 216deg,#C9A227 216deg 288deg,#7B4B94 288deg 360deg)";

  const nextCheckInReward = Number(
    rewardSettings.checkInRewards?.[Math.min(6, Math.max(0, Number(wallet.streak || 0)))] ?? 10,
  );

  if (!tasks.length && !rewardGifts.length && !tiers.length) return null;

  return (
    <section className="home-reseller-club-v2" id="reseller-club-home">
      <HomeHeading>
        <Link className="home-reseller-heading-link" href="/reseller/dashboard">Reseller Club</Link>
      </HomeHeading>
      <p className="home-reseller-v2-note">Swipe — same Reseller Club rewards, tiers, vouchers, wallet, gifts and tasks directly on Home.</p>

      <div className="home-reseller-v2-rail" aria-label="Reseller Club rewards. Swipe horizontally for more.">
        <article className="reseller-v2-card checkin-card">
          <div className="reseller-v2-card-head"><span className="eyebrow">Weekly streak</span><b>{Math.min(7, Number(wallet.streak || 0))}/7</b></div>
          <h3>7-Day Check-in</h3>
          <p>Check in every day and unlock higher point rewards.</p>
          <div className="reseller-v2-checkin-grid">
            {Array.from({ length: 7 }, (_, index) => {
              const complete = index < Number(wallet.streak || 0);
              return <span key={index} className={complete ? "done" : ""}><b>D{index + 1}</b><small>+{Number(rewardSettings.checkInRewards?.[index] ?? 0)}</small></span>;
            })}
          </div>
          <button type="button" onClick={() => void checkInReward()} disabled={rewardBusy || wallet.lastCheckIn === rewardDayKey()}>
            {wallet.lastCheckIn === rewardDayKey() ? "✓ Checked in today" : `Check in +${nextCheckInReward} points`}
          </button>
        </article>

        <article className="reseller-v2-card wheel-card">
          <div className="reseller-v2-card-head"><span className="eyebrow">Spin & win</span><b>{wallet.lastSpin === rewardDayKey() ? "USED" : "1 SPIN"}</b></div>
          <h3>Your reward wheel</h3>
          <p>Spin to reveal today’s real prize from Admin settings.</p>
          <div className="reseller-v2-wheel-wrap">
            <div className="reseller-v2-wheel-pointer" />
            <div className="reseller-v2-wheel" style={{ transform: `rotate(${wheelRotation}deg)`, background: wheelGradient }}>
              {(wheelPrizes.length ? wheelPrizes : [{ id: "gift", name: "Gift" }, { id: "delivery", name: "Delivery" }, { id: "voucher", name: "Voucher" }, { id: "points", name: "Points" }, { id: "again", name: "Try Again" }]).map((prize: any, index: number, list: any[]) => {
                const angle = index * (360 / list.length) + (360 / list.length) / 2;
                return <span key={prize.id || index} style={{ transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-70px) rotate(-${angle}deg)` }}>{String(prize.name || "Prize").slice(0, 12)}</span>;
              })}
              <b className="reseller-v2-wheel-center">WIN</b>
            </div>
          </div>
          <button type="button" onClick={spinReward} disabled={rewardBusy || wallet.lastSpin === rewardDayKey()}>
            {rewardBusy ? "Spinning…" : wallet.lastSpin === rewardDayKey() ? "Come back tomorrow" : "Spin the wheel"}
          </button>
          {wheelResult ? <strong className="reseller-v2-result">You got: {wheelResult}</strong> : null}
        </article>

        <article className="reseller-v2-card tiers-card">
          <div className="reseller-v2-card-head"><span className="eyebrow gold">Prime loyalty program</span><b>{tiers.length} TIERS</b></div>
          <h3>Your reseller tiers</h3>
          <p>Current tier: <strong>{currentTier?.name || "Starter"}</strong></p>
          <div className="reseller-v2-tier-grid">
            {tiers.map((tier, index) => {
              const active = tier.id === currentTier?.id;
              const benefits = tier.benefits?.length ? tier.benefits : ["Member-only prices", "Earn points on tasks", "Access club rewards"];
              return (
                <div key={tier.id} className={`reseller-v2-tier tier-${index + 1} ${active ? "current" : ""}`}>
                  <div className="tier-top"><i>{index + 1}</i>{active ? <em>CURRENT</em> : null}</div>
                  <h4>{tier.name}</h4>
                  <small>{tier.minMonthlyOrders}+ monthly orders</small>
                  <div className="tier-discount">{Number(tier.discountPercent || 0)}% <span>OFF</span></div>
                  {benefits.slice(0, 3).map((benefit, n) => <p key={n}><Check size={12} />{benefit}</p>)}
                  <b>{active ? "Your current tier" : index <= currentTierIndex ? "Unlocked" : `Need ${Math.max(0, tier.minMonthlyOrders - monthlyOrders)} orders`}</b>
                </div>
              );
            })}
          </div>
        </article>

        <article className="reseller-v2-card wallet-card">
          <div className="reseller-v2-card-head"><span className="eyebrow">Reward wallet</span><b>LIVE</b></div>
          <h3>Your wallets</h3>
          <div className="reseller-v2-wallet-grid">
            <div><WalletCards size={18}/><small>Cash wallet</small><strong>Rs. {cashAvailable.toLocaleString()}</strong><span>Pending Rs. {cashPending.toLocaleString()}</span></div>
            <div><Coins size={18}/><small>Points wallet</small><strong>{Number(wallet.points || 0).toLocaleString()}</strong><span>Reward points</span></div>
          </div>
          <Link className="reseller-v2-link-button" href={profile ? "/reseller/wallet" : "/reseller/join"}>{profile ? "Open wallet" : "Join Reseller Club"}<ArrowRight size={14}/></Link>
        </article>

        {vouchers.map((voucher) => {
          const locked = monthlyOrders < voucher.minOrders;
          return (
            <article className="reseller-v2-card voucher-card" key={voucher.id}>
              <div className="reseller-v2-voucher-art" style={{ background: voucher.art }}>
                <img src={voucher.imageUrl || premiumVoucherImage(voucher.title, voucher.art, voucher.icon)} alt={voucher.title}/>
                {locked ? <span><Lock size={11}/>Locked</span> : <span className="unlocked"><Check size={11}/>Unlocked</span>}
              </div>
              <div className="reseller-v2-voucher-copy">
                <h3>{voucher.title}</h3>
                <p>{voucher.description}</p>
                <strong>{voucher.requirement}</strong>
                <Link href="/reseller/dashboard">View reward <ArrowRight size={13}/></Link>
              </div>
            </article>
          );
        })}

        {rewardGifts.map((gift) => {
          const product = gift.productId ? rewardProducts[gift.productId] : undefined;
          const image = normalizeImageUrl(gift.imageUrl || rewardProductImage(product));
          const need = Math.max(0, Number(gift.pointsCost || 0) - Number(wallet.points || 0));
          return (
            <article className="reseller-v2-card gift-card" key={gift.id}>
              <div className="reseller-v2-gift-image">{image ? <img src={image} alt={gift.title || product?.title || "Reward gift"}/> : <Gift size={46}/>}</div>
              <span className="eyebrow">Point store</span>
              <h3>{gift.title || product?.title || product?.name || "PrimeHub Reward Gift"}</h3>
              <p>FREE DELIVERY included.</p>
              <strong>{Number(gift.pointsCost || 0).toLocaleString()} points</strong>
              <button type="button" disabled={rewardBusy || need > 0} onClick={() => void redeemGift(gift)}>{need ? `Need ${need.toLocaleString()} more` : "Redeem gift"}</button>
            </article>
          );
        })}

        {tasks.map((task) => {
          const Icon = taskIcons[task.id] || Check;
          const social = SOCIAL_TASK_IDS.has(task.id);
          const href = task.url || `/reseller/tasks#${encodeURIComponent(task.id)}`;
          return (
            <article className="reseller-v2-card task-card" key={task.id}>
              <span className="reseller-v2-task-icon"><Icon size={22}/></span>
              <span className="eyebrow">Reseller task</span>
              <h3>{task.title}</h3>
              <p>{task.description}</p>
              <strong>{Number(task.reward || 0) > 0 ? `+${Number(task.reward).toLocaleString()} ${task.id.includes("orders") ? "reward" : "points"}` : "Automatic progress"}</strong>
              <Link className="reseller-v2-link-button" href={href} target={social && href.startsWith("http") ? "_blank" : undefined} rel={social && href.startsWith("http") ? "noreferrer" : undefined}>{social ? "Open task" : "View progress"}<ArrowRight size={14}/></Link>
            </article>
          );
        })}
      </div>

      {rewardMessage ? <div className="reseller-v2-message" role="status">{rewardMessage}</div> : null}
      <Link className="home-view-all home-club-view-all" href="/reseller/dashboard">Open full Reseller Club <ArrowRight size={14}/></Link>
    </section>
  );
}
