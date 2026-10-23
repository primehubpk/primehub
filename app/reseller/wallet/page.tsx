'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ShoppingBag, ShieldCheck, History } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getMyResellerProfile } from '@/lib/resellerLiveData';

export default function ResellerWalletPage() {
  const [legacy, setLegacy] = useState(0);
  const [shopping, setShopping] = useState(0);
  const [pending, setPending] = useState(0);
  useEffect(() => onAuthStateChanged(auth, user => {
    if (!user) return;
    void getMyResellerProfile(user.uid).then(profile => {
      setLegacy(Math.max(0, Number(profile?.walletAvailable || 0)));
      setShopping(Math.max(0, Number(profile?.walletShopping || 0)));
      setPending(Math.max(0, Number(profile?.walletPending || 0)));
    }).catch(console.error);
  }), []);
  return <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
    <Link href="/reseller/dashboard" className="fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-full bg-[#14140F]/90 px-3.5 py-2 text-[10px] font-black text-white"><ArrowLeft size={13}/> Back to Family</Link>
    <section className="bg-gradient-to-br from-[#11130E] to-[#0F665B] px-4 pb-8 pt-16 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mt-6 flex items-center gap-3"><ShoppingBag className="text-[#FFCF68]" size={30}/><div><p className="text-xs font-bold text-[#FFCF68]">Prime Family</p><h1 className="text-2xl font-black">Shopping Rewards Wallet</h1></div></div>
        <div className="mt-6 rounded-2xl bg-white/10 p-5">
          <p className="text-xs text-white/70">Total credit available for eligible PrimeHub shopping</p>
          <strong className="mt-2 block text-3xl font-black">Rs. {(legacy + shopping).toLocaleString()}</strong>
          <p className="mt-2 text-xs text-white/70">New rewards are shopping-only credit; they cannot be withdrawn or transferred outside PrimeHub.</p>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="rounded-[26px] bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black"><History size={17}/> Balance details</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#E9F7F3] p-4"><p className="text-xs text-[#176E62]">Shopping-only rewards</p><strong>Rs. {shopping.toLocaleString()}</strong></div>
          <div className="rounded-xl bg-[#F3F1ED] p-4"><p className="text-xs">Existing reward balance</p><strong>Rs. {legacy.toLocaleString()}</strong></div>
        </div>
        {pending > 0 && <p className="mt-3 text-xs">Existing pending balance: Rs. {pending.toLocaleString()}</p>}
      </div>
      <div className="rounded-[24px] border border-[#0F6A5F]/10 bg-[#0F6A5F]/5 p-4">
        <h2 className="flex items-center gap-2 text-sm font-black"><ShieldCheck size={17}/> About your rewards</h2>
        <p className="mt-2 text-xs leading-5 text-black/60">New welcome, referral and purchase rewards can be used only on eligible PrimeHub purchases. No cash withdrawal or bank transfer is offered for new rewards.</p>
        <p className="mt-2 text-xs leading-5 text-black/60">If you had an existing cash-out request or were promised a withdrawal under the older terms, please contact PrimeHub support so your original entitlement can be reviewed. Your previous balance has not been erased.</p>
        <Link className="mt-3 inline-block text-xs font-bold text-[#0F6A5F] underline" href="/contact">Contact PrimeHub support</Link>
      </div>
    </section>
  </main>;
}
