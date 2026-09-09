"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ElementType } from "react";
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
import { auth, db } from "@/lib/firebase";
import { normalizeImageUrl } from "@/lib/imageUrl";
import {
  DEFAULT_MONTHLY_CHALLENGE,
  DEFAULT_RESELLER_TASKS,
  DEFAULT_RESELLER_WHEEL,
  type MonthlyChallengeSettings,
  type ResellerTask,
  type ResellerWheelSettings,
} from "@/lib/resellerTasks";
import { getResellerTiers } from "@/lib/resellerTiers";
import type { ResellerProfile, ResellerTier } from "@/lib/resellerTypes";
import { useSettings } from "@/lib/useSettings";
import HomeHeading from "./HomeHeading";

const GUEST_KEY = "phdeals-guest-rewards";
const GUEST_WINS_KEY = "phdeals-guest-reward-wins";
const SOCIAL_TASK_IDS = new Set(["youtube", "instagram", "tiktok"]);
const ORDER_TASK_IDS = new Set([
  "weekly-orders",
  "monthly-orders",
  "wholesale-order",
]);

const taskIcons: Record<string, ElementType> = {
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
  resellerMonthlyChallenge?: Partial<MonthlyChallengeSettings>;
  resellerWheel?: Partial<ResellerWheelSettings>;
  resellerVoucherImages?: Record<string, string>;
};

