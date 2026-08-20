'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock3 } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type HomeConfig = {
  heroImageUrl?: string;
  heroLink?: string;
  heroEnabled?: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
  heroCta?: string;
  dailyDealLabel?: string;
  dailyDealPrice?: string;
  dailyDealOldPrice?: string;
  dailyDealImageUrl?: string;
  dailyDealEndsText?: string;
};

export default function DailyDealHero() {
  const [config, setConfig] = useState<HomeConfig>({ heroEnabled: true });

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'home'), (snap) => {
      if (snap.exists()) setConfig(snap.data() as HomeConfig);
    });
  }, []);

  if (config.heroEnabled === false) return null;

  const image = config.heroImageUrl || config.dailyDealImageUrl || '';
  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(new Date()).toUpperCase();
  const title = `${dayName} DEAL`;
  const subtitle = config.heroSubtitle || 'Limited-time price. Updated daily.';
  const price = config.dailyDealPrice;
  const oldPrice = config.dailyDealOldPrice;
  const ends = config.dailyDealEndsText || 'Ends today';

  return (
    <section className="px-4 pt-3 md:px-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href={config.heroLink || '/shop'}
          className="group relative block min-h-[220px] overflow-hidden rounded-[30px] bg-[#14140F] shadow-xl md:min-h-[300px]"
        >
          {image && (
            <img
              src={image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.02]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#14140F]/95 via-[#14140F]/55 to-transparent" />

          <div className="relative z-10 flex min-h-[220px] max-w-xl flex-col justify-center p-6 text-white md:min-h-[300px] md:p-9">
            <span className="w-fit rounded-full bg-[#E1352B] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.2em]">
              {title}
            </span>

            <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
              {price ? `Rs. ${Number(price).toLocaleString()}` : 'Fresh Deal'}
            </h2>

            <div className="mt-1 flex items-center gap-2">
              {oldPrice && (
                <span className="font-[family-name:var(--font-mono)] text-xs font-bold text-white/40 line-through">
                  Rs. {Number(oldPrice).toLocaleString()}
                </span>
              )}
              <span className="text-xs font-bold text-[#FFB020]">{subtitle}</span>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-white/55">
              <Clock3 size={13} />
              {ends}
            </div>

            <span className="mt-5 flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[9px] font-black text-[#14140F]">
              {config.heroCta || 'SHOP DEAL'}
              <ArrowRight size={13} />
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
