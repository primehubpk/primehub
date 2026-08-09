'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Gift, Sparkles, Trophy, Zap } from 'lucide-react';

const PRIZES = [
  { label: '5% OFF', value: 5, type: 'discount' },
  { label: '10 PTS', value: 10, type: 'points' },
  { label: 'FREE DELIVERY', value: 1, type: 'delivery' },
  { label: '15 PTS', value: 15, type: 'points' },
  { label: '10% OFF', value: 10, type: 'discount' },
  { label: '25 PTS', value: 25, type: 'points' },
  { label: 'TRY AGAIN', value: 0, type: 'none' },
  { label: '20 PTS', value: 20, type: 'points' },
];

const DAY_KEY = 'phdeals-reward-day';
const POINTS_KEY = 'phdeals-reward-points';
const LAST_SPIN_KEY = 'phdeals-last-spin';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function RewardsPage() {
  const [points, setPoints] = useState(0);
  const [claimed, setClaimed] = useState(false);
  const [spun, setSpun] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedPoints = Number(localStorage.getItem(POINTS_KEY) || 0);
    setPoints(savedPoints);
    setClaimed(localStorage.getItem(DAY_KEY) === todayKey());
    setSpun(localStorage.getItem(LAST_SPIN_KEY) === todayKey());
    setMounted(true);
  }, []);

  const savePoints = (next: number) => {
    setPoints(next);
    localStorage.setItem(POINTS_KEY, String(next));
  };

  const claimDaily = () => {
    if (claimed) return;
    const next = points + 10;
    savePoints(next);
    localStorage.setItem(DAY_KEY, todayKey());
    setClaimed(true);
    setResult('+10 points! Daily reward claimed 🎁');
  };

  const spin = () => {
    if (spinning || spun) return;

    setSpinning(true);
    setResult('');

    const index = Math.floor(Math.random() * PRIZES.length);
    const prize = PRIZES[index];
    const segment = 360 / PRIZES.length;
    const target = 360 * 6 + (360 - index * segment - segment / 2);

    setRotation((prev) => prev + target);

    window.setTimeout(() => {
      if (prize.type === 'points') {
        savePoints(points + prize.value);
        setResult(`You won ${prize.value} points! 🎉`);
      } else if (prize.type === 'discount') {
        setResult(`You won ${prize.value}% OFF! Save this reward for checkout.`);
      } else if (prize.type === 'delivery') {
        setResult('You won FREE DELIVERY! 🚚');
      } else {
        setResult('So close! Try again tomorrow.');
      }

      localStorage.setItem(LAST_SPIN_KEY, todayKey());
      setSpun(true);
      setSpinning(false);
    }, 4300);
  };

  const wheelStyle = useMemo(
    () => ({
      transform: `rotate(${rotation}deg)`,
      transition: spinning
        ? 'transform 4.2s cubic-bezier(0.12, 0.75, 0.18, 1)'
        : 'none',
    }),
    [rotation, spinning]
  );

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      <div className="mx-auto max-w-5xl px-4 py-5 md:px-6">
        <section className="overflow-hidden rounded-[32px] bg-[#14140F] p-6 text-white shadow-xl md:p-9">
          <div className="flex items-center gap-2 text-[#FFB020]">
            <Sparkles size={16} />
            <p className="text-[9px] font-black uppercase tracking-[0.25em]">
              PrimeHub Rewards
            </p>
          </div>
          <h1 className="mt-3 max-w-2xl text-3xl font-black tracking-tight md:text-5xl">
            Shop. Play. Get rewarded.
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-5 text-white/45">
            Come back every day, collect points and spin for surprise rewards.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[8px] font-black uppercase tracking-wider text-white/40">
                Your points
              </p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-xl font-black text-[#FFB020]">
                {points}
              </p>
            </div>
            <Link
              href="/shop"
              className="rounded-2xl bg-[#E1352B] px-4 py-3 text-[10px] font-black"
            >
              Shop Deals
            </Link>
          </div>
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="rounded-[30px] bg-white p-5 shadow-sm md:p-7">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#E1352B]">
                  <Gift size={18} />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em]">
                    Daily Reward
                  </p>
                </div>
                <h2 className="mt-2 text-xl font-black">Come back tomorrow.</h2>
                <p className="mt-1 text-xs leading-5 text-black/40">
                  Claim 10 points once every day.
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E1352B]/10 text-[#E1352B]">
                <Trophy size={21} />
              </div>
            </div>

            <button
              type="button"
              disabled={claimed}
              onClick={claimDaily}
              className="mt-6 w-full rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white disabled:bg-[#0F6A5F]"
            >
              {claimed ? '✓ Today’s Reward Claimed' : 'Claim +10 Points'}
            </button>
          </section>

          <section className="rounded-[30px] bg-white p-5 shadow-sm md:p-7">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#FFB020]">
                  <Zap size={18} />
                  <p className="text-[9px] font-black uppercase tracking-[0.2em]">
                    Spin & Win
                  </p>
                </div>
                <h2 className="mt-2 text-xl font-black">One spin. One surprise.</h2>
                <p className="mt-1 text-xs leading-5 text-black/40">
                  Spin once per day for a reward.
                </p>
              </div>
            </div>

            <div className="relative mx-auto mt-5 h-64 w-64">
              <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 text-[#E1352B]">
                <div className="h-0 w-0 border-l-[9px] border-r-[9px] border-t-[18px] border-l-transparent border-r-transparent" />
              </div>

              <div
                className="relative h-full w-full overflow-hidden rounded-full border-[10px] border-[#14140F] shadow-2xl"
                style={{
                  background:
                    'conic-gradient(from 0deg, #E1352B 0deg 45deg, #FFB020 45deg 90deg, #0F6A5F 90deg 135deg, #F4F4F1 135deg 180deg, #E1352B 180deg 225deg, #FFB020 225deg 270deg, #0F6A5F 270deg 315deg, #F4F4F1 315deg 360deg)',
                  ...wheelStyle,
                }}
              >
                {PRIZES.map((prize, i) => {
                  const angle = i * 45 + 22.5;
                  return (
                    <span
                      key={prize.label}
                      className="absolute left-1/2 top-1/2 w-24 -translate-x-1/2 -translate-y-1/2 text-center text-[8px] font-black text-[#14140F]"
                      style={{
                        transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-88px) rotate(${-angle}deg)`,
                      }}
                    >
                      {prize.label}
                    </span>
                  );
                })}
                <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#14140F] text-[8px] font-black text-white shadow-xl">
                  SPIN
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={spinning || spun}
              onClick={spin}
              className="mt-5 w-full rounded-2xl bg-[#E1352B] py-4 text-xs font-black text-white disabled:opacity-45"
            >
              {spinning ? 'Spinning...' : spun ? 'Come Back Tomorrow' : 'SPIN & WIN'}
            </button>
          </section>
        </div>

        {result && (
          <div className="mt-4 rounded-[26px] bg-[#0F6A5F] p-5 text-center text-sm font-black text-white shadow-lg">
            {result}
          </div>
        )}

        <section className="mt-4 rounded-[28px] bg-white p-5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-black/35">
            Rewards roadmap
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#F4F4F1] p-4">
              <p className="text-[10px] font-black">Daily Points</p>
              <p className="mt-1 text-[9px] leading-4 text-black/40">
                Return every day to build your balance.
              </p>
            </div>
            <div className="rounded-2xl bg-[#F4F4F1] p-4">
              <p className="text-[10px] font-black">Spin Rewards</p>
              <p className="mt-1 text-[9px] leading-4 text-black/40">
                Surprise discounts, points and delivery rewards.
              </p>
            </div>
            <div className="rounded-2xl bg-[#F4F4F1] p-4">
              <p className="text-[10px] font-black">More Coming</p>
              <p className="mt-1 text-[9px] leading-4 text-black/40">
                Coupons and redeemable points can be connected later.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
