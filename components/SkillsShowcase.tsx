'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon, MessageCircle, Sparkles } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PRIME_SKILLS_SEED } from '@/lib/primeSkillsSeed';

type SkillItem = {
  id: string;
  title?: string;
  subtitle?: string;
  price?: number;
  thumbnailUrl?: string;
  whatsapp?: string;
  active?: boolean;
  sortOrder?: number;
};

type PageSettings = {
  eyebrow: string;
  title: string;
  description: string;
  ctaText: string;
  ctaWhatsapp: string;
};

const DEFAULT_PAGE: PageSettings = {
  eyebrow: 'Prime Skills',
  title: 'Aap kya karte hain?',
  description: 'Apni skill ya service PrimeHub par add karwa sakte hain. Humein WhatsApp par batayein — hum aapki service, image, video ya link yahan professionally add kar denge.',
  ctaText: 'Apni Skill Add Karwayein',
  ctaWhatsapp: '03238878009',
};

function whatsappUrl(number?: string, title?: string) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return '';
  const international = digits.startsWith('92') ? digits : digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
  const text = title
    ? `Assalam o Alaikum, mujhe PrimeHub par \"${title}\" order karna hai. Please details share kar dein.`
    : 'Assalam o Alaikum, mujhe PrimeHub par apni skill ya service add karwani hai.';
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

export default function SkillsShowcase() {
  const [items, setItems] = useState<SkillItem[]>([]);
  const [page, setPage] = useState<PageSettings>(DEFAULT_PAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'prime_skills'),
      (snapshot) => {
        setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as SkillItem)));
        setLoading(false);
      },
      () => setLoading(false),
    );

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
    return source
      .filter((item) => item.active !== false)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }, [items]);

  const ctaHref = whatsappUrl(page.ctaWhatsapp);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F4F4F1] px-2 pb-28 pt-3 sm:px-6 sm:pt-10">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-[20px] border border-black/5 bg-[#FFFCF7] shadow-[0_10px_28px_rgba(20,20,15,0.07)] sm:rounded-[28px] sm:shadow-[0_18px_50px_rgba(20,20,15,0.08)]">
        <div className="px-4 py-5 text-center sm:px-10 sm:py-12">
          <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F6A5F] text-white sm:mb-4 sm:h-12 sm:w-12 sm:rounded-2xl">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </div>
          <p className="mb-1 text-[8px] font-black uppercase tracking-[0.17em] text-[#0F6A5F] sm:mb-2 sm:text-[11px] sm:tracking-[0.22em]">{page.eyebrow}</p>
          <h1 className="mx-auto max-w-3xl text-[22px] font-black leading-[1.08] tracking-[-0.03em] text-[#181914] sm:text-5xl">{page.title}</h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-[11px] font-semibold leading-[17px] text-black/55 sm:mt-4 sm:text-base sm:leading-6">{page.description}</p>
          {ctaHref && (
            <Link href={ctaHref} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-[#181914] px-4 py-2 text-[10px] font-black text-white sm:mt-7 sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm">
              {page.ctaText}<ArrowRight className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto mt-4 max-w-5xl sm:mt-8">
        {loading ? (
          <div className="rounded-[20px] border border-black/5 bg-white px-4 py-10 text-center text-sm font-bold text-black/40">Loading skills...</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-5">
            {visibleItems.map((item) => {
              const detailHref = `/skills/${encodeURIComponent(item.id)}`;
              const waHref = whatsappUrl(item.whatsapp, item.title);

              return (
                <article key={item.id} className="group min-w-0 overflow-hidden rounded-[14px] border border-black/5 bg-white shadow-[0_7px_18px_rgba(20,20,15,0.06)] sm:rounded-[22px] sm:shadow-[0_12px_34px_rgba(20,20,15,0.07)]">
                  <Link href={detailHref} className="block">
                    <div className="relative aspect-video overflow-hidden bg-[#ECECE7]">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt={item.title || 'Prime Skill'} className="h-full w-full object-cover transition duration-300 sm:group-hover:scale-[1.02]" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-black/25"><ImageIcon size={22}/></div>
                      )}
                    </div>
                  </Link>

                  <div className="p-2 sm:p-5">
                    <Link href={detailHref} className="block">
                      <h2 className="line-clamp-2 text-[11px] font-black leading-[15px] text-[#181914] sm:text-lg sm:leading-tight">{item.title}</h2>
                      {Number(item.price || 0) > 0 && <p className="mt-1 text-[10px] font-black text-[#E1352B] sm:mt-2 sm:text-sm">Rs {Number(item.price).toLocaleString()}</p>}
                    </Link>

                    {waHref && (
                      <Link href={waHref} target="_blank" rel="noreferrer" className="mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F6A5F] px-2 py-2 text-[9px] font-black text-white sm:mt-3 sm:min-h-11 sm:rounded-xl sm:px-4 sm:py-3 sm:text-xs">
                        <MessageCircle size={12} className="shrink-0 sm:h-[14px] sm:w-[14px]" />
                        <span>Order on WhatsApp</span>
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}