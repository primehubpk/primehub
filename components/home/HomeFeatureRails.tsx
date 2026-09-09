"use client";

import Image from "next/image";
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
  Gift,
  Instagram,
  Play,
  PlayCircle,
  Sparkles,
  WalletCards,
} from "lucide-react";
import HomeHeading from "./HomeHeading";
import { useSettings } from "@/lib/useSettings";
import { DEFAULT_RESELLER_TASKS, type ResellerTask } from "@/lib/resellerTasks";
import { PRIME_SKILLS_SEED } from "@/lib/primeSkillsSeed";
import { thumbnailOf, type WholesaleVideo } from "@/lib/wholesaleVideos";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { auth, db } from "@/lib/firebase";

const taskIcons = [CheckCircle2, Instagram, Gift, WalletCards];
const GUEST_KEY = "phdeals-guest-rewards";
const GUEST_WINS_KEY = "phdeals-guest-reward-wins";

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

export function HomeResellerTasks() {
  const { settings } = useSettings();
  const configured = (
    settings as typeof settings & { resellerTasks?: ResellerTask[] }
  ).resellerTasks;
  const tasks = (
    configured?.length ? configured : DEFAULT_RESELLER_TASKS
  ).filter((task) => task.active !== false);

  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<RewardWallet>(EMPTY_WALLET);
  const [rewardSettings, setRewardSettings] = useState<RewardSettings>(
    DEFAULT_REWARD_SETTINGS,
  );
  const [rewardGifts, setRewardGifts] = useState<RewardGift[]>([]);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");

  useEffect(() => {
    let stopWallet: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (currentUser) => {
      stopWallet?.();
      setUser(currentUser);
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
    });
    return () => {
      stopAuth();
      stopWallet?.();
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
            .map(
              (row) =>
                ({ id: row.id, ...row.data() }) as RewardGift,
            )
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

  const nextCheckInReward = Number(
    rewardSettings.checkInRewards?.[
      Math.min(6, Math.max(0, Number(wallet.streak || 0)))
    ] ?? 10,
  );

  if (!tasks.length && !rewardGifts.length) return null;

  return (
    <section className="home-club">
      <HomeHeading>Reseller Club Tasks</HomeHeading>
      <div className="home-rail-note">
        <span>Complete tasks and collect approved points in your wallet.</span>
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
                disabled={
                  rewardBusy || wallet.lastCheckIn === rewardDayKey()
                }
                onClick={() => void checkInReward()}
              >
                {wallet.lastCheckIn === rewardDayKey()
                  ? "Checked in"
                  : "Collect points"}
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

          <article className="home-task home-reward-card home-reward-wheel-card">
            <span className="home-task-icon">
              <Sparkles />
            </span>
            <div>
              <h3>Spin & Win</h3>
              <p>Use today’s reward spin and keep the prize you unlock.</p>
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
              <WalletCards />
            </span>
            <div>
              <h3>Reward wallet</h3>
              <p>Points, vouchers and won rewards stay together.</p>
              <strong>Rewards ready when you earn them</strong>
              <Link className="home-task-button" href="/rewards#wins">
                View wallet <ArrowRight size={13} />
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
                  <p>Admin reward · free delivery included.</p>
                  <strong>
                    {Number(gift.pointsCost || 0).toLocaleString()} points
                  </strong>
                  <Link
                    className="home-task-button"
                    href="/rewards#redeem-rewards"
                  >
                    {need ? `Need ${need.toLocaleString()} more` : "Redeem gift"}
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </article>
            );
          })}

          {tasks.map((task, index) => {
            const Icon = taskIcons[index % taskIcons.length];
            return (
              <Link
                href={`/reseller/tasks#${encodeURIComponent(task.id)}`}
                className="home-task"
                key={task.id}
              >
                <span
                  className={`home-task-icon ${task.id.includes("instagram") ? "instagram" : ""}`}
                >
                  <Icon />
                </span>
                <div>
                  <h3>{task.title}</h3>
                  <p>{task.description}</p>
                  <strong>
                    {Number(task.reward || 0) > 0
                      ? `+${Number(task.reward).toLocaleString()} points after approval`
                      : "Automatic progress"}
                  </strong>
                  <span className="home-task-button">
                    Open task <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        <Link
          className="home-view-all home-club-view-all"
          href="/reseller/tasks"
        >
          View all reseller task <ArrowRight size={14} />
        </Link>
      </div>
      {rewardMessage ? (
        <div className="home-reward-message" role="status">
          {rewardMessage}
        </div>
      ) : null}
    </section>
  );
}

export function HomeWholesaleVideos() {
  const { settings } = useSettings();
  const videos = (
    (settings as typeof settings & { wholesaleVideos?: WholesaleVideo[] })
      .wholesaleVideos || []
  ).filter((video) => video.active !== false);
  if (!videos.length) return null;
  return (
    <section className="home-video-packages">
      <HomeHeading>Wholesale Packages</HomeHeading>
      <div
        className="home-two-row-rail"
        aria-label="Wholesale package videos. Swipe horizontally for more."
      >
        {videos.map((video, index) => {
          const thumbnail = normalizeImageUrl(thumbnailOf(video));
          return (
            <a
              className="home-video-card"
              href={video.url}
              target="_blank"
              rel="noreferrer"
              key={video.id}
            >
              <span className="home-video-image">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={video.title}
                    loading={index < 2 ? "eager" : "lazy"}
                    className="object-cover"
                  />
                ) : (
                  <PlayCircle size={38} />
                )}
                <i>
                  <Play fill="currentColor" />
                </i>
              </span>
              <span>
                <small>{video.platform}</small>
                <b>{video.title}</b>
                <em>{video.description || "Tap to watch video"}</em>
              </span>
            </a>
          );
        })}
      </div>
      <Link className="home-view-all" href="/wholesale-video-hub">
        View all wholesale videos <ArrowRight size={14} />
      </Link>
    </section>
  );
}

export function HomePrimeSkills() {
  const [items, setItems] = useState(PRIME_SKILLS_SEED);
  useEffect(() => {
    fetch("/api/storefront/read?type=skills", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.skills) && data.skills.length)
          setItems(data.skills);
      })
      .catch(() => undefined);
  }, []);
  const skills = useMemo(
    () =>
      items
        .filter((item) => item.active !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [items],
  );
  if (!skills.length) return null;
  return (
    <section className="home-prime-skills">
      <HomeHeading>Prime Skills</HomeHeading>
      <div
        className="home-two-row-rail"
        aria-label="Prime Skills. Swipe horizontally for more."
      >
        {skills.map((item, index) => {
          const thumbnail = normalizeImageUrl(item.thumbnailUrl);
          return (
            <Link
              className="home-skill-card"
              href={`/skills/${item.id}`}
              key={item.id}
            >
              <span className="home-skill-image">
                {thumbnail ? (
                  <Image
                    src={thumbnail}
                    alt={item.title || "Prime Skill"}
                    fill
                    sizes="(max-width: 600px) 48vw, 300px"
                    priority={index < 2}
                    className="object-cover"
                  />
                ) : (
                  <Sparkles />
                )}
              </span>
              <span>
                <b>{item.title || "Prime Skill"}</b>
                <ArrowRight size={13} />
              </span>
            </Link>
          );
        })}
      </div>
      <Link className="home-view-all" href="/skills">
        View all Prime Skills <ArrowRight size={14} />
      </Link>
    </section>
  );
}
