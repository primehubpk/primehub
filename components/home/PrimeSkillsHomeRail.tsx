'use client';

import { fetchPublicStorefront } from '@/lib/storefrontClient';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { PRIME_SKILLS_SEED } from '@/lib/primeSkillsSeed';
import { normalizeImageUrl } from '@/lib/imageUrl';

type SkillItem = {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  active?: boolean;
  sortOrder?: number;
};

export default function PrimeSkillsHomeRail() {
  const [items, setItems] = useState<SkillItem[]>(PRIME_SKILLS_SEED as SkillItem[]);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      fetchPublicStorefront('skills')
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          if (!cancelled && Array.isArray(data?.skills) && data.skills.length) {
            setItems(data.skills as SkillItem[]);
          }
        })
        .catch(() => undefined);
    };

    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      load();
      return () => { cancelled = true; };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: '700px 0px' });
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  const visible = useMemo(() => {
    const source = items.length ? items : PRIME_SKILLS_SEED;
    return source
      .filter((item) => item.active !== false)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
      .slice(0, 10);
  }, [items]);

  if (!visible.length) return null;

  return (
    <section ref={sectionRef} className="col-span-full my-3 min-w-0 overflow-hidden rounded-[24px] border border-black/5 bg-[#FFFCF7] py-4 shadow-[0_12px_30px_rgba(20,20,15,0.07)] sm:rounded-[28px] sm:py-5">
      <div className="mb-3 flex items-center justify-between gap-3 px-4 sm:px-5">
        <Link href="/skills" prefetch={false} className="group flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0F6A5F] text-white shadow-[0_8px_18px_rgba(15,106,95,0.22)]"><Sparkles size={19} /></span>
          <span className="min-w-0"><span className="block text-[8px] font-black uppercase tracking-[.2em] text-[#0F6A5F]">More from PrimeHub</span><span className="mt-0.5 block truncate text-base font-black text-[#14140F] sm:text-lg">Prime Skills</span></span>
        </Link>
        <Link href="/skills" prefetch={false} className="flex shrink-0 items-center gap-1 rounded-full bg-[#14140F] px-3 py-2 text-[9px] font-black text-white">View all <ArrowRight size={12}/></Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3 sm:px-5">
        {visible.map((item, index) => {
          const thumbnail = normalizeImageUrl(item.thumbnailUrl);
          return <Link key={item.id} href="/skills" prefetch={false} className="group w-[78vw] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-[18px] border border-black/5 bg-white shadow-sm sm:w-[280px] sm:rounded-[20px] md:w-[300px]">
            <div className="relative aspect-video overflow-hidden bg-[#F4F4F1]">{thumbnail ? <Image src={thumbnail} alt={item.title || 'Prime Skill'} fill sizes="300px" priority={index < 2} quality={72} className="object-cover transition duration-300 group-hover:scale-[1.02]"/> : null}</div>
            <div className="flex items-center justify-between gap-2 px-3 py-2.5"><p className="min-w-0 truncate text-[11px] font-black text-[#14140F] sm:text-xs">{item.title || 'Prime Skill'}</p><ArrowRight size={13} className="shrink-0 text-[#0F6A5F]" /></div>
          </Link>;
        })}
      </div>
    </section>
  );
}
