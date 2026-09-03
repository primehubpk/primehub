'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Image as ImageIcon, MessageCircleMore, PackageCheck, Sparkles } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PRIME_SKILLS_SEED } from '@/lib/primeSkillsSeed';

type SkillPackage = { id: string; name: string; price: number; description?: string; active?: boolean };
type SkillItem = {
  id: string;
  title?: string;
  subtitle?: string;
  price?: number;
  thumbnailUrl?: string;
  whatsapp?: string;
  active?: boolean;
  sortOrder?: number;
  packages?: SkillPackage[];
};

type PageSettings = { eyebrow: string; title: string; description: string; ctaText: string; ctaWhatsapp: string };
const DEFAULT_PAGE: PageSettings = {
  eyebrow: 'Prime Skills',
  title: 'Apni skill se online customers hasil karein',
  description: 'Apni service PrimeHub par list karwayein. Customer aapki service, price aur packages dekh kar seedha WhatsApp par order ya inquiry bhej sakta hai.',
  ctaText: 'Apni Skill Add Karwayein',
  ctaWhatsapp: '03238878009',
};

function sellerWhatsappUrl(number?: string) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return '';
  const international = digits.startsWith('92') ? digits : digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
  const text = 'Assalam o Alaikum, mujhe PrimeHub par apni skill ya service add karwani hai. Please details share kar dein.';
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

function displayPrice(item: SkillItem) {
  const packages = (item.packages || []).filter((pkg) => pkg.active !== false && Number(pkg.price) > 0);
  if (packages.length) return { price: Math.min(...packages.map((pkg) => Number(pkg.price))), from: true };
  return { price: Number(item.price || 0), from: false };
}

