'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Copy, Gift, Share2, Sparkles, Wallet, X } from 'lucide-react';

export type WelcomeReward = {
  code: string;
  percent: number;
  enabled: boolean;
  credited: boolean;
  nativeApp: boolean;
};

export default function PrimeFamilyWelcomePopup({
  reward, close,
}: { reward: WelcomeReward; close: () => void }) {
  const [feedback, setFeedback] = useState('');

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(reward.code);
      setFeedback('Code copied! Apne family aur friends ke saath share karein.');
    } catch {
      setFeedback('Copy unavailable. Code select karke manually copy karein.');
    }
  }

  async function shareInvitation() {
    const referralUrl = `${window.location.origin}/reseller/join?ref=${encodeURIComponent(reward.code)}`;
    const text = `PrimeHubMall family invitation! Mera code ${reward.code} use karein. Aapke eligible order ke Delivered hone par mujhe ${reward.percent}% referral cashback mil sakta hai. Aapka apna tier cashback is code ke saath add nahi hota. App: https://play.google.com/store/apps/details?id=com.primehubmall.app — ${referralUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'PrimeHub Family Invitation', text, url: referralUrl });
      } else {
        await navigator.clipboard.writeText(text);
        setFeedback('Invitation copied! Apne interested friends ko bhejein.');
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return;
      setFeedback('Share unavailable. Code copy karke share karein.');
    }
  }

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-[#141A16]/70 px-3 py-6 backdrop-blur-[5px]" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="primehub-welcome-heading"
        className="relative w-full max-w-[420px] overflow-hidden rounded-[30px] bg-white shadow-[0_35px_100px_rgba(0,0,0,.30)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#073C35] via-[#0F6A5F] to-[#176B63] px-6 pb-6 pt-7 text-center text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full border-[26px] border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-14 -left-8 h-40 w-40 rounded-full bg-[#F8CB74]/10 blur-xl" />
          <button type="button" onClick={close} aria-label="Close welcome offer"
            className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X size={18} /></button>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[21px] bg-[#FFDA8B] text-[#19483B] shadow-[0_10px_25px_rgba(0,0,0,.12)]"><Gift size={28}/></span>
          <p className="mt-3 flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-[.22em] text-[#FFE6B0]"><Sparkles size={13}/> Aap Prime Family mein aa gaye!</p>
          <h2 id="primehub-welcome-heading" className="mt-2 text-[27px] font-black leading-tight">Welcome to PRIME HUB!</h2>
          <p className="mx-auto mt-2 max-w-[290px] text-[12px] leading-5 text-white/85">Shopping bhi, apni family aur friends ke saath earning bhi. 🎉</p>
        </div>
        <div className="max-h-[min(68vh,560px)] overflow-y-auto px-5 pb-5 pt-4">
          <div className="rounded-2xl border border-[#EDD7A0] bg-gradient-to-r from-[#FFF6DF] to-[#FFFDF7] p-3.5">
            <p className="flex items-center gap-2 text-[12px] font-black text-[#785210]"><Wallet size={16}/> Rs. 100 Welcome Reward</p>
            <p className="mt-1 text-[11px] leading-5 text-[#6C5E44]">
              {reward.credited
                ? <>🎉 <b>Rs.100 aapke Cash Wallet mein credit ho gaye!</b></>
                : reward.nativeApp
                  ? <>Eligible Play Store app signup/login aur device verification ke baad <b>Rs.100 mil sakte hain.</b> Wallet mein credit hone par confirmation milegi.</>
                  : <>Play Store wali PrimeHub app mein eligible pehli login aur verification par <b>Rs.100 welcome reward</b> mil sakta hai. Website signup par cash credit nahi hua.</>}
            </p>
            <p className="mt-1 text-[10px] text-[#897A5F]">Cash withdrawal minimum Rs.500, verification aur approval ke baad.</p>
          </div>
          <p className="mt-4 text-center text-[10px] font-black uppercase tracking-[.13em] text-[#0F6A5F]">Aapka unique referral code</p>
          <div className="mt-2 rounded-[18px] border border-dashed border-[#1A8A79]/50 bg-[#F1FAF6] px-4 py-3.5 text-center">
            <p className="break-all text-[23px] font-black tracking-[.04em] text-[#0F6A5F]">{reward.code}</p>
            <p className="mt-1 text-[10px] font-bold text-[#51746B]">Yeh code sirf aapka hai — lifetime same rahega.</p>
          </div>
          <div className="mt-3 rounded-xl bg-[#F6F7F5] p-3 text-[11px] leading-[1.65] text-[#35433D]">
            <p className="font-black">Family aur friends ko invite karein 👇</p>
            <p>Jab koi doosra customer aapka code qualifying order mein use kare aur order <b>Delivered</b> ho, aapko {reward.percent}% cashback Cash Wallet mein milega. {reward.enabled ? '' : 'Offer Admin activation ke baad valid hoga.'}</p>
            <p className="mt-1 text-[10px] text-[#7A817A]">Friend ko is referral order par extra tier cashback nahi milta. Weekly aur Big Deal items excluded hain.</p>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void copyCode()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#0F6A5F]/15 bg-white px-3 py-3 text-[12px] font-black text-[#0F6A5F]"><Copy size={15}/> Copy Code</button>
            <button type="button" onClick={() => void shareInvitation()} disabled={!reward.enabled}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0F6A5F] px-3 py-3 text-[12px] font-black text-white disabled:opacity-50"><Share2 size={15}/> Share & Earn</button>
          </div>
          {feedback && <p role="status" className="mt-2 text-center text-[11px] font-bold text-[#0F6A5F]">{feedback}</p>}
          <Link href="/reseller/dashboard" onClick={close}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#F5F4F0] py-3 text-[11px] font-black text-[#263D35]"><Check size={15}/> Open My Prime Family Dashboard</Link>
          <button type="button" onClick={close} className="mt-2 w-full py-2 text-center text-[11px] font-bold text-black/45">Continue Shopping</button>
        </div>
      </div>
    </div>
  );
}
