'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon, Sparkles } from 'lucide-react';
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
const DEFAULT_PAGE: PageSettings = { eyebrow: 'Prime Skills', title: 'Aap kya karte hain?', description: 'Apni skill ya service PrimeHub par add karwa sakte hain. WhatsApp par details bhejein — hum aapki service ko professionally showcase kar denge.', ctaText: 'Apni Skill Add Karwayein', ctaWhatsapp: '03238878009' };

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
    const unsubscribe = onSnapshot(collection(db, 'prime_skills'), (snapshot) => { setItems(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as SkillItem))); setLoading(false); }, () => setLoading(false));
    getDoc(doc(db, 'settings', 'main')).then((snapshot) => { const saved = snapshot.exists() ? snapshot.data()?.skillsPage : null; if (saved) setPage({ ...DEFAULT_PAGE, ...saved }); }).catch(() => undefined);
    return unsubscribe;
  }, []);

  const visibleItems = useMemo(() => {
    const source: SkillItem[] = items.length ? items : PRIME_SKILLS_SEED;
    return source.filter((item) => item.active !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }, [items]);

  const ctaHref = sellerWhatsappUrl(page.ctaWhatsapp);

  return <main className="min-h-screen overflow-x-hidden bg-[#F4F4F1] px-2.5 pb-28 pt-3 sm:px-6 sm:pt-8">
    <section className="mx-auto max-w-5xl overflow-hidden rounded-[22px] border border-black/[0.06] bg-[#FFFCF7] shadow-[0_12px_32px_rgba(20,20,15,0.07)] sm:rounded-[30px]">
      <div className="relative overflow-hidden px-4 py-4 sm:px-9 sm:py-8"><div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#0F6A5F]/[0.07] blur-2xl"/><div className="relative flex items-start gap-3.5 sm:items-center sm:gap-5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0F6A5F] text-white shadow-[0_8px_20px_rgba(15,106,95,0.22)] sm:h-14 sm:w-14"><Sparkles className="h-[18px] w-[18px] sm:h-6 sm:w-6"/></div><div className="min-w-0 flex-1"><p className="text-[7px] font-black uppercase tracking-[0.2em] text-[#0F6A5F] sm:text-[10px]">{page.eyebrow}</p><h1 className="mt-0.5 text-[19px] font-black leading-tight tracking-[-0.025em] text-[#181914] sm:text-3xl">{page.title}</h1><p className="mt-1.5 max-w-2xl text-[10px] font-semibold leading-[15px] text-black/50 sm:text-sm sm:leading-5">{page.description}</p>{ctaHref && <Link href={ctaHref} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[#181914] px-3.5 py-2 text-[9px] font-black text-white shadow-sm sm:mt-4 sm:min-h-10 sm:px-4 sm:text-[11px]">{page.ctaText}<ArrowRight className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5"/></Link>}</div></div></div>
    </section>

    <section className="mx-auto mt-4 max-w-5xl sm:mt-7">{loading ? <div className="rounded-[20px] border border-black/5 bg-white px-4 py-10 text-center text-sm font-bold text-black/40">Loading skills...</div> : <div className="grid grid-cols-2 gap-2 sm:gap-5">{visibleItems.map((item) => { const detailHref = `/skills/${encodeURIComponent(item.id)}`; const priceInfo = displayPrice(item); const packageCount = (item.packages || []).filter((pkg) => pkg.active !== false).length; return <article key={item.id} className="group min-w-0 overflow-hidden rounded-[14px] border border-black/5 bg-white shadow-[0_7px_18px_rgba(20,20,15,0.06)] sm:rounded-[22px] sm:shadow-[0_12px_34px_rgba(20,20,15,0.07)]"><Link href={detailHref} className="block"><div className="relative aspect-video overflow-hidden bg-white">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title || 'Prime Skill'} className="h-full w-full object-contain transition duration-300 sm:object-cover sm:group-hover:scale-[1.02]" loading="lazy"/> : <div className="flex h-full items-center justify-center text-black/25"><ImageIcon size={22}/></div>}</div><div className="p-2 sm:p-5"><h2 className="line-clamp-2 text-[11px] font-black leading-[15px] text-[#181914] sm:text-lg sm:leading-tight">{item.title}</h2>{priceInfo.price > 0 && <p className="mt-1 text-[10px] font-black text-[#E1352B] sm:mt-2 sm:text-sm">{priceInfo.from ? 'From ' : ''}Rs {priceInfo.price.toLocaleString()}</p>}{packageCount > 0 && <span className="mt-1.5 inline-flex rounded-full bg-[#0F6A5F]/10 px-2 py-1 text-[8px] font-black text-[#0F6A5F] sm:text-[9px]">{packageCount} package{packageCount === 1 ? '' : 's'} available</span>}<div className="mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#181914] px-2 py-2 text-[9px] font-black text-white sm:mt-3 sm:min-h-11 sm:rounded-xl sm:px-4 sm:py-3 sm:text-xs">View & Choose Package <ArrowRight size={12}/></div></div></Link></article>; })}</div>}</section>
  </main>;
}