export default function SkillsShowcase() {
  const [items, setItems] = useState<SkillItem[]>([]);
  const [page, setPage] = useState<PageSettings>(DEFAULT_PAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'prime_skills'), (snapshot) => {
      setItems(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as SkillItem)));
      setLoading(false);
    }, () => setLoading(false));

    getDoc(doc(db, 'settings', 'main'))
      .then((snapshot) => {
        const saved = snapshot.exists() ? snapshot.data()?.skillsPage : null;
        if (saved) setPage({ ...DEFAULT_PAGE, ...saved });
      })
      .catch(() => undefined);

    return unsubscribe;
  }, []);

  const visibleItems = useMemo(() => {
    const source: SkillItem[] = items.length ? items : PRIME_SKILLS_SEED;
    return source.filter((item) => item.active !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }, [items]);

  const ctaHref = sellerWhatsappUrl(page.ctaWhatsapp);

  return <main className="min-h-screen overflow-x-hidden bg-[#F4F4F1] px-2.5 pb-28 pt-3 sm:px-6 sm:pt-8">
    <section className="mx-auto max-w-5xl">
      <div className="relative overflow-hidden rounded-[24px] border border-black/[0.06] bg-gradient-to-br from-[#FFFDF8] via-[#F8F5EE] to-[#F1EEE7] shadow-[0_16px_42px_rgba(20,20,15,0.08)] sm:rounded-[34px]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#0F6A5F]/10 blur-3xl"/>
        <div className="pointer-events-none absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-[#FFCF68]/20 blur-3xl"/>

        <div className="relative grid gap-4 p-4 sm:p-7 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:gap-8 lg:p-8">
          <div className="min-w-0">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0F6A5F] text-white shadow-[0_10px_24px_rgba(15,106,95,0.24)] sm:h-14 sm:w-14">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6"/>
            </div>
            <p className="mt-3 text-[8px] font-black uppercase tracking-[0.22em] text-[#0F6A5F] sm:text-[10px]">{page.eyebrow}</p>
            <h1 className="mt-1 max-w-2xl text-[23px] font-black leading-[1.05] tracking-[-0.035em] text-[#181914] sm:text-[34px] lg:text-[42px]">{page.title}</h1>
            <p className="mt-2.5 max-w-2xl text-[11px] font-semibold leading-[17px] text-black/55 sm:mt-3 sm:text-[14px] sm:leading-6">{page.description}</p>

            {ctaHref && <Link href={ctaHref} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#181914] px-4 py-2.5 text-[10px] font-black text-white shadow-sm transition hover:-translate-y-0.5 sm:mt-5 sm:min-h-11 sm:px-5 sm:text-xs">
              {page.ctaText}<ArrowRight className="h-3.5 w-3.5 shrink-0"/>
            </Link>}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-[18px] border border-black/5 bg-white/90 p-3 shadow-sm sm:rounded-[22px] sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0F6A5F]/10 text-[#0F6A5F]"><BriefcaseBusiness size={15}/></div>
              <p className="mt-2 text-[10px] font-black leading-4 text-[#181914] sm:text-sm">Service showcase</p>
              <p className="mt-1 text-[8px] font-medium leading-3.5 text-black/45 sm:text-[10px] sm:leading-4">Image, details aur price clearly show honge.</p>
            </div>
            <div className="rounded-[18px] border border-black/5 bg-white/90 p-3 shadow-sm sm:rounded-[22px] sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#B7791F]/10 text-[#B7791F]"><PackageCheck size={15}/></div>
              <p className="mt-2 text-[10px] font-black leading-4 text-[#181914] sm:text-sm">Choose package</p>
              <p className="mt-1 text-[8px] font-medium leading-3.5 text-black/45 sm:text-[10px] sm:leading-4">Customer Silver, Gold ya apna custom package select karega.</p>
            </div>
            <div className="rounded-[18px] border border-black/5 bg-white/90 p-3 shadow-sm sm:rounded-[22px] sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E1352B]/10 text-[#E1352B]"><MessageCircleMore size={15}/></div>
              <p className="mt-2 text-[10px] font-black leading-4 text-[#181914] sm:text-sm">Direct WhatsApp</p>
              <p className="mt-1 text-[8px] font-medium leading-3.5 text-black/45 sm:text-[10px] sm:leading-4">Selected service aur package ki details seedha WhatsApp par jayengi.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto mt-4 max-w-5xl sm:mt-7">{loading ? <div className="rounded-[20px] border border-black/5 bg-white px-4 py-10 text-center text-sm font-bold text-black/40">Loading skills...</div> : <div className="grid grid-cols-2 gap-2 sm:gap-5">{visibleItems.map((item) => {
      const detailHref = `/skills/${encodeURIComponent(item.id)}`;
      const priceInfo = displayPrice(item);
      const packageCount = (item.packages || []).filter((pkg) => pkg.active !== false).length;
      return <article key={item.id} className="group min-w-0 overflow-hidden rounded-[14px] border border-black/5 bg-white shadow-[0_7px_18px_rgba(20,20,15,0.06)] sm:rounded-[22px] sm:shadow-[0_12px_34px_rgba(20,20,15,0.07)]">
        <Link href={detailHref} className="block">
          <div className="relative aspect-video overflow-hidden bg-white">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title || 'Prime Skill'} className="h-full w-full object-contain transition duration-300 sm:object-cover sm:group-hover:scale-[1.02]" loading="lazy"/> : <div className="flex h-full items-center justify-center text-black/25"><ImageIcon size={22}/></div>}</div>
          <div className="p-2 sm:p-5">
            <h2 className="line-clamp-2 text-[11px] font-black leading-[15px] text-[#181914] sm:text-lg sm:leading-tight">{item.title}</h2>
            {priceInfo.price > 0 && <p className="mt-1 text-[10px] font-black text-[#E1352B] sm:mt-2 sm:text-sm">{priceInfo.from ? 'From ' : ''}Rs {priceInfo.price.toLocaleString()}</p>}
            {packageCount > 0 && <span className="mt-1.5 inline-flex rounded-full bg-[#0F6A5F]/10 px-2 py-1 text-[8px] font-black text-[#0F6A5F] sm:text-[9px]">{packageCount} package{packageCount === 1 ? '' : 's'} available</span>}
            <div className="mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#181914] px-2 py-2 text-[9px] font-black text-white sm:mt-3 sm:min-h-11 sm:rounded-xl sm:px-4 sm:py-3 sm:text-xs">View & Choose Package <ArrowRight size={12}/></div>
          </div>
        </Link>
      </article>;
    })}</div>}</section>
  </main>;
}
