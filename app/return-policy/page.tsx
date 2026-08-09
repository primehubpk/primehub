'use client';

import Link from 'next/link';
import { useSettings } from '@/lib/useSettings';

const FALLBACK_TITLE = 'Return Policy';
const FALLBACK_CONTENT = 'Please contact the PrimeHub Deals team for return or order assistance. Return eligibility and handling depend on the product and order circumstances.';

export default function Page() {
  const { settings, loading } = useSettings();
  const policy = settings.policies?.returnPolicy;

  const title = policy?.title?.trim() || FALLBACK_TITLE;
  const content = policy?.content?.trim() || FALLBACK_CONTENT;

  return (
    <main className="min-h-screen bg-[#F4F4F1] px-4 py-10 pb-28">
      <article className="mx-auto max-w-2xl rounded-3xl bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-black">{title}</h1>
        {loading ? (
          <p className="mt-4 text-sm leading-7 text-black/40">Loading latest policy...</p>
        ) : (
          <div className="mt-4 whitespace-pre-line text-sm leading-7 text-black/60">{content}</div>
        )}
        <Link href="/" className="mt-6 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white">
          Back to Home
        </Link>
      </article>
    </main>
  );
}
