'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/** Shared email/password Firebase session; never create another login provider.
 * Native bonus is checked only on app launch/sign-in, never on homepage render,
 * product scroll, checkout, or chat. Reward is shown ONLY after verified credit.
 */
export default function NativePushIdentity() {
  const [congratulations, setCongratulations] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const currentUid = useRef('');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const nativeV12 = () => Boolean(window.PrimeHubNative) &&
      /PrimeHubApp\/(?:12|1[3-9]|[2-9]\d)\./.test(navigator.userAgent);

    const onBonus = (event: Event) => {
      const detail = (event as CustomEvent<{ success?: boolean }>).detail;
      if (!detail?.success || !currentUid.current) return;
      try { localStorage.setItem('primehub_verified_app_bonus_' + currentUid.current, 'credited'); } catch {}
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
      if (!user || !nativeV12()) return;
      try {
        if (localStorage.getItem('primehub_verified_app_bonus_' + user.uid) === 'credited') return;
      } catch {}
      // Warm-up after auth: the 2-3s popup goal applies when attestation returns
      // promptly. Never show a fake Rs.100 credit while verification is in progress.
      timer = setTimeout(() => {
        void (async () => {
          if (cancelled || currentUid.current !== user.uid) return;
          try {
            const response = await fetch('/api/reseller/play-install-bonus', { cache: 'no-store' });
            if (!response.ok) return;
            const status = await response.json();
            if (!status.enabled || cancelled || currentUid.current !== user.uid) return;
            const idToken = await user.getIdToken();
            if (!cancelled && currentUid.current === user.uid && nativeV12()) {
              window.PrimeHubNative?.postMessage(JSON.stringify({ action: 'playBonus', idToken }));
            }
          } catch { /* App bonus unavailable: never disrupt the store. */ }
        })();
      }, 1200);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('primehub:play-bonus-result', onBonus);
    };
  }, []);
  if (!congratulations || dismissed) return null;
  return (
    <div className="fixed inset-x-3 top-16 z-[300] mx-auto max-w-sm rounded-[26px] border border-[#0F6A5F]/15 bg-white p-5 shadow-[0_18px_70px_rgba(0,0,0,.24)]" role="alertdialog" aria-label="App install bonus awarded">
      <button type="button" onClick={() => { setDismissed(true); setCongratulations(false); }} aria-label="Close bonus congratulations" className="absolute right-3 top-3 rounded-full bg-[#F4F4F1] px-3 py-2 text-sm font-black">✕</button>
      <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#0F6A5F]">🎉 Congratulations!</p>
      <h2 className="mt-2 text-2xl font-black">You got Rs. 100!</h2>
      <p className="mt-2 text-xs leading-5 text-black/60">Your verified PrimeHub Play Store bonus has been added to your <b>Withdrawal Balance</b>. You can also spend it shopping. Minimum cash withdrawal is Rs. 500.</p>
      <Link href="/reseller/wallet" onClick={() => setDismissed(true)} className="mt-4 inline-flex rounded-xl bg-[#0F6A5F] px-5 py-3 text-xs font-black text-white">View My Wallet →</Link>
    </div>
  );
}
