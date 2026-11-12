'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminDocument, setAdminDocument } from '../shared';
import { DEFAULT_BOGO_SETTINGS, resolveBogoSettings, type BogoSettings } from '@/lib/bogoOffers';

export default function BogoDealSettings() {
  const [config, setConfig] = useState<BogoSettings>(DEFAULT_BOGO_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { let cancelled = false;
    getAdminDocument('settings', 'main').then(snapshot => {
      if (!cancelled) setConfig(resolveBogoSettings(snapshot.exists() ? snapshot.data().bogoDealShowcase : undefined));
    }).catch(() => { if (!cancelled) setNotice('Unable to load BOGO settings. Please refresh.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  async function save() {
    if (loading || saving) return;
    setSaving(true); setNotice('');
    try {
      const clean = resolveBogoSettings(config);
      if (!clean.autoRenew && clean.enabled && !(Date.parse(clean.endsAt) > Date.now())) throw new Error('Choose a future end time or enable daily renewal.');
      await setAdminDocument('settings', 'main', { bogoDealShowcase: clean });
      setConfig(clean); setNotice('BOGO schedule saved. Product prices and stock are managed in Products.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Saving failed.'); }
    finally { setSaving(false); }
  }
  return <section className="my-6 rounded-2xl border border-[#d7c28e] bg-white p-5">
    <h2 className="text-xl font-black text-[#0d5946]">Buy 1 Get 1 Free · Daily Flash Offers</h2>
    <p className="mt-2 text-xs leading-5 text-black/60">One offer pack = one paid pack + one identical free pack, same design and size. Stock is measured in offer packs. The daily timer renews at midnight Pakistan time; stock never resets automatically.</p>
    <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={config.enabled} onChange={event => setConfig({...config, enabled:event.target.checked})}/>Enable offers</label>
    <label className="mt-4 grid gap-1 text-xs font-bold">Banner heading<input className="rounded-xl border p-3" maxLength={80} value={config.heading} onChange={event => setConfig({...config,heading:event.target.value})}/></label>
    <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={config.autoRenew} onChange={event => setConfig({...config, autoRenew:event.target.checked})}/>Renew every day at midnight PKT</label>
    {!config.autoRenew ? <label className="mt-3 grid gap-1 text-xs font-bold">End time (ISO 8601, include timezone)<input className="rounded-xl border p-3" placeholder="2026-11-30T23:59:00+05:00" value={config.endsAt} onChange={event => setConfig({...config,endsAt:event.target.value})}/></label> : null}
    <p className="mt-4 text-xs text-black/50">Default for new imported listings: 30 offer packs. Zero stock stays sold out. Five paid offer packs qualify for the existing free-delivery rule; free bonus packs do not count twice. BOGO does not stack with cashback or voucher discounts.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button disabled={loading || saving} onClick={() => void save()} className="rounded-full bg-[#0d5946] px-5 py-3 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : loading ? 'Loading…' : 'Save BOGO schedule'}</button><Link className="rounded-full bg-black/5 px-4 py-3 text-xs font-bold" href="/admin/products">Edit product prices / variants / stock</Link><Link className="rounded-full bg-black/5 px-4 py-3 text-xs font-bold" href="/deals/bogo">Preview collection</Link></div>
    {notice ? <p className="mt-3 text-xs" role="status">{notice}</p> : null}
  </section>;
}
