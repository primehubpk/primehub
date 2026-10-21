'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { CartItem } from '@/lib/cartStore';
import { readCheckoutPreferences, writeCheckoutPreferences } from '@/lib/checkoutPreferences';

/** Read-only server quote: real deals, vouchers, delivery and tier estimates.
 * No wallet debit or real order is made from the cart screen.
 */
export function useCartQuote(items: CartItem[]) {
  const [selfCollect, setSelfCollect] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherInput, setVoucherInput] = useState('');
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState('');
  const [quote, setQuote] = useState<Record<string, any> | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [quoteNonce, setQuoteNonce] = useState(0);

  useEffect(() => {
    const saved = readCheckoutPreferences();
    let pendingCode = '';
    try { pendingCode = String(sessionStorage.getItem('primehub_pending_friend_referral_v1') || '').toUpperCase(); } catch {}
    const code = saved.voucherCode || (/^PRIMEFAMILY[1-9][0-9]{0,6}$/.test(pendingCode) ? pendingCode : '');
    setSelfCollect(saved.selfCollect);
    setVoucherCode(code);
    setVoucherInput(code);
    setPreferencesReady(true);
  }, []);
  useEffect(() => onAuthStateChanged(auth, user => {
    setUid(user?.uid || '');
    setAuthReady(true);
  }), []);
  useEffect(() => {
    if (preferencesReady) writeCheckoutPreferences({ selfCollect, voucherCode });
  }, [selfCollect, voucherCode, preferencesReady]);
  useEffect(() => {
    if (!preferencesReady || !authReady || !items.length) return;
    let cancelled = false;
    const abort = new AbortController();
    setLoading(true);
    setQuote(null);
    setQuoteError('');
    // Debounce quantity taps so one quick cart edit does not create multiple
    // chargeable server/database quotes.
    const timer = window.setTimeout(() => { void (async () => {
      try {
        const user = auth.currentUser;
        const token = user && user.uid === uid ? await user.getIdToken() : '';
        if (cancelled) return;
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ mode: 'quote', items, selfCollect, voucherCode }),
          signal: abort.signal,
          cache: 'no-store',
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to verify live checkout prices.');
        if (!cancelled) setQuote(body);
      } catch (error) {
        if (!cancelled) setQuoteError(error instanceof Error ? error.message : 'Could not verify checkout.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })(); }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); abort.abort(); };
  }, [items, selfCollect, voucherCode, uid, authReady, preferencesReady, quoteNonce]);

  const applyVoucher = () => {
    setVoucherCode(voucherInput.trim().toUpperCase());
    setQuoteNonce(value => value + 1);
  };
  return {
    selfCollect, setSelfCollect, voucherCode, voucherInput, setVoucherInput,
    applyVoucher, quote, quoteError, signedIn: Boolean(uid), authReady, loading: loading || !preferencesReady || !authReady,
  };
}
