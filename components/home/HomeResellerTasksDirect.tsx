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
  CheckCircle2,
  Coins,
  Copy,
  Crown,
  Gift,
  Instagram,
  Music2,
  Package,
  PlayCircle,
  Share2,
  ShoppingBag,
  Sparkles,
  TicketPercent,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import HomeHeading from "./HomeHeading";
import { useSettings } from "@/lib/useSettings";
import { DEFAULT_RESELLER_TASKS, type ResellerTask } from "@/lib/resellerTasks";
import { getResellerTiers } from "@/lib/resellerTiers";
import type { ResellerProfile, ResellerTier } from "@/lib/resellerTypes";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { auth, db } from "@/lib/firebase";

const GUEST_KEY = "phdeals-guest-rewards";
const GUEST_WINS_KEY = "phdeals-guest-reward-wins";
const SOCIAL_TASK_IDS = new Set(["youtube", "instagram", "tiktok"]);

const taskIcons: Record<string, typeof CheckCircle2> = {
  youtube: PlayCircle,
  instagram: Instagram,
  tiktok: Music2,
  "weekly-orders": ShoppingBag,
  "monthly-orders": ShoppingBag,
  "wholesale-order": Package,
  "whatsapp-share": Share2,
  "refer-reseller": Users,
};

const DEFAULT_REWARD_SETTINGS: RewardSettings = {
  guestMode: true,
  checkInRewards: [10, 15, 20, 25, 30, 50, 100],
  spinWheelSlots: [],
};

const EMPTY_WALLET: RewardWallet = {
  points: 0,
  streak: 0,
  coupons: [],
};

type RewardWallet = {
  points: number;
  streak: number;
  lastCheckIn?: string;
  lastSpin?: string;
  coupons?: string[];
};

type RewardPrizeType =
  | "product"
  | "points"
  | "free-delivery"
  | "coupon"
  | "try-again";

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
};

function rewardDayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
  }).format(new Date());
}

function weightedPrize(prizes: RewardPrize[]) {
  const active = prizes.filter(
    (prize) =>
      prize.active !== false &&
      Number(prize.probability) > 0 &&
      Number(prize.stock ?? 1) > 0,
  );
  const total = active.reduce(
    (sum, prize) => sum + Number(prize.probability || 0),
    0,
  );
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
    return raw
      ? ({ ...EMPTY_WALLET, ...JSON.parse(raw) } as RewardWallet)
      : EMPTY_WALLET;
  } catch {
    return EMPTY_WALLET;
  }
}

function appendGuestWin(win: GuestRewardWin) {
  try {
    const raw = window.localStorage.getItem(GUEST_WINS_KEY);
    const current: GuestRewardWin[] = raw ? JSON.parse(raw) : [];
    window.localStorage.setItem(
      GUEST_WINS_KEY,
      JSON.stringify([...current, win]),
    );
  } catch {
    // Guest rewards remain usable even if local storage is unavailable.
  }
}

function rewardLabel(prize: RewardPrize) {
  if (prize.type === "points")
    return `+${Number(prize.points || 0).toLocaleString()} points`;
  if (prize.type === "free-delivery") return "Free delivery unlocked";
  if (prize.type === "coupon")
    return prize.voucherAmount
      ? `Rs. ${Number(prize.voucherAmount).toLocaleString()} voucher`
      : "Voucher unlocked";
  if (prize.type === "product") return "Free product unlocked";
  return "Try again tomorrow";
}

