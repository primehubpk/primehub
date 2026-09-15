'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Database, RefreshCw, Save } from 'lucide-react';

type SalarAdminView = {
  enabled: boolean;
  instructions: string;
  updatedAt: string | null;
  catalogue: null | {
    updatedAt: string;
    source: string;
    productCount: number;
    categoryCount: number;
    pageCount: number;
  };
  runtime: {
    groqConfigured: boolean;
    model: string;
  };
};

export default function SalarControlPanel() {
  const [data, setData] = useState<SalarAdminView | null>(null);
  const [instructions, setInstructions] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/salar', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Salar could not load.');
      setData(result.salar);
      setInstructions(result.salar.instructions || '');
      setEnabled(result.salar.enabled !== false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Salar could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/salar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ enabled, instructions }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not save Salar instructions.');
      setData(result.salar);
      setMessage('Salar instructions saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save Salar instructions.');
    } finally {
      setSaving(false);
    }
  }

  async function refreshCatalogue() {
    setRefreshing(true);
    setMessage('Reading live website data and rebuilding Salar catalogue…');
    try {
      const response = await fetch('/api/admin/salar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ action: 'refresh-catalogue' }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Catalogue update failed.');
      setData(result.salar);
      setInstructions(result.salar.instructions || instructions);
      setEnabled(result.salar.enabled !== false);
      setMessage('Catalogue updated from live PrimeHubMall data.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Catalogue update failed.');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><div className="rounded-3xl bg-white p-6 text-sm font-bold text-black/45 shadow-sm">Loading Salar…</div></section>;
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[#E1352B]"><Bot size={18}/><span className="text-[10px] font-black uppercase tracking-[0.16em]">Salar</span></div>
          <p className="mt-3 text-sm font-black">{enabled ? 'Salesman ON' : 'Salesman OFF'}</p>
          <p className="mt-1 text-[10px] leading-4 text-black/45">Groq: {data?.runtime.groqConfigured ? 'Configured' : 'API key missing'} · {data?.runtime.model || 'No model'}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[#0F6A5F]"><Database size={18}/><span className="text-[10px] font-black uppercase tracking-[0.16em]">Cached Catalogue</span></div>
          <p className="mt-3 text-sm font-black">{data?.catalogue ? `${data.catalogue.productCount} products` : 'Not built yet'}</p>
          <p className="mt-1 text-[10px] leading-4 text-black/45">{data?.catalogue ? `${data.catalogue.categoryCount} categories · ${data.catalogue.pageCount} website pages · ${data.catalogue.source}` : 'Press Update Catalogue to read live data first.'}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-black/35">Last catalogue update</p>
          <p className="mt-3 text-xs font-black">{data?.catalogue?.updatedAt ? new Date(data.catalogue.updatedAt).toLocaleString() : 'Never'}</p>
          <button onClick={() => void refreshCatalogue()} disabled={refreshing} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#0F6A5F] px-4 py-2.5 text-[10px] font-black text-white disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''}/>{refreshing ? 'Updating…' : 'Update Catalogue'}
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#E1352B]">Salar Instructions</p>
            <h2 className="mt-1 text-lg font-black">Your dealing instructions</h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-black/45">Write only the special rules you want Salar to follow. If a customer question is not covered here, Salar will use its own intelligence while using the cached website data for PrimeHubMall facts.</p>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-[#F4F4F1] px-3 py-2 text-[10px] font-black">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4"/>
            Salar enabled
          </label>
        </div>

        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value.slice(0, 20000))}
          rows={14}
          placeholder={'Example: Wholesale customer se politely quantity pocho.\n\nApni special dealing instructions yahan likhein…'}
          className="mt-5 w-full resize-y rounded-2xl border border-black/10 bg-[#FAFAF7] p-4 text-sm leading-6 outline-none transition focus:border-[#0F6A5F]/50"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10px] text-black/35">{instructions.length.toLocaleString()} / 20,000 characters</span>
          <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#14140F] px-5 py-3 text-[11px] font-black text-white disabled:opacity-50">
            <Save size={14}/>{saving ? 'Saving…' : 'Save Instructions'}
          </button>
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-black/8 bg-white px-4 py-3 text-xs font-bold text-black/60 shadow-sm">{message}</div> : null}
    </section>
  );
}