type Voucher = {
  id: string;
  title: string;
  description: string;
  requirement: string;
  icon: string;
  minOrders: number;
  imageUrl?: string;
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
    // Keep the current visit usable when local storage is unavailable.
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

function prizeIcon(type: RewardPrizeType) {
  if (type === "points") return "⭐";
  if (type === "free-delivery") return "📦";
  if (type === "coupon") return "₨";
  if (type === "product") return "🎁";
  return "↻";
}

function rewardProductImage(product?: RewardProduct) {
  if (!product) return "";
  if (product.imageUrl) return product.imageUrl;
  if (product.image) return product.image;
  const first = product.images?.[0];
  return typeof first === "string" ? first : first?.url || "";
}

export default function HomeResellerClubFull() {
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
  const challenge = useMemo(
    () => ({
      ...DEFAULT_MONTHLY_CHALLENGE,
      ...(homeSettings.resellerMonthlyChallenge || {}),
    }),
    [homeSettings.resellerMonthlyChallenge],
  );
  const wheelSettings = useMemo(
    () => ({
      ...DEFAULT_RESELLER_WHEEL,
      ...(homeSettings.resellerWheel || {}),
    }),
    [homeSettings.resellerWheel],
  );
  const voucherImages = homeSettings.resellerVoucherImages || {};

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ResellerProfile | null>(null);
  const [wallet, setWallet] = useState<RewardWallet>(EMPTY_WALLET);
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>(
    DEFAULT_REWARD_SETTINGS,
  );
  const [rewardGifts, setRewardGifts] = useState<RewardGift[]>([]);
  const [rewardProducts, setRewardProducts] = useState<
    Record<string, RewardProduct>
  >({});
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");
  const [wheelRotation, setWheelRotation] = useState(0);
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
    const stopProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const next: Record<string, RewardProduct> = {};
        snapshot.docs.forEach((row) => {
          next[row.id] = { id: row.id, ...row.data() } as RewardProduct;
        });
        setRewardProducts(next);
      },
      () => undefined,
    );
    return () => {
      stopSettings();
      stopGifts();
      stopProducts();
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
      window.location.href = "/reseller/join?redirect=/";
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
    setWheelRotation(
      (current) => current + 1440 + Math.floor(Math.random() * 360),
    );
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
      }, 2800);
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
      window.location.href = "/login?redirect=/#home-reseller-gifts";
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
      window.location.href = "/reseller/join?redirect=/#home-reseller-tasks";
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
      setSubmittedTasks((current) => [
        ...new Set([...current, proofTask.id]),
      ]);
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

  const monthlyOrders = Math.max(0, Number(profile?.monthlyOrders || 0));
  const currentTier =
    [...tiers]
      .reverse()
      .find((tier) => monthlyOrders >= Number(tier.minMonthlyOrders || 0)) ||
    tiers[0];
  const currentTierIndex = Math.max(
    0,
    tiers.findIndex((tier) => tier.id === currentTier?.id),
  );
  const cashAvailable = Math.max(0, Number(profile?.walletAvailable || 0));
  const cashPending = Math.max(0, Number(profile?.walletPending || 0));
  const target = Math.max(1, Number(challenge.targetOrders || 10));
  const challengePercent = Math.min(
    100,
    Math.round((monthlyOrders / target) * 100),
  );
  const remainingOrders = Math.max(0, target - monthlyOrders);

  const visualPrizes = useMemo(() => {
    const configured = (rewardSettings.spinWheelSlots || [])
      .filter((prize) => prize.active !== false)
      .slice(0, 5);
    const fallback: RewardPrize[] = [
      {
        id: "try-again-fallback",
        name: "Try Again",
        type: "try-again",
        points: 0,
        probability: 1,
      },
      {
        id: "delivery-fallback",
        name: "Free Delivery",
        type: "free-delivery",
        points: 0,
        probability: 1,
      },
      {
        id: "voucher-fallback",
        name: "Rs. 300 Voucher",
        type: "coupon",
        points: 0,
        probability: 1,
      },
      {
        id: "points-fallback",
        name: "20 Points",
        type: "points",
        points: 20,
        probability: 1,
      },
      {
        id: "gift-fallback",
        name: wheelSettings.customPrizeTitle || "Mystery Gift",
        type: "product",
        points: 0,
        probability: 1,
        imageUrl: wheelSettings.customPrizeImage || "",
      },
    ];
    return [...configured, ...fallback].slice(0, 5);
  }, [rewardSettings.spinWheelSlots, wheelSettings]);

  const vouchers = useMemo<Voucher[]>(
    () => [
      {
        id: "challenge-cash",
        title: `Rs. ${Number(challenge.cashReward || 0).toLocaleString()} Cash`,
        description: "Monthly challenge cash reward",
        requirement: `${target} orders`,
        icon: "₨",
        minOrders: target,
        imageUrl: voucherImages["challenge-cash"] || "",
      },
      {
        id: "challenge-gift",
        title: challenge.giftTitle || "PrimeHub Gift Box",
        description: "Monthly challenge gift reward",
        requirement: `${target} orders`,
        icon: "🎁",
        minOrders: target,
        imageUrl: voucherImages["challenge-gift"] || "",
      },
      {
        id: "free-delivery",
        title: "Free Delivery",
        description: "One eligible order delivery reward",
        requirement: "2 orders",
        icon: "📦",
        minOrders: 2,
        imageUrl: voucherImages["free-delivery"] || "",
      },
      {
        id: "wholesale-off",
        title: "10% Wholesale Off",
        description: "Discount on an eligible wholesale order",
        requirement: "3 orders",
        icon: "%",
        minOrders: 3,
        imageUrl: voucherImages["wholesale-off"] || "",
      },
      {
        id: "jazzcash-300",
        title: "JazzCash Rs. 300",
        description: "Payout voucher after verification",
        requirement: "8 orders",
        icon: "📱",
        minOrders: 8,
        imageUrl: voucherImages["jazzcash-300"] || "",
      },
      {
        id: "easypaisa-300",
        title: "EasyPaisa Rs. 300",
        description: "Payout voucher after verification",
        requirement: "8 orders",
        icon: "📱",
        minOrders: 8,
        imageUrl: voucherImages["easypaisa-300"] || "",
      },
    ],
    [challenge.cashReward, challenge.giftTitle, target, voucherImages],
  );

  const menu = [
    { href: "#home-reseller-rewards", label: "Rewards", Icon: Sparkles },
    { href: "#home-reseller-tiers", label: "Tiers", Icon: Crown },
    { href: "#home-reseller-tasks", label: "Tasks", Icon: CheckCircle2 },
    { href: "#home-reseller-vouchers", label: "Vouchers", Icon: TicketPercent },
    { href: "#home-reseller-wallet", label: "Wallet", Icon: WalletCards },
    { href: "#home-reseller-gifts", label: "Gifts", Icon: Gift },
  ];

  return (
    <section className="home-club" id="reseller-tasks">
      <HomeHeading>
        <Link className="home-reseller-heading-link" href="/reseller/dashboard">
          PrimeHubMall Reseller Club
        </Link>
      </HomeHeading>
      <p className="mx-4 mt-1 text-[11px] leading-5 text-black/50 sm:mx-6">
        Weekly streak, Spin & Win, tiers, tasks, vouchers, wallets and gifts are all available here on the home page.
      </p>

      <nav className="mx-4 mt-4 flex gap-2 overflow-x-auto pb-1 sm:mx-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {menu.map(({ href, label, Icon }) => (
          <a
            key={href}
            href={href}
            className="flex min-w-[82px] shrink-0 flex-col items-center gap-1.5 rounded-[18px] border border-black/[.06] bg-white px-3 py-3 text-[10px] font-extrabold text-[#14140F] shadow-[0_6px_18px_rgba(20,20,15,.05)]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E7F6F3] text-[#0E7C6F]">
              <Icon size={17} />
            </span>
            {label}
          </a>
        ))}
      </nav>

      <div className="mx-4 mt-4 space-y-4 sm:mx-6">
        <div
          id="home-reseller-rewards"
          className="grid gap-4 scroll-mt-28 lg:grid-cols-2"
        >
          <section className="rounded-[24px] border border-black/[.05] bg-[#FFFDF8] p-4 shadow-[0_10px_28px_rgba(20,20,15,.06)]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">
                  Weekly streak
                </p>
                <h3 className="mt-1 text-xl font-extrabold">7-Day Check-in</h3>
                <p className="mt-1 text-xs text-[#6B6A62]">
                  Check in every day and unlock higher point rewards.
                </p>
              </div>
              <span className="rounded-full bg-[#FFF3E0] px-3 py-1.5 text-[10px] font-extrabold">
                {Math.min(7, Number(wallet.streak || 0))}/7
              </span>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, index) => {
                const complete = index < Number(wallet.streak || 0);
                return (
                  <div
                    key={index}
                    className={`rounded-xl px-1 py-2 text-center ${complete ? "bg-[#0E7C6F] text-white" : "bg-[#F1ECE3] text-[#6B6A62]"}`}
                  >
                    <p className="text-[8px] font-extrabold">D{index + 1}</p>
                    <p className="mt-1 text-[9px] font-extrabold">
                      +{Number(rewardSettings.checkInRewards?.[index] ?? 0)}
                    </p>
                    <p className="text-[7px] font-bold">PTS</p>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => void checkInReward()}
              disabled={rewardBusy || wallet.lastCheckIn === rewardDayKey()}
              className="mt-4 w-full rounded-xl bg-[#14140F] py-3.5 text-xs font-extrabold text-white disabled:opacity-45"
            >
              {wallet.lastCheckIn === rewardDayKey()
                ? "✓ Checked in today"
                : `Check in +${Number(rewardSettings.checkInRewards?.[Math.min(6, Number(wallet.streak || 0))] ?? 10)} points`}
            </button>
          </section>

          <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(160deg,#16332E,#0C1C19)] p-4 text-white shadow-[0_10px_28px_rgba(20,20,15,.12)]">
            <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#FF9A3C]">
              Spin & win
            </span>
            <h3 className="mt-1.5 text-xl font-extrabold">Your reward wheel</h3>
            <p className="mt-1 text-xs text-white/65">
              Spin directly from the home page to reveal today&apos;s prize.
            </p>
            <div className="relative mx-auto mt-5 aspect-square w-full max-w-[300px]">
              <div className="absolute left-1/2 top-[-10px] z-20 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[24px] border-x-transparent border-t-[#FF9A3C]" />
              <div
                className="relative h-full w-full rounded-full border-[8px] border-[#FFFDF8] shadow-2xl transition-transform duration-[2600ms] ease-out"
                style={{
                  transform: `rotate(${wheelRotation}deg)`,
                  background:
                    "conic-gradient(#E85D04 0deg 72deg,#0E7C6F 72deg 144deg,#D94B3D 144deg 216deg,#C9A227 216deg 288deg,#7B4B94 288deg 360deg)",
                }}
              >
                {visualPrizes.map((prize, index) => {
                  const angle = index * 72 + 36;
                  return (
                    <div
                      key={`${prize.id}-${index}`}
                      className="absolute left-1/2 top-1/2 w-[78px] text-center text-[9px] font-extrabold leading-tight"
                      style={{
                        transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-92px) rotate(-${angle}deg)`,
                      }}
                    >
                      <span className="block text-xl">
                        {prize.imageUrl ? (
                          <img
                            src={normalizeImageUrl(prize.imageUrl)}
                            alt=""
                            className="mx-auto h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          prizeIcon(prize.type)
                        )}
                      </span>
                      {prize.name}
                    </div>
                  );
                })}
                <div className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[#14140F] text-[10px] font-extrabold">
                  WIN
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void spinReward()}
              disabled={rewardBusy || wallet.lastSpin === rewardDayKey()}
              className="mt-5 w-full rounded-xl bg-[#FF9A3C] px-4 py-3 text-sm font-extrabold text-[#14140F] disabled:opacity-60"
            >
              {wallet.lastSpin === rewardDayKey()
                ? "Come back tomorrow"
                : rewardBusy
                  ? "Spinning…"
                  : "Spin the wheel"}
            </button>
          </section>
        </div>

        {rewardMessage ? (
          <div
            className="rounded-xl bg-[#0E7C6F] p-3 text-center text-xs font-extrabold text-white"
            role="status"
          >
            {rewardMessage}
          </div>
        ) : null}

        <section
          id="home-reseller-tiers"
          className="scroll-mt-28 rounded-[24px] border border-black/[.05] bg-[#FFFDF8] p-4 shadow-[0_10px_28px_rgba(20,20,15,.06)]"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#B4871D]">
                Prime Loyalty Program
              </p>
              <h3 className="mt-1 text-xl font-extrabold">Your reseller tiers</h3>
              <p className="mt-1 text-xs text-black/45">
                Current tier: <b className="text-[#0E7C6F]">{profile ? currentTier?.name || "Starter" : "Join to activate"}</b>
              </p>
            </div>
            <Crown className="text-[#B4871D]" size={24} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {tiers.map((tier, index) => {
              const active = profile && tier.id === currentTier?.id;
              const unlocked = profile && index <= currentTierIndex;
              const tones = [
                ["#7B3F1D", "#F6D6B5"],
                ["#59636E", "#F1F5F8"],
                ["#8A5A00", "#FFE7A3"],
                ["#171B2D", "#B8C5FF"],
              ];
              const tone = tones[index % tones.length];
              return (
                <article
                  key={tier.id}
                  className={`relative overflow-hidden rounded-[20px] border p-3 ${active ? "border-[#14140F] shadow-[0_12px_26px_rgba(20,20,15,.16)]" : "border-black/[.07]"}`}
                  style={{
                    background: `linear-gradient(145deg,#FFFDF8,${tone[1]})`,
                  }}
                >
                  <div
                    className="grid h-9 w-9 place-items-center rounded-xl text-xs font-extrabold text-white shadow-md"
                    style={{ backgroundColor: tone[0] }}
                  >
                    {index + 1}
                  </div>
                  <h4 className="mt-3 text-base font-extrabold">{tier.name}</h4>
                  <p className="mt-1 text-[10px] font-bold text-black/40">
                    {tier.minMonthlyOrders}+ monthly orders
                  </p>
                  <p className="mt-2 text-xl font-extrabold" style={{ color: tone[0] }}>
                    {Number(tier.discountPercent || 0)}% <span className="text-[10px] text-black/35">OFF</span>
                  </p>
                  <div className={`mt-3 rounded-xl py-2 text-center text-[9px] font-extrabold ${active ? "bg-[#14140F] text-white" : "bg-white/80 text-black/45"}`}>
                    {active
                      ? "Your current tier"
                      : unlocked
                        ? "Unlocked"
                        : profile
                          ? `Need ${Math.max(0, Number(tier.minMonthlyOrders || 0) - monthlyOrders)} orders`
                          : "Visible before joining"}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          id="home-reseller-tasks"
          className="scroll-mt-28 rounded-[24px] border border-black/[.05] bg-[#FFFDF8] p-4 shadow-[0_10px_28px_rgba(20,20,15,.06)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">
                Tasks
              </p>
              <h3 className="mt-1 text-xl font-extrabold">Earn points & cash</h3>
            </div>
            <span className="rounded-full bg-[#E7F6F3] px-2.5 py-1 text-[10px] font-extrabold text-[#0E7C6F]">
              {tasks.length} live
            </span>
          </div>

          {challenge.active ? (
            <div className="mt-4 rounded-2xl bg-[#F6F1E8] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold">
                  {target} orders = gift or cash
                </p>
                <span className="text-[10px] font-extrabold text-[#0E7C6F]">
                  {monthlyOrders}/{target}
                </span>
              </div>
              <div className="my-2.5 h-2 overflow-hidden rounded-full bg-[#EDE8DE]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0E7C6F,#12A394)]"
                  style={{ width: `${challengePercent}%` }}
                />
              </div>
              <p className="text-[10px] text-[#6B6A62]">
                {remainingOrders
                  ? `${remainingOrders} eligible orders remaining`
                  : "Challenge complete — choose your reward."}
              </p>
            </div>
          ) : null}

          <div className="mt-2 divide-y divide-black/[.07]">
            {tasks.map((task) => {
              const Icon = taskIcons[task.id] || CheckCircle2;
              const social = SOCIAL_TASK_IDS.has(task.id);
              const orderTask = ORDER_TASK_IDS.has(task.id);
              const submitted = submittedTasks.includes(task.id);
              return (
                <article
                  key={task.id}
                  className="grid grid-cols-[42px_1fr] gap-2.5 py-3 sm:grid-cols-[42px_1fr_auto] sm:items-center"
                >
                  <span className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#FFF3E0] text-[#0E7C6F]">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-bold">{task.title}</h4>
                    <p className="mt-0.5 text-[10px] leading-4 text-[#6B6A62]">
                      {task.description}
                    </p>
                    <strong className="mt-1 block text-[10px] text-[#0E7C6F]">
                      {Number(task.reward || 0) > 0
                        ? `+${Number(task.reward).toLocaleString()} ${orderTask ? "reward" : "points"}`
                        : "Automatic progress"}
                    </strong>
                  </div>
                  <div className="col-span-2 flex gap-2 sm:col-span-1 sm:justify-end">
                    {social ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openSocialTask(task)}
                          className="flex-1 rounded-xl bg-[#F1ECE3] px-3 py-2.5 text-[10px] font-extrabold sm:flex-none"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          disabled={submitted}
                          onClick={() => {
                            if (!user || !profile) {
                              window.location.href =
                                "/reseller/join?redirect=/#home-reseller-tasks";
                              return;
                            }
                            setProofTask(task);
                            setProofValue("");
                          }}
                          className="flex-1 rounded-xl bg-[#14140F] px-3 py-2.5 text-[10px] font-extrabold text-white disabled:opacity-45 sm:flex-none"
                        >
                          {submitted ? "Submitted" : "Submit proof"}
                        </button>
                      </>
                    ) : (
                      <Link
                        href={`/reseller/tasks#${encodeURIComponent(task.id)}`}
                        className="flex-1 rounded-xl bg-[#14140F] px-3 py-2.5 text-center text-[10px] font-extrabold text-white sm:flex-none"
                      >
                        View progress
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="home-reseller-vouchers" className="scroll-mt-28">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">
                Vouchers
              </p>
              <h3 className="mt-1 text-xl font-extrabold">Unlock your rewards</h3>
            </div>
            <span className="rounded-full bg-white px-3 py-2 text-[10px] font-extrabold shadow-sm">
              {vouchers.length} rewards
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            {vouchers.map((voucher) => {
              const locked = monthlyOrders < voucher.minOrders;
              return (
                <article
                  key={voucher.id}
                  className="overflow-hidden rounded-[18px] border border-black/[.05] bg-white shadow-[0_8px_20px_rgba(20,20,15,.05)]"
                >
                  <div className="relative aspect-[1.5] bg-[linear-gradient(145deg,#0E7C6F,#14140F)]">
                    {voucher.imageUrl ? (
                      <img
                        src={normalizeImageUrl(voucher.imageUrl)}
                        alt={voucher.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-4xl text-white">
                        {voucher.icon}
                      </div>
                    )}
                    {locked ? (
                      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[8px] font-extrabold text-white">
                        LOCKED
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <h4 className="text-[12px] font-extrabold leading-4">
                      {voucher.title}
                    </h4>
                    <p className="mt-1 text-[9px] leading-4 text-[#6B6A62]">
                      {voucher.description}
                    </p>
                    <p className="mt-1 text-[9px] font-extrabold text-[#0E7C6F]">
                      {voucher.requirement}
                    </p>
                    <Link
                      href={profile ? "/reseller/rewards-preview" : "/reseller/join"}
                      className={`mt-2 block rounded-xl px-2 py-2.5 text-center text-[9px] font-extrabold ${locked ? "pointer-events-none bg-[#F1ECE3] text-black/35" : "bg-[#14140F] text-white"}`}
                    >
                      {locked ? "More orders needed" : "View reward"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-3 rounded-[18px] bg-[#FFFDF8] p-3 shadow-[0_8px_20px_rgba(20,20,15,.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold text-[#14140F]">
                  My voucher wallet
                </p>
                <p className="mt-0.5 text-[9px] text-[#6B6A62]">
                  {wallet.coupons?.length || 0} code(s) available from rewards.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyLatestVoucher()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#E7F6F3] px-3 py-2.5 text-[9px] font-extrabold text-[#0E7C6F]"
              >
                <Copy size={12} /> Copy latest
              </button>
            </div>
          </div>
        </section>

        <section
          id="home-reseller-wallet"
          className="scroll-mt-28 rounded-[24px] border border-black/[.05] bg-[#FFFDF8] p-4 shadow-[0_10px_28px_rgba(20,20,15,.06)]"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#E85D04]">
            Wallet
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-[#F1ECE3] p-3">
              <WalletCards size={18} className="text-[#6B6A62]" />
              <p className="mt-2 text-[9px] font-extrabold uppercase tracking-wider text-[#6B6A62]">
                Cash wallet
              </p>
              <h3 className="mt-1 text-2xl font-extrabold">
                {profile ? `Rs. ${cashAvailable.toLocaleString()}` : "Rs. 0"}
              </h3>
              <p className="text-[10px] text-[#6B6A62]">
                {profile
                  ? `Pending Rs. ${cashPending.toLocaleString()}`
                  : "Join Reseller Club to activate cash earnings"}
              </p>
            </div>
            <div className="rounded-2xl bg-[#E7F6F3] p-3">
              <Coins size={18} className="text-[#0E7C6F]" />
              <p className="mt-2 text-[9px] font-extrabold uppercase tracking-wider text-[#0E7C6F]">
                Points wallet
              </p>
              <h3 className="mt-1 text-2xl font-extrabold">
                {Number(wallet.points || 0).toLocaleString()}
              </h3>
              <p className="text-[10px] text-[#0E7C6F]">Reward points</p>
            </div>
          </div>
          <Link
            href={profile ? "/reseller/wallet" : "/reseller/join"}
            className="mt-3 block w-full rounded-xl bg-[#14140F] px-3 py-3 text-center text-xs font-extrabold text-white"
          >
            {profile ? "History & withdrawal" : "Join Reseller Club"}
          </Link>
        </section>

        <section
          id="home-reseller-gifts"
          className="scroll-mt-28 rounded-[24px] border border-black/[.05] bg-[#FFFDF8] p-4 shadow-[0_10px_28px_rgba(20,20,15,.06)]"
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#0E7C6F]">
                Point store
              </p>
              <h3 className="mt-1 text-xl font-extrabold">Gifts & Products</h3>
              <p className="mt-1 text-xs text-[#6B6A62]">
                Admin reward settings stay connected and active gifts appear here automatically.
              </p>
            </div>
            <span className="rounded-full bg-[#FFF3E0] px-3 py-1.5 text-[10px] font-extrabold">
              {Number(wallet.points || 0).toLocaleString()} PTS
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            {rewardGifts.length ? (
              rewardGifts.map((gift) => {
                const product = gift.productId
                  ? rewardProducts[gift.productId]
                  : undefined;
                const image = normalizeImageUrl(
                  gift.imageUrl || rewardProductImage(product),
                );
                const need = Math.max(
                  0,
                  Number(gift.pointsCost || 0) - Number(wallet.points || 0),
                );
                return (
                  <article
                    key={gift.id}
                    className="overflow-hidden rounded-2xl border border-black/[.06] bg-white"
                  >
                    <div className="aspect-square bg-[#F1ECE3]">
                      {image ? (
                        <img
                          src={image}
                          alt={gift.title || product?.title || "Reward gift"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-3xl">
                          🎁
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h4 className="text-[12px] font-extrabold leading-4">
                        {gift.title || product?.title || product?.name || "Reward Gift"}
                      </h4>
                      <p className="mt-1 text-[10px] font-extrabold text-[#E85D04]">
                        {Number(gift.pointsCost || 0).toLocaleString()} points
                      </p>
                      <p className="mt-1 text-[9px] text-[#0E7C6F]">
                        Free delivery included
                      </p>
                      <button
                        type="button"
                        disabled={rewardBusy || need > 0}
                        onClick={() => void redeemGift(gift)}
                        className="mt-3 w-full rounded-xl bg-[#14140F] px-2 py-2.5 text-[9px] font-extrabold text-white disabled:opacity-45"
                      >
                        {need ? `Need ${need.toLocaleString()} more` : "Redeem gift"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="col-span-2 rounded-2xl bg-[#F1ECE3] p-6 text-center text-xs text-[#6B6A62] lg:col-span-3">
                Admin se add kiye gaye active gifts yahan show honge.
              </div>
            )}
          </div>
        </section>
      </div>

      <Link
        className="home-view-all home-club-view-all mx-4 mt-4 sm:mx-6"
        href="/reseller/dashboard"
      >
        Open full Reseller Club <ArrowRight size={14} />
      </Link>

      {proofTask ? (
        <div
          className="home-task-proof-backdrop"
          role="presentation"
          onClick={() => setProofTask(null)}
        >
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
            <p>
              Platform follow/subscribe complete karne ke baad apna username ya proof link submit karein.
            </p>
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
