import Link from 'next/link';

export default function Page() {
  const titles: Record<string,string> = { 'return-policy':'Return Policy', 'privacy-policy':'Privacy Policy', terms:'Terms of Service', contact:'Contact Us' };
  const title = titles['contact'];
  return <main className="min-h-screen bg-[#F4F4F1] px-4 py-10 pb-28"><article className="mx-auto max-w-2xl rounded-3xl bg-white p-7 shadow-sm"><h1 className="text-2xl font-black">{title}</h1><p className="mt-4 text-sm leading-7 text-black/60">This page is part of the PrimeHub Deals storefront. Please contact the store team for the latest policy details and order assistance.</p><Link href="/" className="mt-6 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white">Back to Home</Link></article></main>;
}
