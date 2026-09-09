'use client';

import { useEffect, useState } from 'react';
import { Loader2, Radio, Save } from 'lucide-react';

export default function SalarManager() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/admin/salar/settings', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || 'Unable to load Salar setting.');
        setEnabled(data?.salar_public_enabled === true);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : 'Unable to load Salar setting.'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setStatus('');
    try {
      const response = await fetch('/api/admin/salar/settings', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salar_public_enabled: enabled }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Unable to save Salar setting.');
      setEnabled(data?.salar_public_enabled === true);
      setStatus(`Saved. Salar public is ${data?.salar_public_enabled ? 'ON' : 'OFF'}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save Salar setting.');
    } finally {
      setSaving(false);
    }
  }

  async function pingProvider() {
    setPinging(true);
    setStatus('');
    try {
      const response = await fetch('/api/admin/salar/ping', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok !== true) throw new Error(data?.error || 'Salar ping failed.');
      setStatus(`Ping OK — ${data.provider}, key index ${data.keyIndex}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Salar ping failed.');
    } finally {
      setPinging(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-black/50">Loading Salar settings…</div>;

  return (
    <section className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
      <div className="rounded-3xl border border-black/8 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#E1352B]">Visibility</p><h2 className="mt-1 text-xl font-black">Salar public ON / OFF</h2></div>
          <button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled((value) => !value)} className={`relative h-8 w-14 shrink-0 rounded-full transition ${enabled ? 'bg-[#0F6A5F]' : 'bg-black/15'}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${enabled ? 'left-7' : 'left-1'}`} /></button>
        </div>
        <p className="mt-3 text-xs leading-5 text-black/55">OFF = testing, widget only when admin is logged in on homepage. ON = all visitors. Default OFF.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => void save()} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-[#14140F] px-4 py-3 text-xs font-black text-white disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save Salar setting</button>
          <button type="button" onClick={() => void pingProvider()} disabled={pinging} className="flex items-center justify-center gap-2 rounded-xl bg-[#F4F4F1] px-4 py-3 text-xs font-black text-[#14140F] disabled:opacity-50">{pinging ? <Loader2 size={15} className="animate-spin" /> : <Radio size={15} />}Admin-only provider ping</button>
        </div>
        {status ? <p role="status" className="mt-4 rounded-xl bg-[#F4F4F1] px-3 py-3 text-xs font-semibold text-black/65">{status}</p> : null}
      </div>
    </section>
  );
}
