'use client';

import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ArrowLeft, ChevronRight, Crown } from 'lucide-react';
import { useEffect, useState } from 'react';
import HomeResellerClubFull from '@/components/home/HomeResellerClubFull';
import { auth } from '@/lib/firebase';

export default function ResellerPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  return (
    <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
      <section className="border-b border-black/5 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-[#F4F4F1] px-3 py-2 text-[10px] font-black text-black/60"><ArrowLeft size={13}/> Home</Link>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 text-xs font-black sm:flex"><Crown size={15} className="text-[#B4871D]"/> PrimeHub Reseller Club</div>
            <Link href={user ? '/reseller/dashboard' : '/reseller/join'} className="inline-flex items-center gap-1 rounded-full bg-[#14140F] px-3 py-2 text-[10px] font-black text-white">{user ? 'Open Dashboard' : 'Login / Join'} <ChevronRight size={12}/></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-0 py-4 sm:px-4 sm:py-6">
        <HomeResellerClubFull />
      </section>
    </main>
  );
}
