'use client';

import Link from 'next/link';
import { Mail, MapPin, MessageCircle } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

function normalizeWhatsApp(value: string) {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return digits;
}

export default function Page() {
  const { contact, loading } = useSettings();
  const whatsapp = normalizeWhatsApp(contact?.whatsappNumber || '');
  const whatsappHref = whatsapp ? `https://wa.me/${whatsapp}` : '#';
  const email = contact?.email?.trim() || '';
  const address = contact?.physicalAddress?.trim() || 'Prime Hub (Sabir Bangles Store), Lahore';

  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 py-10 pb-28 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-black/6 bg-white p-6 shadow-sm sm:p-10">
        <div className="border-b border-black/8 pb-6">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#E1352B]">PrimeHub Deals</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#14140F] sm:text-4xl">Contact Us</h1>
          <p className="mt-3 text-sm leading-6 text-black/55">Reach our team for order help, product questions, wholesale enquiries, or delivery support.</p>
        </div>

        {loading ? (
          <p className="mt-7 text-sm leading-7 text-black/40">Loading latest contact details...</p>
        ) : (
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <a href={whatsappHref} target={whatsapp ? '_blank' : undefined} rel={whatsapp ? 'noreferrer' : undefined} className="rounded-2xl border border-[#25D366]/20 bg-[#25D366]/5 p-5 transition hover:bg-[#25D366]/10">
              <MessageCircle className="h-6 w-6 text-[#25D366]" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-[#14140F]">Official Support</p>
              <p className="mt-1 break-all text-sm font-semibold text-black/65">{contact?.whatsappNumber || 'WhatsApp support'}</p>
            </a>
            <a href={email ? `mailto:${email}` : '#'} className="rounded-2xl border border-black/8 bg-[#F8F7F3] p-5 transition hover:bg-black/[0.03]">
              <Mail className="h-6 w-6 text-[#0F6A5F]" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-[#14140F]">Email</p>
              <p className="mt-1 break-all text-sm font-semibold text-black/65">{email || 'Email support'}</p>
            </a>
            <a href="https://www.google.com/maps/search/?api=1&query=Prime+Hub+Sabir+Bangles+Store+Shop+217+Street+7+Gulistan+Colony+Mustafabad+Dharampura+Lahore" target="_blank" rel="noreferrer" className="rounded-2xl border border-black/8 bg-[#F8F7F3] p-5 transition hover:bg-black/[0.03]">
              <MapPin className="h-6 w-6 text-[#FFB020]" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-[#14140F]">Physical Address</p>
              <p className="mt-1 text-sm leading-6 font-semibold text-black/65">{address}</p>
            </a>
          </div>
        )}

        <Link href="/" className="mt-8 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white transition hover:bg-[#0F6A5F]">Back to Home</Link>
      </article>
    </main>
  );
}
