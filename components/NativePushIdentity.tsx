'use client';

import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import PrimeFamilyWelcomePopup, { type WelcomeReward } from '@/components/reseller/PrimeFamilyWelcomePopup';

type ReferralResult = { code?: string; referralEnabled?: boolean; percent?: number };
type ProfileEvent = Event & { detail?: { newSignup?: boolean } };

/** One existing Firebase identity for App bonus and member referrals.
 * The gift UI never claims cash until the native bridge confirms a real server
 * credit, and the code is allocated by an authenticated Firestore transaction.
 */
export default function NativePushIdentity() {
  const [welcome, setWelcome] = useState<WelcomeReward | null>(null);
  const uidRef = useRef('');
  const dismissedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let requestedBonusUid = '';
    const pendingCodes = new Map<string, Promise<ReferralResult | null>>();
    const signups = new Set<string>();
    const credited = new Set<string>();

    const nativePlayApp = () => Boolean(window.PrimeHubNative) &&
      /PrimeHubApp\/(?:12|1[3-9]|[2-9]\d)\./.test(navigator.userAgent);
    function alreadyShown(uid: string) {
      try { return localStorage.getItem('primehub_welcome_popup_shown_v1:' + uid) === '1'; }
      catch { return false; }
    }

    function displayVerified(uid: string, referral: ReferralResult) {
      if (cancelled || uidRef.current !== uid || !referral.code || !/^PRIMEFAMILY[1-9][0-9]{0,6}$/.test(referral.code)) return;
      if (alreadyShown(uid)) {
        // The celebration was already shown this account on this installation.
        // An in-flight bonus confirmation may update a currently open modal,
        // but never reopen a dismissed one or re-award cash.
        if (credited.has(uid) && !dismissedRef.current) {
          setWelcome(current => current && current.code === referral.code ? { ...current, credited: true } : current);
        }
        return;
      }
      if (!signups.has(uid) && !credited.has(uid)) return;
      const reward: WelcomeReward = {
        code: referral.code,
        enabled: referral.referralEnabled === true,
        percent: Number(referral.percent || 10),
        credited: credited.has(uid),
        nativeApp: nativePlayApp(),
      };
      // UI show-once marker only. Never controls or creates the actual wallet
      // transaction, which is handled by native Play bonus server endpoint.
      try { localStorage.setItem('primehub_welcome_popup_shown_v1:' + uid, '1'); } catch {}
      dismissedRef.current = false;
      setWelcome(reward);
    }

    async function issueReferral(uid: string): Promise<ReferralResult | null> {
      if (!uid || cancelled || uidRef.current !== uid) return null;
      const existing = pendingCodes.get(uid);
      if (existing) {
        const result = await existing;
        if (result) { displayVerified(uid, result); return result; }
        // A signup can finish writing its reseller profile while an earlier
        // auth-state request is still in flight. Retry once after that fails.
        pendingCodes.delete(uid);
        if (signups.has(uid)) return issueReferral(uid);
        return null;
      }
      const request = (async () => {
        try {
          const user = auth.currentUser;
          if (!user || user.uid !== uid) return null;
          const idToken = await user.getIdToken();
          if (cancelled || uidRef.current !== uid) return null;
          const response = await fetch('/api/reseller/referral-code', {
            method: 'POST', cache: 'no-store', credentials: 'same-origin',
            headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          });
          if (!response.ok) return null;
          const data = await response.json() as ReferralResult;
          if (!data.code) return null;
          return data;
        } catch {
          return null; // Never block login, shopping or native bonus.
        }
      })();
      pendingCodes.set(uid, request);
      const result = await request;
      if (!result) pendingCodes.delete(uid); // retry if profile creation was slower
      if (result) displayVerified(uid, result);
      return result;
    }

    function scheduleBonus(uid: string, delayMs: number) {
      if (timer) clearTimeout(timer);
      if (!uid || requestedBonusUid === uid || !nativePlayApp()) return;
      timer = setTimeout(() => { void (async () => {
        if (cancelled || uidRef.current !== uid) return;
        const user = auth.currentUser;
        if (!user || user.uid !== uid) return;
        try {
          if (localStorage.getItem('primehub_app_bonus_account_' + uid) ||
            localStorage.getItem('primehub_app_bonus_device_claimed') === '1') return;
        } catch {}
        try {
          const response = await fetch('/api/reseller/play-install-bonus', { cache: 'no-store' });
          if (!response.ok) return;
          const offer = await response.json();
          if (!offer.enabled || cancelled || uidRef.current !== uid) return;
          const idToken = await user.getIdToken();
          if (!cancelled && uidRef.current === uid && nativePlayApp()) {
            requestedBonusUid = uid;
            window.PrimeHubNative?.postMessage(JSON.stringify({ action: 'playBonus', idToken }));
          }
        } catch { /* Do not interrupt an authenticated shopper. */ }
      })(); }, delayMs);
    }

    function profileReady(event: Event) {
      const uid = auth.currentUser?.uid || '';
      if (!uid) return;
      uidRef.current = uid;
      const detail = (event as ProfileEvent).detail;
      if (detail?.newSignup === true) signups.add(uid);
      void issueReferral(uid);
      scheduleBonus(uid, 250);
    }
    window.addEventListener('primehub:reseller-profile-ready', profileReady);

    function onBonusResult(event: Event) {
      const detail = (event as CustomEvent<{
        success?: boolean; alreadyClaimed?: boolean; reason?: string;
      }>).detail;
      const uid = uidRef.current;
      if (!uid) return;
      if (detail?.alreadyClaimed) {
        try {
          if (detail.reason === 'device') localStorage.setItem('primehub_app_bonus_device_claimed', '1');
          if (detail.reason === 'account') localStorage.setItem('primehub_app_bonus_account_' + uid, 'already-claimed');
        } catch {}
        return;
      }
      if (!detail?.success) { requestedBonusUid = ''; return; }
      try {
        localStorage.setItem('primehub_app_bonus_account_' + uid, 'credited');
        localStorage.setItem('primehub_app_bonus_device_claimed', '1');
      } catch {}
      credited.add(uid);
      window.dispatchEvent(new CustomEvent('primehub:wallet-updated'));
      void issueReferral(uid);
    }
    window.addEventListener('primehub:play-bonus-result', onBonusResult);

    const unsubscribe = onAuthStateChanged(auth, async user => {
      const uid = user?.uid || '';
      if (timer) clearTimeout(timer);
      if (uidRef.current !== uid) {
        uidRef.current = uid;
        requestedBonusUid = '';
        signups.clear();
        credited.clear();
        pendingCodes.clear();
        dismissedRef.current = false;
        setWelcome(null);
      }
      const bridge = window.PrimeHubNative;
      if (bridge) {
        try {
          const idToken = user ? await user.getIdToken() : '';
          if (!cancelled && uidRef.current === uid) {
            bridge.postMessage(JSON.stringify({ action: 'identity', idToken }));
          }
        } catch { /* Push/bonus identity bridge cannot interrupt login. */ }
      }
      if (user) {
        // Assign a permanent numbered code on login, not only on Dashboard.
        // A brand-new signup whose Firestore profile is still being created
        // retries after primehub:reseller-profile-ready fires.
        void issueReferral(user.uid);
        scheduleBonus(user.uid, 1200);
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('primehub:play-bonus-result', onBonusResult);
      window.removeEventListener('primehub:reseller-profile-ready', profileReady);
    };
  }, []);

  if (!welcome) return null;
  return <PrimeFamilyWelcomePopup reward={welcome} close={() => {
    dismissedRef.current = true;
    setWelcome(null);
  }} />;
}
