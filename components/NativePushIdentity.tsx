'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/** Shared email/password Firebase session; never create another login provider.
 * Welcome bonus is checked only after existing app login, never on product scroll
 * or chat. Popup appears ONLY after the server actually credits wallet cash.
 */
export default function NativePushIdentity() {
  const [congratulations, setCongratulations] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const currentUid = useRef('');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let requestedUid = '';
    const nativeV12 = () => Boolean(window.PrimeHubNative) &&
      /PrimeHubApp\/(?:12|1[3-9]|[2-9]\d)\./.test(navigator.userAgent);

    function scheduleBonus(userId: string, waitMs: number) {
      if (timer) clearTimeout(timer);
      if (!userId || requestedUid === userId || !nativeV12()) return;
      timer = setTimeout(() => { void (async () => {
        if (cancelled || currentUid.current !== userId) return;
        const user = auth.currentUser;
        if (!user || user.uid !== userId) return;
        try {
          if (localStorage.getItem('primehub_app_bonus_account_' + userId) || localStorage.getItem('primehub_app_bonus_device_claimed') === '1') return;
        } catch {}
        try {
          const response = await fetch('/api/reseller/play-install-bonus', { cache: 'no-store' });
          if (!response.ok) return;
          const status = await response.json();
          if (!status.enabled || cancelled || currentUid.current !== userId) return;
          const idToken = await user.getIdToken();
          if (!cancelled && currentUid.current === userId && nativeV12()) {
            requestedUid = userId;
            window.PrimeHubNative?.postMessage(JSON.stringify({ action: 'playBonus', idToken }));
          }
        } catch { /* Never interrupt shopping/authentication for a bonus. */ }
      })(); }, waitMs);
    }
    function profileReady() {
      // New signups get their verified bonus immediately AFTER their existing
      // email/password reseller profile has been created.
      const userId = auth.currentUser?.uid || '';
      if (userId && currentUid.current === userId) scheduleBonus(userId, 250);
    }
    window.addEventListener('primehub:reseller-profile-ready', profileReady);
    const onBonus = (event: Event) => {
      const detail = (event as CustomEvent<{
        success?: boolean; alreadyClaimed?: boolean; reason?: string;
      }>).detail;
      if (!currentUid.current) return;
      if (detail?.alreadyClaimed) {
        // Do not display fake congratulations for an already used reward.
        try {
          if (detail.reason === 'device') localStorage.setItem('primehub_app_bonus_device_claimed', '1');
          if (detail.reason === 'account') localStorage.setItem('primehub_app_bonus_account_' + currentUid.current, 'already-claimed');
        } catch {}
        return;
      }
      if (!detail?.success) { requestedUid = ''; return; }
      try {
        localStorage.setItem('primehub_app_bonus_account_' + currentUid.current, 'credited');
        localStorage.setItem('primehub_app_bonus_device_claimed', '1');
      } catch {}
      setDismissed(false);
      setCongratulations(true);
      window.dispatchEvent(new CustomEvent('primehub:wallet-updated'));
    };
    window.addEventListener('primehub:play-bonus-result', onBonus);
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (timer) clearTimeout(timer);
      currentUid.current = user?.uid || '';
      setCongratulations(false);
      setDismissed(false);
      const bridge = window.PrimeHubNative;
      if (!bridge) return;
      try {
        const idToken = user ? await user.getIdToken() : '';
        if (!cancelled) bridge.postMessage(JSON.stringify({ action: 'identity', idToken }));
      } catch { /* Push identity sync must not affect shopping or login. */ }
      if (user) scheduleBonus(user.uid, 1200);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('primehub:play-bonus-result', onBonus);
      window.removeEventListener('primehub:reseller-profile-ready', profileReady);
    };
  }, []);
  if (!congratulations || dismissed) return null;
  return (
    <div className="fixed inset-x-3 top-16 z-[300] mx-auto max-w-sm rounded-[26px] border border-[#0F6A5F]/15 bg-white p-5 shadow-[0_18px_70px_rgba(0,0,0,.24)]" role="alertdialog" aria-label="App install bonus awarded">
      <button type="button" onClick={() => { setDismissed(true); setCongratulations(false); }} aria-label="Close bonus congratulations" className="absolute right-3 top-3 rounded-full bg-[#F4F4F1] px-3 py-2 text-sm font-black">✕</button>
      <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#0F6A5F]">🎉 Congratulations!</p>
      <h2 className="mt-2 text-2xl font-black">You got Rs. 100!</h2>
      <p className="mt-2 text-xs leading-5 text-black/60">Your PrimeHub app welcome bonus has been added to your <b>Withdrawal Balance</b>. You can also spend it shopping. Minimum cash withdrawal is Rs. 500.</p>
      <Link href="/reseller/wallet" onClick={() => setDismissed(true)} className="mt-4 inline-flex rounded-xl bg-[#0F6A5F] px-5 py-3 text-xs font-black text-white">View My Wallet →</Link>
    </div>
  );
}
