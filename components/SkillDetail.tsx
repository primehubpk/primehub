'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Check, ExternalLink, MessageCircle } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PRIME_SKILLS_SEED } from '@/lib/primeSkillsSeed';
import { normalizeImageUrl } from '@/lib/imageUrl';

type MediaType = 'image' | 'video-link' | 'external-link';
type SkillPackage = { id: string; name: string; price: number; description?: string; active?: boolean };
export type SkillDetailItem = {
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
  packages?: SkillPackage[];
};

function normalizeWhatsapp(number?: string) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('92') ? digits : digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
}

function whatsappUrl(number: string | undefined, item: SkillDetailItem, selected?: SkillPackage | null) {
  const international = normalizeWhatsapp(number);
  if (!international) return '';
  const chosenPrice = selected ? selected.price : Number(item.price || 0);
  const price = chosenPrice > 0 ? `Rs. ${Number(chosenPrice).toLocaleString()}` : 'Please confirm';
  const lines = [
    'Assalam o Alaikum, mujhe PrimeHub ki ye online skill/service order karni hai.',
    '',
    `*Service:* ${item.title || 'Prime Skill'}`,
    selected ? `*Package:* ${selected.name}` : '',
    `*Price:* ${price}`,
    selected?.description ? `*Package Details:* ${selected.description}` : '',
    item.subtitle ? `*Service Details:* ${item.subtitle}` : '',
    '',
    'Please order details aur next step share kar dein.',
  ].filter(Boolean);
  return `https://wa.me/${international}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function safeExternalUrl(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function displayPrice(item: SkillDetailItem) {
  const packages = (item.packages || []).filter((pkg) => pkg.active !== false && Number(pkg.price) > 0);
  if (packages.length) return Math.min(...packages.map((pkg) => Number(pkg.price)));
  return Number(item.price || 0);
}

export default function SkillDetail({ skillId, initialItems = [] }: { skillId: string; initialItems?: SkillDetailItem[] }) {
  const [items, setItems] = useState<SkillDetailItem[]>(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [selectedPackageId, setSelectedPackageId] = useState('');

  useEffect(() => onSnapshot(
    collection(db, 'prime_skills'),
    (snapshot) => {
      setItems(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as SkillDetailItem)));
      setLoading(false);
    },
    () => setLoading(false),
  ), []);

  const source: SkillDetailItem[] = items.length ? items : PRIME_SKILLS_SEED;
  const active = useMemo(() => source.filter((entry) => entry.active !== false).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)), [source]);
  const item = active.find((entry) => entry.id === skillId) || (PRIME_SKILLS_SEED as SkillDetailItem[]).find((entry) => entry.id === skillId);
  const related = active.filter((entry) => entry.id !== skillId).slice(0, 4);

  if (loading) return <main className="min-h-screen bg-[#F4F4F1] px-3 py-6"><div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-center text-sm font-bold text-black/40">Loading skill...</div></main>;
  if (!item) return <main className="min-h-screen bg-[#F4F4F1] px-3 py-6"><div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 text-center"><p className="text-sm font-black">Skill not found.</p><Link href="/skills" className="mt-3 inline-flex text-xs font-black text-[#0F6A5F]">Back to Prime Skills</Link></div></main>;

  const packages = (item.packages || []).filter((pkg) => pkg.active !== false);
  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) || null;
  const waHref = whatsappUrl(item.whatsapp, item, selectedPackage);
  const externalHref = safeExternalUrl(item.externalUrl);
  const basePrice = displayPrice(item);
  const heroImage = normalizeImageUrl(item.thumbnailUrl);

  return <main className="min-h-screen overflow-x-hidden bg-[#F4F4F1] px-3 pb-28 pt-3 sm:px-6 sm:pt-8">
    <div className="mx-auto max-w-5xl">
      <Link href="/skills" className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-black text-black/55 sm:text-xs"><ArrowLeft size={14}/>Prime Skills</Link>
      <article className="overflow-hidden rounded-[20px] border border-black/5 bg-white shadow-[0_12px_34px_rgba(20,20,15,0.07)] sm:rounded-[28px]">
        <div className="relative aspect-video bg-[#ECECE7]">{heroImage ? <Image src={heroImage} alt={item.title || 'Prime Skill'} fill sizes="(max-width: 1024px) 100vw, 1024px" priority quality={78} className="object-cover"/> : null}</div>
        <div className="p-4 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><h1 className="text-xl font-black leading-tight text-[#181914] sm:text-3xl">{item.title}</h1>{item.subtitle && <p className="mt-2 text-[13px] font-medium leading-5 text-black/55 sm:text-base sm:leading-6">{item.subtitle}</p>}</div>
            {basePrice > 0 && <div className="w-fit shrink-0 rounded-xl bg-[#F4F4F1] px-3 py-2"><span className="block text-[8px] font-black uppercase tracking-wide text-black/35">{packages.length ? 'Starting from' : 'Price'}</span><span className="text-base font-black text-[#E1352B]">Rs {basePrice.toLocaleString()}</span></div>}
          </div>

          {packages.length > 0 && <section className="mt-5"><div className="mb-2"><p className="text-[9px] font-black uppercase tracking-[.16em] text-[#0F6A5F]">Choose package</p><h2 className="mt-1 text-sm font-black">Select before ordering</h2></div><div className="grid gap-2 sm:grid-cols-3">{packages.map((pkg) => { const selected = selectedPackageId === pkg.id; return <button key={pkg.id} type="button" onClick={() => setSelectedPackageId(pkg.id)} className={`relative rounded-2xl border p-3 text-left transition ${selected ? 'border-[#0F6A5F] bg-[#ECF8F5] shadow-[0_8px_20px_rgba(15,106,95,0.10)]' : 'border-black/8 bg-[#FAFAF7]'}`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-black">{pkg.name}</p><p className="mt-1 text-base font-black text-[#E1352B]">Rs {Number(pkg.price || 0).toLocaleString()}</p></div>{selected && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F6A5F] text-white"><Check size={13}/></span>}</div>{pkg.description && <p className="mt-2 text-[10px] font-medium leading-4 text-black/50">{pkg.description}</p>}</button>; })}</div></section>}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {waHref && <Link href={waHref} target="_blank" rel="noreferrer" onClick={(event) => { if (packages.length && !selectedPackage) { event.preventDefault(); alert('Please select a package first.'); } }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-xs font-black text-white"><MessageCircle size={14}/>{packages.length && !selectedPackage ? 'Select Package First' : item.buttonText || 'Order on WhatsApp'}</Link>}
            {externalHref && <Link href={externalHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#181914] px-4 py-3 text-xs font-black text-white"><ExternalLink size={14}/>Open Link</Link>}
          </div>
        </div>
      </article>

      {related.length > 0 && <section className="mt-6 sm:mt-8"><div className="mb-3"><p className="text-[8px] font-black uppercase tracking-[.18em] text-[#0F6A5F]">Prime Skills</p><h2 className="mt-1 text-base font-black sm:text-xl">Related Skills</h2></div><div className="grid grid-cols-2 gap-1.5 sm:gap-5">{related.map((entry, index) => { const price = displayPrice(entry); const image = normalizeImageUrl(entry.thumbnailUrl); return <Link key={entry.id} href={`/skills/${encodeURIComponent(entry.id)}`} className="overflow-hidden rounded-[14px] border border-black/5 bg-white shadow-sm sm:rounded-[20px]"><div className="relative aspect-[16/10] bg-[#ECECE7] sm:aspect-video">{image ? <Image src={image} alt={entry.title || 'Prime Skill'} fill sizes="(max-width: 640px) 50vw, 480px" priority={index < 2} quality={72} className="object-cover"/> : null}</div><div className="p-2 sm:p-4"><h3 className="line-clamp-2 text-[11px] font-black leading-[15px] sm:text-sm">{entry.title}</h3>{price > 0 && <p className="mt-1 text-[10px] font-black text-[#E1352B] sm:text-xs">{(entry.packages || []).length ? 'From ' : ''}Rs {price.toLocaleString()}</p>}</div></Link>; })}</div></section>}
    </div>
  </main>;
}
