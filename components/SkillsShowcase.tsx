'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Image as ImageIcon, MessageCircle, Play, Sparkles } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PRIME_SKILLS_SEED } from '@/lib/primeSkillsSeed';

type MediaType = 'image' | 'video-link' | 'external-link';

type SkillItem = {
  id: string;
  title?: string;
  subtitle?: string;
  price?: number;
  thumbnailUrl?: string;
  mediaType?: MediaType;
  externalUrl?: string;
  whatsapp?: string;
  buttonText?: string;
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

function safeExternalUrl(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
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
    <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-8 sm:px-6 sm:pt-12">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-black/5 bg-[#FFFCF7] shadow-[0_18px_50px_rgba(20,20,15,0.08)]">
        <div className="relative px-5 py-10 text-center sm:px-10 sm:py-14">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F6A5F] text-white shadow-[0_10px_24px_rgba(15,106,95,0.24)]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#0F6A5F]">{page.eyebrow}</p>
          <h1 className="mx-auto max-w-3xl text-3xl font-black tracking-[-0.03em] text-[#181914] sm:text-5xl">{page.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-black/60 sm:text-base">{page.description}</p>
          {ctaHref && (
            <Link href={ctaHref} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#181914] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:shadow-lg">
              {page.ctaText}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-5xl">
        {loading ? (
          <div className="rounded-[24px] border border-black/5 bg-white px-5 py-12 text-center text-sm font-bold text-black/40">Loading skills...</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {visibleItems.map((item) => {
              const externalHref = safeExternalUrl(item.externalUrl);
              const waHref = whatsappUrl(item.whatsapp, item.title);
              const isVideo = item.mediaType === 'video-link';
              const media = (
                <div className="relative aspect-video overflow-hidden bg-[#ECECE7]">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.title || 'Prime Skill'} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-black/25"><ImageIcon size={28}/></div>
                  )}
                  {isVideo && <span className="absolute inset-0 flex items-center justify-center bg-black/10"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#E1352B] shadow-lg"><Play size={19} className="ml-0.5" fill="currentColor"/></span></span>}
                  {externalHref && <span className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-white backdrop-blur"><ExternalLink size={13}/></span>}
                </div>
              );

              return (
                <article key={item.id} className="group overflow-hidden rounded-[22px] border border-black/5 bg-white shadow-[0_12px_34px_rgba(20,20,15,0.07)]">
                  {externalHref ? <Link href={externalHref} target="_blank" rel="noreferrer" aria-label={`Open ${item.title || 'skill'} link`}>{media}</Link> : media}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg font-black leading-tight text-[#181914]">{item.title}</h2>
                        {item.subtitle && <p className="mt-2 text-sm font-medium leading-5 text-black/55">{item.subtitle}</p>}
                      </div>
                      {Number(item.price || 0) > 0 && <div className="shrink-0 rounded-xl bg-[#F4F4F1] px-3 py-2 text-right"><span className="block text-[9px] font-black uppercase tracking-wide text-black/35">Price</span><span className="text-sm font-black text-[#E1352B]">Rs {Number(item.price).toLocaleString()}</span></div>}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {waHref && (
                        <Link href={waHref} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-xs font-black text-white sm:flex-none">
                          <MessageCircle size={14}/>{item.buttonText || 'Order Place'}
                        </Link>
                      )}
                      {externalHref && (
                        <Link href={externalHref} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#181914] px-4 py-3 text-xs font-black text-white sm:flex-none">
                          <ExternalLink size={14}/>Open Link
                        </Link>
                      )}
                    </div>
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
