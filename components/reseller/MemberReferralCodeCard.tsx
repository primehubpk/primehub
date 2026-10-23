'use client';

import { useEffect, useState } from 'react';
import { Copy, Gift, Share2, Users } from 'lucide-react';
import { auth } from '@/lib/firebase';

export default function MemberReferralCodeCard({ memberUid }: { memberUid: string }) {
  const [code, setCode] = useState('');
  const [active, setActive] = useState(false);
  const [percent, setPercent] = useState(10);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!memberUid) return;
    let mounted = true;
    void (async () => {
      try {
        const user = auth.currentUser;
        if (!user || user.uid !== memberUid) return;
        const token = await user.getIdToken();
        const response = await fetch('/api/reseller/referral-code', {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          cache: 'no-store', credentials: 'same-origin',
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not create a referral code.');
        if (mounted) {
          setCode(body.code); setActive(Boolean(body.referralEnabled)); setPercent(Number(body.percent || 10));
        }
      } catch (error) {
        if (mounted) setMessage(error instanceof Error ? error.message : 'Please retry later.');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [memberUid]);
  if (!memberUid) return <section className="rounded-2xl border border-emerald-100 bg-white p-4">
    <h3 className="text-sm font-black">Invite family & friends</h3>
    <p className="mt-2 text-xs text-black/60">Sign in to get your personal referral code and check active rewards.</p>
  </section>;
  async function share() {
    if (!code) return;
    const url = `${window.location.origin}/reseller/join?ref=${encodeURIComponent(code)}`;
    const message = `PrimeHubMall ki jewellery aur bangles explore karein! Mera referral code ${code} use karein. Jab aapka eligible order successfully Delivered hoga, mujhe ${percent}% referral cashback mil sakta hai (aapko extra cashback add nahi hota). App: https://play.google.com/store/apps/details?id=com.primehubmall.app . ${url}`;
    try {
      if (navigator.share) await navigator.share({ title: 'PrimeHub Family', text: message, url });
      else { await navigator.clipboard.writeText(message); setMessage('Invitation copied. Share with interested family or friends.'); }
    } catch {
      setMessage('Share cancelled. You can copy your code instead.');
    }
  }
  return <section className="rounded-[24px] border border-[#0F6A5F]/15 bg-gradient-to-br from-[#F2FBF7] to-white p-4 shadow-sm">
    <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[.15em] text-[#0F6A5F]"><Users size={13}/> Prime Family Referral</p>
    <h3 className="mt-1 text-lg font-black">Your personal invitation code</h3>
    <p className="mt-2 text-xs text-black/60">Share with interested friends and family. If they use it on an eligible order, you earn {percent}% PrimeHub shopping credit when the order is verified Delivered. No stacking with their own tier reward. New app users may separately qualify for a one-time Rs100 Play Store welcome reward after verified login.</p>
    {loading ? <p className="mt-3 text-xs">Checking your permanent member code…</p> : code ? <>
      <div className="mt-3 rounded-xl border border-dashed border-[#0F6A5F]/35 bg-white px-4 py-3 text-center text-xl font-black tracking-[.12em] text-[#0F6A5F]">{code}</div>
      <p className="mt-1 text-[10px] font-bold text-[#8A6200]">{active ? `Live: ${percent}% referrer reward on qualifying orders` : 'Referral rewards are not active yet. Please check back after Admin enables them.'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => { void navigator.clipboard.writeText(code).then(() => setMessage('Your code copied.')).catch(() => setMessage('Copy unavailable.')); }} className="flex items-center gap-1 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-black"><Copy size={13}/> Copy code</button>
        <button disabled={!active} onClick={() => void share()} className="flex items-center gap-1 rounded-xl bg-[#0F6A5F] px-3 py-2.5 text-xs font-black text-white disabled:opacity-45"><Share2 size={13}/> Share invitation</button>
      </div>
    </> : <p className="mt-3 text-xs text-rose-600">Code unavailable; please try after account setup.</p>}
    <p className="mt-3 flex items-center gap-1 text-[10px] text-black/50"><Gift size={12}/> Referral reward belongs to the inviter; buyer does not earn a second cashback on a referral-code order.</p>
    {message && <p role="status" className="mt-2 text-[11px] font-bold text-[#0F6A5F]">{message}</p>}
  </section>;
}
