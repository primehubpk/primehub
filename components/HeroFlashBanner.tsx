'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Flame } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

function getRemaining(endAt?: string) {
  if (!endAt) return 0;
  return Math.max(0, new Date(endAt).getTime() - Date.now());
}

function formatCountdown(ms: number) {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return { days, hours, minutes, seconds };
}

export default function HeroFlashBanner() {
  const { settings, loading } = useSettings();
  const [remaining, setRemaining] = useState(0);

  const deal = settings.dailyDeal;
  const legacyImage = settings.heroImageUrl;

  useEffect(() => {
    const tick = () => setRemaining(getRemaining(deal?.endAt || settings.heroCountdownEndTime));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deal?.endAt, settings.heroCountdownEndTime]);

  const countdown = useMemo(() => formatCountdown(remaining), [remaining]);
  const isExpired = remaining <= 0;
  const imageUrl = deal?.imageUrl || legacyImage;

  if (loading || !imageUrl) {
    return (
      <section className="mx-4 mt-3 h-[360px] rounded-3xl bg-black/5 animate-pulse" />
    );
  }

  const original = deal?.originalPrice ?? 0;
  const price = deal?.dealPrice ?? 0;
  const discount =
    original > 0 && price > 0 ? Math.max(0, Math.round(((original - price) / original) * 100)) : 0;

  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-[28px] bg-[#14140F] text-white shadow-[0_18px_50px_rgba(20,20,15,0.16)]">
      <div className="relative min-h-[390px]">
        <img
          src={imageUrl}
          alt={deal?.title || 'Today’s deal'}
          className="absolute inset-0 h-full w-full object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#14140F] via-[#14140F]/55 to-transparent" />

        <div className="relative flex min-h-[390px] flex-col justify-end p-5 sm:p-7">
          <div className="mb-auto flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1352B] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]">
              <Flame size={13} />
              Today&apos;s Deal
            </span>

            {discount > 0 && (
              <span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-xs font-black text-[#14140F]">
                -{discount}%
              </span>
            )}
          </div>

          <div className="max-w-xl">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/65">
              One day only
            </p>

            <h2 className="text-3xl font-black leading-[0.95] tracking-tight sm:text-5xl">
              {deal?.title || settings.heroTitle || 'Big Deal. Today Only.'}
            </h2>

            {original > 0 && price > 0 && (
              <div className="mt-4 flex items-end gap-3">
                <span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#FFB020]">
                  Rs. {price.toLocaleString()}
                </span>
                <span className="pb-1 text-sm text-white/55 line-through">
                  Rs. {original.toLocaleString()}
                </span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-md">
                <Clock3 size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  {isExpired ? 'Deal ended' : 'Ends in'}
                </span>
                {!isExpired && (
                  <span className="font-[family-name:var(--font-mono)] text-sm font-bold">
                    {countdown.days}d {String(countdown.hours).padStart(2, '0')}:
                    {String(countdown.minutes).padStart(2, '0')}:
                    {String(countdown.seconds).padStart(2, '0')}
                  </span>
                )}
              </div>

              {deal?.buttonText && !isExpired && (
                <a
                  href={deal.buttonLink || '#'}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#14140F] transition hover:-translate-y-0.5 active:scale-95"
                >
                  {deal.buttonText}
                  <ArrowRight size={14} />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
