'use client';

import Link from 'next/link';
import { useSettings } from '@/lib/useSettings';

const FALLBACK_CONTENT = 'This page explains how PrimeHub Deals handles customer information and order-related data. Please contact the store team if you need clarification about our privacy practices.';

export default function Page() {
  const { policy, loading } = useSettings();
  const title = policy?.privacyPolicy?.title?.trim() || 'Privacy Policy';
  const content = policy?.privacyPolicy?.content?.trim() || FALLBACK_CONTENT;

  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 py-10 pb-28 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-black/6 bg-white p-6 shadow-sm sm:p-10">
        <div className="border-b border-black/8 pb-6">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#E1352B]">PrimeHub Deals</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#14140F] sm:text-4xl">{title}</h1>
        </div>
        {loading ? (
          <p className="mt-7 text-sm leading-7 text-black/40">Loading latest policy...</p>
        ) : (
          <div className="mt-7 whitespace-pre-line text-[15px] leading-8 text-black/65">{content}</div>
        )}
        <Link href="/" className="mt-8 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white transition hover:bg-[#0F6A5F]">Back to Home</Link>
      </article>
    </main>
  );
}