export default function HomeResellerTasksDirect() {
  const { settings } = useSettings();
  const homeSettings = settings as typeof settings & ResellerHomeSettings;
  const tasks = useMemo(
    () =>
      (homeSettings.resellerTasks?.length
        ? homeSettings.resellerTasks
        : DEFAULT_RESELLER_TASKS
      ).filter((task) => task.active !== false),
    [homeSettings.resellerTasks],
  );
  const tiers = useMemo(
    () =>
      homeSettings.resellerTiers?.length
        ? [...homeSettings.resellerTiers].sort(
            (a, b) => a.minMonthlyOrders - b.minMonthlyOrders,
          )
        : getResellerTiers(),
    [homeSettings.resellerTiers],
  );

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [wallet, setWallet] = useState<RewardWallet>(EMPTY_WALLET);
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>(
    DEFAULT_REWARD_SETTINGS,
  );
  const [rewardGifts, setRewardGifts] = useState<RewardGift[]>([]);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");
  const [proofTask, setProofTask] = useState<ResellerTask | null>(null);
  const [proofValue, setProofValue] = useState("");
  const [taskBusy, setTaskBusy] = useState("");
  const [submittedTasks, setSubmittedTasks] = useState<string[]>([]);

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
      stopWallet = onSnapshot(
        doc(db, "user_rewards", currentUser.uid),
        (snapshot) =>
          setWallet({
            ...EMPTY_WALLET,
            ...(snapshot.data() || {}),
          } as RewardWallet),
        () => undefined,
      );
      stopProfile = onSnapshot(
        doc(db, "reseller_profiles", currentUser.uid),
        (snapshot) =>
          setProfile(
            snapshot.exists() ? (snapshot.data() as ResellerProfile) : null,
          ),
        () => undefined,
      );
    });
    return () => {
      stopAuth();
      stopWallet?.();
      stopProfile?.();
    };
  }, []);

  useEffect(() => {
    const stopSettings = onSnapshot(
      doc(db, "settings", "rewards"),
      (snapshot) => {
        const data = snapshot.data() || {};
        setRewardSettings({
          ...DEFAULT_REWARD_SETTINGS,
          ...data,
          spinWheelSlots: Array.isArray(data.spinWheelSlots)
            ? data.spinWheelSlots
            : [],
        });
      },
      () => undefined,
    );
    const stopGifts = onSnapshot(
      collection(db, "reward_gifts"),
      (snapshot) =>
        setRewardGifts(
          snapshot.docs
            .map((row) => ({ id: row.id, ...row.data() }) as RewardGift)
            .filter(
              (gift) =>
                gift.active !== false &&
                Number(gift.pointsCost || 0) > 0 &&
                Number(gift.stock ?? 1) > 0,
            ),
        ),
      () => undefined,
    );
    return () => {
      stopSettings();
      stopGifts();
    };
  }, []);

  function saveGuestWallet(next: RewardWallet) {
    setWallet(next);
    try {
      window.localStorage.setItem(GUEST_KEY, JSON.stringify(next));
    } catch {
      // Keep the in-memory wallet for this visit.
    }
  }

  async function checkInReward() {
    if (rewardBusy || wallet.lastCheckIn === rewardDayKey()) return;
    setRewardBusy(true);
    setRewardMessage("");
    try {
      const yesterday = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
      }).format(new Date(Date.now() - 86400000));
      const nextStreak =
        wallet.lastCheckIn === yesterday
          ? Math.min(7, Math.max(1, Number(wallet.streak || 0)) + 1)
          : 1;
      const points = Math.min(
        100,
        Math.max(
          0,
          Number(rewardSettings.checkInRewards?.[nextStreak - 1] ?? 10),
        ),
      );

      if (user) {
        await runTransaction(db, async (transaction) => {
          const ref = doc(db, "user_rewards", user.uid);
          const snapshot = await transaction.get(ref);
          const current = {
            ...EMPTY_WALLET,
            ...(snapshot.data() || {}),
          } as RewardWallet;
          if (current.lastCheckIn === rewardDayKey())
            throw new Error("Already checked in today.");
          transaction.set(
            ref,
            {
              ...current,
              points: Number(current.points || 0) + points,
              streak: nextStreak,
              lastCheckIn: rewardDayKey(),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        });
      } else if (rewardSettings.guestMode !== false) {
        saveGuestWallet({
          ...wallet,
          points: Number(wallet.points || 0) + points,
          streak: nextStreak,
          lastCheckIn: rewardDayKey(),
        });
      } else {
        throw new Error("Rewards are temporarily available to members only.");
      }
      setRewardMessage(`+${points} points collected.`);
    } catch (error) {
      setRewardMessage(
        error instanceof Error ? error.message : "Check-in failed.",
      );
    } finally {
      setRewardBusy(false);
    }
  }

  async function spinReward() {
    if (rewardBusy || wallet.lastSpin === rewardDayKey()) return;
    if (!user && rewardSettings.guestMode === false) {
      window.location.href = "/reseller/join?redirect=/rewards";
      return;
    }
    const prizes = (rewardSettings.spinWheelSlots || []).filter(
      (prize) => prize.active !== false,
    );
    const prize = weightedPrize(prizes);
    if (!prize) {
      setRewardMessage("Spin prizes are being refreshed.");
      return;
    }

    setRewardBusy(true);
    setRewardMessage("Spinning…");
    try {
      const points =
        prize.type === "points"
          ? Math.min(100, Math.max(0, Number(prize.points || 0)))
          : 0;
      const voucherCode =
        prize.type === "coupon" || prize.type === "free-delivery"
          ? prize.voucherCode?.trim() ||
            `PH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
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
          const current = {
            ...EMPTY_WALLET,
            ...(snapshot.data() || {}),
          } as RewardWallet;
          if (current.lastSpin === rewardDayKey())
            throw new Error("Come back tomorrow for your next spin.");
          transaction.set(
            walletRef,
            {
              ...current,
              points: Number(current.points || 0) + points,
              lastSpin: rewardDayKey(),
              coupons: voucherCode
                ? [...(current.coupons || []), voucherCode]
                : current.coupons || [],
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          if (prize.type !== "points" && prize.type !== "try-again") {
            transaction.set(doc(collection(db, "reward_wins")), {
              ...win,
              userId: user.uid,
              createdAt: serverTimestamp(),
            });
          }
        });
      } else {
        saveGuestWallet({
          ...wallet,
          points: Number(wallet.points || 0) + points,
          lastSpin: rewardDayKey(),
          coupons: voucherCode
            ? [...(wallet.coupons || []), voucherCode]
            : wallet.coupons || [],
        });
        if (prize.type !== "points" && prize.type !== "try-again")
          appendGuestWin(win);
      }
      window.setTimeout(() => {
        setRewardMessage(rewardLabel(prize));
        setRewardBusy(false);
      }, 650);
    } catch (error) {
      setRewardMessage(
        error instanceof Error ? error.message : "Spin failed.",
      );
      setRewardBusy(false);
    }
  }

  async function redeemGift(gift: RewardGift) {
    if (rewardBusy) return;
    if (!user) {
      window.location.href = "/login?redirect=/rewards#redeem-rewards";
      return;
    }
    const cost = Math.max(0, Number(gift.pointsCost || 0));
    if (Number(wallet.points || 0) < cost) {
      setRewardMessage(
        `You need ${(cost - Number(wallet.points || 0)).toLocaleString()} more points.`,
      );
      return;
    }
    setRewardBusy(true);
    setRewardMessage("");
    try {
      await runTransaction(db, async (transaction) => {
        const walletRef = doc(db, "user_rewards", user.uid);
        const redemptionRef = doc(collection(db, "reward_redemptions"));
        const snapshot = await transaction.get(walletRef);
        const current = {
          ...EMPTY_WALLET,
          ...(snapshot.data() || {}),
        } as RewardWallet;
        if (Number(current.points || 0) < cost)
          throw new Error(
            `You need ${(cost - Number(current.points || 0)).toLocaleString()} more points.`,
          );
        transaction.set(
          walletRef,
          {
            ...current,
            points: Number(current.points || 0) - cost,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
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
      setRewardMessage(
        error instanceof Error ? error.message : "Gift redemption failed.",
      );
    } finally {
      setRewardBusy(false);
    }
  }

  async function recordSocialOpen(task: ResellerTask) {
    if (!user || !profile) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/reseller/task-claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ taskId: task.id, action: "open" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Task open could not be recorded.");
      }
    } catch (error) {
      setRewardMessage(
        error instanceof Error ? error.message : "Task open could not be recorded.",
      );
    }
  }

  function openSocialTask(task: ResellerTask) {
    if (!task.url) {
      setRewardMessage(`Admin panel se ${task.title} ka link add karein.`);
      return;
    }
    window.open(task.url, "_blank", "noopener,noreferrer");
    void recordSocialOpen(task);
  }

  async function submitTaskProof() {
    if (!proofTask || taskBusy) return;
    if (!user || !profile) {
      window.location.href = "/reseller/join?redirect=/";
      return;
    }
    const proof = proofValue.trim();
    if (proof.length < 3) {
      setRewardMessage("Apna username ya proof link likhein.");
      return;
    }
    setTaskBusy(proofTask.id);
    setRewardMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/reseller/task-claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          taskId: proofTask.id,
          action: "submit",
          proof,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Task submit nahi hua.");
      setSubmittedTasks((current) => [...new Set([...current, proofTask.id])]);
      setRewardMessage(
        "Proof admin review ke liye submit ho gaya. Points approval ke baad milenge.",
      );
      setProofTask(null);
      setProofValue("");
    } catch (error) {
      setRewardMessage(
        error instanceof Error ? error.message : "Task submit nahi hua.",
      );
    } finally {
      setTaskBusy("");
    }
  }

  async function copyLatestVoucher() {
    const code = wallet.coupons?.[wallet.coupons.length - 1];
    if (!code) {
      setRewardMessage("No voucher code in your wallet yet. Try Spin & Win.");
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setRewardMessage(`Voucher ${code} copied.`);
    } catch {
      setRewardMessage(`Your voucher: ${code}`);
    }
  }

  const nextCheckInReward = Number(
    rewardSettings.checkInRewards?.[
      Math.min(6, Math.max(0, Number(wallet.streak || 0)))
    ] ?? 10,
  );
  const monthlyOrders = Math.max(0, Number(profile?.monthlyOrders || 0));
  const currentTier =
    [...tiers]
      .reverse()
      .find((tier) => monthlyOrders >= Number(tier.minMonthlyOrders || 0)) ||
    tiers[0];
  const cashAvailable = Math.max(0, Number(profile?.walletAvailable || 0));
  const cashPending = Math.max(0, Number(profile?.walletPending || 0));
  const voucherCount = wallet.coupons?.length || 0;

  if (!tasks.length && !rewardGifts.length) return null;

  return (
    <section className="home-club" id="reseller-tasks">
      <HomeHeading>
        <Link className="home-reseller-heading-link" href="/reseller/tasks">
          Reseller Club Tasks
        </Link>
      </HomeHeading>
      <div className="home-rail-note">
        <span>
          Swipe tasks — check in, spin, follow socials, view tier, vouchers and wallets directly.
        </span>
      </div>
      <div className="home-club-rail-wrap">
        <div
          className="home-two-row-rail home-reseller-reward-rail"
          aria-label="Reseller rewards and tasks. Swipe horizontally for more."
        >
          <article className="home-task home-reward-card">
            <span className="home-task-icon">
              <CheckCircle2 />
            </span>
            <div>
              <h3>Weekly streak</h3>
              <p>
                7-Day Check-in · {Math.min(7, Number(wallet.streak || 0))}/7
              </p>
              <strong>
                {wallet.lastCheckIn === rewardDayKey()
                  ? "Today’s points collected"
                  : `+${nextCheckInReward.toLocaleString()} points today`}
              </strong>
              <button
                type="button"
                className="home-task-button"
                disabled={rewardBusy || wallet.lastCheckIn === rewardDayKey()}
                onClick={() => void checkInReward()}
              >
                {wallet.lastCheckIn === rewardDayKey()
                  ? "Checked in"
                  : "Collect points"}
                <ArrowRight size={13} />
              </button>
            </div>
          </article>

          <article className="home-task home-reward-card home-reward-wheel-card">
            <span className="home-task-icon">
              <Sparkles />
            </span>
            <div>
              <h3>Spin & Win</h3>
              <p>Use today’s reward spin directly from the home page.</p>
              <strong>
                {wallet.lastSpin === rewardDayKey()
                  ? "Today’s spin used"
                  : "1 spin available today"}
              </strong>
              <button
                type="button"
                className="home-task-button"
                disabled={rewardBusy || wallet.lastSpin === rewardDayKey()}
                onClick={() => void spinReward()}
              >
                {wallet.lastSpin === rewardDayKey() ? "Come back tomorrow" : "Spin now"}
                <ArrowRight size={13} />
              </button>
            </div>
          </article>

          <article className="home-task home-reward-card">
            <span className="home-task-icon">
              <Coins />
            </span>
            <div>
              <h3>Points wallet</h3>
              <p>Your collected reward balance.</p>
              <strong>{Number(wallet.points || 0).toLocaleString()} points</strong>
              <Link className="home-task-button" href="/rewards">
                Open rewards <ArrowRight size={13} />
              </Link>
            </div>
          </article>

          <article className="home-task home-reward-card">
            <span className="home-task-icon">
              <WalletCards />
            </span>
            <div>
              <h3>Cash wallet</h3>
              <p>Available reseller cash plus pending earnings.</p>
              <strong>
                {profile
                  ? `Rs. ${cashAvailable.toLocaleString()} · ${cashPending.toLocaleString()} pending`
                  : "Join Reseller Club to activate"}
              </strong>
              <Link className="home-task-button" href={profile ? "/reseller/wallet" : "/reseller/join"}>
                {profile ? "Open cash wallet" : "Join now"} <ArrowRight size={13} />
              </Link>
            </div>
          </article>

          <article className="home-task home-reward-card home-tier-card">
            <span className="home-task-icon">
              <Crown />
            </span>
            <div>
              <h3>Reseller tier</h3>
              <p>{profile ? `${monthlyOrders} orders this month.` : "Tier unlocks after joining."}</p>
              <strong>{profile ? `${currentTier?.name || "Starter"} tier` : "Starter → Premium"}</strong>
              <Link className="home-task-button" href={profile ? "/reseller/dashboard" : "/reseller/join"}>
                View tiers <ArrowRight size={13} />
              </Link>
            </div>
          </article>

          <article className="home-task home-reward-card home-voucher-card">
            <span className="home-task-icon">
              <TicketPercent />
            </span>
            <div>
              <h3>Vouchers</h3>
              <p>Keep reward voucher codes ready in your wallet.</p>
              <strong>
                {voucherCount
                  ? `${voucherCount} voucher${voucherCount === 1 ? "" : "s"} available`
                  : "No voucher code yet"}
              </strong>
              <div className="home-direct-task-actions">
                <button type="button" className="home-task-button" onClick={() => void copyLatestVoucher()}>
                  <Copy size={12} /> Copy latest
                </button>
                <Link className="home-task-button home-task-button-soft" href="/reseller/dashboard">
                  View vouchers
                </Link>
              </div>
            </div>
          </article>

          <article className="home-task home-reward-card">
            <span className="home-task-icon">
              <Gift />
            </span>
            <div>
              <h3>Gift items</h3>
              <p>Redeem active PrimeHub reward gifts with points.</p>
              <strong>{rewardGifts.length} gift item{rewardGifts.length === 1 ? "" : "s"} live</strong>
              <Link className="home-task-button" href="/rewards#redeem-rewards">
                Browse gifts <ArrowRight size={13} />
              </Link>
            </div>
          </article>

          {rewardGifts.map((gift) => {
            const need = Math.max(
              0,
              Number(gift.pointsCost || 0) - Number(wallet.points || 0),
            );
            return (
              <article className="home-task home-reward-card" key={gift.id}>
                {gift.imageUrl ? (
                  <span className="home-reward-gift-image">
                    <img
                      src={normalizeImageUrl(gift.imageUrl)}
                      alt={gift.title || "Reward gift"}
                      loading="lazy"
                    />
                  </span>
                ) : (
                  <span className="home-task-icon">
                    <Gift />
                  </span>
                )}
                <div>
                  <h3>{gift.title || "PrimeHub Reward Gift"}</h3>
                  <p>Admin reward · FREE DELIVERY included.</p>
                  <strong>{Number(gift.pointsCost || 0).toLocaleString()} points</strong>
                  <button
                    type="button"
                    className="home-task-button"
                    disabled={rewardBusy || need > 0}
                    onClick={() => void redeemGift(gift)}
                  >
                    {need ? `Need ${need.toLocaleString()} more` : "Redeem gift now"}
                    <ArrowRight size={13} />
                  </button>
                </div>
              </article>
            );
          })}

          {tasks.map((task) => {
            const Icon = taskIcons[task.id] || CheckCircle2;
            const social = SOCIAL_TASK_IDS.has(task.id);
            const submitted = submittedTasks.includes(task.id);
            return (
              <article className="home-task home-reward-card" key={task.id}>
                <span className={`home-task-icon ${task.id === "instagram" ? "instagram" : ""}`}>
                  <Icon />
                </span>
                <div>
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                  <strong>
                    {Number(task.reward || 0) > 0
                      ? `+${Number(task.reward).toLocaleString()} points${social ? " after approval" : ""}`
                      : "Automatic progress"}
                  </strong>
                  {social ? (
                    <div className="home-direct-task-actions">
                      <button
                        type="button"
                        className="home-task-button home-task-button-soft"
                        onClick={() => openSocialTask(task)}
                      >
                        Open {task.id}
                      </button>
                      <button
                        type="button"
                        className="home-task-button"
                        disabled={submitted}
                        onClick={() => {
                          if (!user || !profile) {
                            window.location.href = "/reseller/join?redirect=/";
                            return;
                          }
                          setProofTask(task);
                          setProofValue("");
                        }}
                      >
                        {submitted ? "Submitted" : "Submit proof"}
                      </button>
                    </div>
                  ) : (
                    <Link className="home-task-button" href={`/reseller/tasks#${encodeURIComponent(task.id)}`}>
                      Auto tracked · view progress <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <Link className="home-view-all home-club-view-all" href="/reseller/tasks">
          View all reseller tasks <ArrowRight size={14} />
        </Link>
      </div>

      {rewardMessage ? (
        <div className="home-reward-message" role="status">
          {rewardMessage}
        </div>
      ) : null}

      {proofTask ? (
        <div className="home-task-proof-backdrop" role="presentation" onClick={() => setProofTask(null)}>
          <div
            className="home-task-proof-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-task-proof-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="home-task-proof-close"
              aria-label="Close"
              onClick={() => setProofTask(null)}
            >
              <X size={16} />
            </button>
            <small>PrimeHub Reseller Task</small>
            <h3 id="home-task-proof-title">{proofTask.title}</h3>
            <p>Platform follow/subscribe complete karne ke baad apna username ya proof link submit karein.</p>
            <input
              autoFocus
              value={proofValue}
              onChange={(event) => setProofValue(event.target.value)}
              placeholder="Username or proof link"
            />
            <button
              type="button"
              className="home-task-button"
              disabled={taskBusy === proofTask.id}
              onClick={() => void submitTaskProof()}
            >
              {taskBusy === proofTask.id ? "Submitting…" : "Submit for approval"}
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
