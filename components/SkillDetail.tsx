'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, MessageCircle } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
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

function whatsappUrl(number?: string, title?: string) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return '';
  const international = digits.startsWith('92') ? digits : digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
  const text = `Assalam o Alaikum, mujhe PrimeHub par \"${title || 'is service'}\" order karna hai. Please details share kar dein.`;
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

function safeExternalUrl(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export default function SkillDetail({ skillId }: { skillId: string }) {
  const [items, setItems] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => onSnapshot(
    collection(db, 'prime_skills'),
    (snapshot) => {
      setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as SkillItem)));
      setLoading(false);
    },
    () => setLoading(false),
  ), []);

  const source = items.length ? items : PRIME_SKILLS_SEED;
  const active = useMemo(() => source.filter((item) => item.active !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)), [source]);
  const item = active.find((entry) => entry.id === skillId) || PRIME_SKILLS_SEED.find((entry) => entry.id === skillId);
  const related = active.filter((entry) => entry.id !== skillId).slice(0, 4);

  if (loading) return <main className="min-h-screen bg-[#F4F4F1] px-3 py-6"><div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-center text-sm font-bold text-black/40">Loading skill...</div></main>;
  if (!item) return <main className="min-h-screen bg-[#F4F4F1] px-3 py-6"><div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-center"><p className="text-sm font-black">Skill not found.</p><Link href="/skills" className="mt-3 inline-flex text-xs font-black text-[#0F6A5F]">Back to Prime Skills</Link></div></main>;

  const waHref = whatsappUrl(item.whatsapp, item.title);
  const externalHref = safeExternalUrl(item.externalUrl);

  return <main className="min-h-screen overflow-x-hidden bg-[#F4F4F1] px-3 pb-28 pt-3 sm:px-6 sm:pt-8">
    <div className="mx-auto max-w-5xl">
      <Link href="/skills" className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-black text-black/55 sm:text-xs"><ArrowLeft size={14}/>Prime Skills</Link>
      <article className="overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-[0_12px_34px_rgba(20,20,15,0.07)] sm:rounded-[28px]">
        <div className="aspect-video bg-[#ECECE7]">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={item.title || 'Prime Skill'} className="h-full w-full object-cover"/> : null}</div>
        <div className="p-4 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><h1 className="text-xl font-black leading-tight text-[#181914] sm:text-3xl">{item.title}</h1>{item.subtitle && <p className="mt-2 text-[13px] font-medium leading-5 text-black/55 sm:text-base sm:leading-6">{item.subtitle}</p>}</div>
            {Number(item.price || 0) > 0 && <div className="w-fit shrink-0 rounded-xl bg-[#F4F4F1] px-3 py-2"><span className="block text-[8px] font-black uppercase tracking-wide text-black/35">Price</span><span className="text-base font-black text-[#E1352B]">Rs {Number(item.price).toLocaleString()}</span></div>}
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {waHref && <Link href={waHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-xs font-black text-white"><MessageCircle size={14}/>Order on WhatsApp</Link>}
            {externalHref && <Link href={externalHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#181914] px-4 py-3 text-xs font-black text-white"><ExternalLink size={14}/>Open Link</Link>}
          </div>
        </div>
      </article>

      {related.length > 0 && <section className="mt-6 sm:mt-8"><div className="mb-3"><p className="text-[8px] font-black uppercase tracking-[.18em] text-[#0F6A5F]">Prime Skills</p><h2 className="mt-1 text-base font-black sm:text-xl">Related Skills</h2></div><div className="grid grid-cols-2 gap-1.5 sm:gap-5">{related.map((entry) => <Link key={entry.id} href={`/skills/${encodeURIComponent(entry.id)}`} className="overflow-hidden rounded-[14px] border border-black/5 bg-white shadow-sm sm:rounded-[20px]"><div className="aspect-[16/10] bg-[#ECECE7] sm:aspect-video">{entry.thumbnailUrl ? <img src={entry.thumbnailUrl} alt={entry.title || 'Prime Skill'} className="h-full w-full object-cover" loading="lazy"/> : null}</div><div className="p-2 sm:p-4"><h3 className="line-clamp-2 text-[11px] font-black leading-[15px] sm:text-sm">{entry.title}</h3>{Number(entry.price || 0) > 0 && <p className="mt-1 text-[10px] font-black text-[#E1352B] sm:text-xs">Rs {Number(entry.price).toLocaleString()}</p>}</div></Link>)}</div></section>}
    </div>
  </main>;
}