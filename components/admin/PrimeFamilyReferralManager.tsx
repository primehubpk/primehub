'use client';

import { useEffect, useState } from 'react';

type ReferralSettings = { enabled: boolean; percent: number };
type CodeRow = { code: string; ownerEmail: string; ownerUid: string; createdAt: string };
type AwardRow = { code: string; amount: number; percent: number; ownerUid: string; orderId: string; createdAt: string };
type Report = {
  settings: ReferralSettings;
  welcomeBonus: { enabled: boolean; rupees: number; note: string };
  codes: CodeRow[];
  credits: AwardRow[];
  truncated: { codes: boolean; credits: boolean };
};

export default function PrimeFamilyReferralManager() {
  const [report, setReport] = useState<Report | null>(null);
  const [settings, setSettings] = useState<ReferralSettings>({ enabled: false, percent: 10 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [lookup, setLookup] = useState('');
  const [filteredCode, setFilteredCode] = useState('');
  async function refresh(codeFilter = filteredCode) {
    const route = '/api/admin/primefamily-referrals' + (codeFilter ? '?code=' + encodeURIComponent(codeFilter) : '');
    const response = await fetch(route, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load referral dashboard.');
    setReport(body); setSettings(body.settings);
  }
  useEffect(() => {
    let mounted = true;
    void fetch('/api/admin/primefamily-referrals', { cache: 'no-store' }).then(async res => {
      const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Referral admin unavailable.');
      if (mounted) { setReport(json); setSettings(json.settings); }
    }).catch(error => { if (mounted) setMessage(error instanceof Error ? error.message : 'Could not load.'); });
    return () => { mounted = false; };
  }, []);
  async function save() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/primefamily-referrals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Referral settings could not be saved.');
      await refresh(); setMessage('Referral program settings saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setBusy(false); }
  }
  return <section className="mx-auto mt-5 max-w-6xl rounded-[26px] bg-white p-4 shadow-sm sm:p-6">
    <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#0F6A5F]">Prime Family marketing</p>
    <h2 className="mt-1 text-xl font-black">Member Referral Cashback</h2>
    <p className="mt-1 text-xs leading-5 text-black/55">
      Each active member gets a permanent unique code such as PRIMEFAMILY1, PRIMEFAMILY2, etc.
      When another signed-in customer uses that code on a qualifying order,
      the <b>code owner</b> earns a percent of eligible items in their Cash Wallet, only once the order is marked Delivered.
      The buyer does not receive a second tier/promo cashback on that order. Self-referrals and duplicate payment for the same order are blocked.
      Big Deal and Weekly Deal products are excluded.
    </p>
    <div className="mt-4 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900">
      <b>Play Store welcome reward:</b> {report
        ? report.welcomeBonus.enabled ? 'Enabled' : 'Not enabled'
        : 'Checking…'} · Rs. {report?.welcomeBonus.rupees ?? 100}.
      The Rs100 is credited only after eligible verified native-app sign-in and one-device/account checks.
      Downloading alone does not credit cash. Withdrawal requires the published minimum and approval.
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-[#F2FAF7] p-4">
      <label className="flex items-center gap-2 text-xs font-black">
        <input type="checkbox" checked={settings.enabled}
          onChange={e => setSettings(v => ({ ...v, enabled: e.target.checked }))}/>
        Enable referral rewards
      </label>
      <label className="flex items-center gap-2 text-xs font-bold">Referrer cashback %
        <input type="number" min={1} max={20} step={1} className="w-20 rounded-lg border bg-white p-2 text-sm"
          value={settings.percent} onChange={e => setSettings(v => ({ ...v, percent: Number(e.target.value) }))}/>
      </label>
      <button disabled={busy || !Number.isSafeInteger(settings.percent) || settings.percent < 1 || settings.percent > 20}
        onClick={() => void save()} className="rounded-xl bg-[#0F6A5F] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
        {busy ? 'Saving…' : 'Save Referral Settings'}
      </button>
    </div>
    {!report && !message && <p className="mt-3 text-xs">Loading active member codes and payouts…</p>}
    {message && <p className="mt-3 text-xs font-bold text-[#0F6A5F]" role="status">{message}</p>}
    {report && <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-black">Issued member codes</h3>
        <p className="text-[10px] text-black/45">Most recent 75 codes, with exact-code lookup for any earlier member.</p>
        <div className="mt-2 flex gap-2"><input aria-label="Search any issued referral code" value={lookup} onChange={e => setLookup(e.target.value.toUpperCase())} maxLength={20} placeholder="PRIMEFAMILY123" className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2 text-xs"/><button type="button" className="rounded-lg bg-[#0F6A5F] px-3 py-2 text-xs font-black text-white" onClick={() => { const q=lookup.trim(); setFilteredCode(q); void refresh(q).catch(e=>setMessage(e instanceof Error?e.message:'Lookup failed')); }}>Find</button><button type="button" className="rounded-lg border border-black/15 px-3 py-2 text-xs font-black" onClick={() => { setLookup('');setFilteredCode('');void refresh('').catch(e=>setMessage(e instanceof Error?e.message:'Refresh failed')); }}>Reset</button></div>
        <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-black/10">
          {report.codes.map(row => <div key={row.code} className="flex flex-wrap justify-between gap-2 border-b p-3 text-xs">
            <b>{row.code}</b><span className="max-w-[220px] break-words text-black/60">{row.ownerEmail || row.ownerUid.slice(0, 8)}</span>
          </div>)}
          {!report.codes.length && <p className="p-4 text-xs text-black/50">No member has generated a code yet.</p>}
        </div>
        {report.truncated.codes && <p className="mt-1 text-xs">Showing last 75; older codes remain stored.</p>}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-black">Latest credited referral orders</h3>
        <p className="text-[10px] text-black/45">Only verified Delivered order credits are listed. No payment before delivery.</p>
        <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-black/10">
          {report.credits.map(row => <div key={row.orderId} className="border-b p-3 text-xs">
            <div className="flex justify-between gap-2"><b>{row.code}</b><b className="text-[#0F6A5F]">Rs. {row.amount.toLocaleString()}</b></div>
            <p className="mt-1 text-[10px] text-black/50">Order {row.orderId.slice(0, 18)} · {row.percent}% · {row.createdAt.slice(0, 10)}</p>
          </div>)}
          {!report.credits.length && <p className="p-4 text-xs text-black/50">No referral cashback has been credited.</p>}
        </div>
        {report.truncated.credits && <p className="mt-1 text-xs">Showing last 75 credits, not a full financial ledger.</p>}
      </div>
    </div>}
  </section>;
}
