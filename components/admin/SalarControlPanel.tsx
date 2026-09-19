'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Database, ImagePlus, Maximize2, RefreshCw, Save, Trash2, X } from 'lucide-react';

type ProviderStatus = {
  provider: 'groq' | 'gemini' | 'openrouter';
  configured: boolean;
  model: string;
  visionConfigured: boolean;
  visionModel: string;
};

type SalarAdminView = {
  enabled: boolean;
  instructions: string;
  orderInstructions: string;
  updatedAt: string | null;
  catalogue: null | {
    updatedAt: string;
    source: string;
    productCount: number;
    categoryCount: number;
    pageCount: number;
  };
  runtime: {
    ready: boolean;
    providers: ProviderStatus[];
  };
};

const INSTRUCTION_LIMIT = 20000;

function providerLabel(value: ProviderStatus['provider']) {
  if (value === 'openrouter') return 'OpenRouter';
  if (value === 'gemini') return 'Gemini';
  return 'Groq';
}

export default function SalarControlPanel() {
  const [data, setData] = useState<SalarAdminView | null>(null);
  const [instructions, setInstructions] = useState('');
  const [orderInstructions, setOrderInstructions] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [iconUrl, setIconUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEnabled, setSavingEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [editorSection, setEditorSection] = useState<'core' | 'order' | null>(null);
  const [message, setMessage] = useState('');
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');

    void fetch('/api/admin/salar/ui', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => ({ response, result: await response.json().catch(() => null) }))
      .then(({ response, result }) => {
        if (response.ok && result?.success) setIconUrl(String(result.ui?.iconUrl || ''));
      })
      .catch(() => undefined);

    try {
      const salarResponse = await fetch('/api/admin/salar', { credentials: 'same-origin', cache: 'no-store' });
      const salarResult = await salarResponse.json().catch(() => null);
      if (!salarResponse.ok || !salarResult?.success) throw new Error(salarResult?.error || 'Salar could not load.');
      setData(salarResult.salar);
      setInstructions(salarResult.salar.instructions || '');
      setOrderInstructions(salarResult.salar.orderInstructions || '');
      setEnabled(salarResult.salar.enabled !== false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Salar could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(closeEditor = false) {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/salar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ enabled, instructions, orderInstructions }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not save Salar instructions.');
      setData(result.salar);
      setMessage('Salar instructions saved.');
      if (closeEditor) setEditorSection(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save Salar instructions.');
    } finally {
      setSaving(false);
    }
  }

  async function saveEnabled(nextEnabled: boolean) {
    const previousEnabled = enabled;
    setEnabled(nextEnabled);
    setSavingEnabled(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/salar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not update Salar status.');
      const savedEnabled = result.salar?.enabled !== false;
      setData(result.salar);
      setEnabled(savedEnabled);
      setMessage(savedEnabled ? 'Salar is now ON on the storefront.' : 'Salar is now OFF on the storefront.');
    } catch (error) {
      setEnabled(previousEnabled);
      setMessage(error instanceof Error ? error.message : 'Could not update Salar status.');
    } finally {
      setSavingEnabled(false);
    }
  }

  async function saveIcon(nextIconUrl: string) {
    const response = await fetch('/api/admin/salar/ui', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ iconUrl: nextIconUrl }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not save Salar icon.');
    setIconUrl(String(result.ui?.iconUrl || ''));
  }

  async function chooseIcon(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Please choose an image from gallery.');
      return;
    }
    setUploadingIcon(true);
    setMessage('Uploading Salar icon…');
    try {
      const form = new FormData();
      form.append('image', file, file.name || 'salar-icon.jpg');
      const uploadResponse = await fetch('/api/upload/r2', { method: 'POST', credentials: 'same-origin', body: form });
      const uploadResult = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !uploadResult?.success || !uploadResult?.url) throw new Error(uploadResult?.error || 'Image upload failed.');
      await saveIcon(String(uploadResult.url));
      setMessage('Salar chat icon updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Salar icon could not be updated.');
    } finally {
      setUploadingIcon(false);
      if (iconInputRef.current) iconInputRef.current.value = '';
    }
  }

  async function removeIcon() {
    setUploadingIcon(true);
    setMessage('');
    try {
      await saveIcon('');
      setMessage('Custom Salar icon removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Salar icon could not be removed.');
    } finally {
      setUploadingIcon(false);
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
      setOrderInstructions(result.salar.orderInstructions || orderInstructions);
      setEnabled(result.salar.enabled !== false);
      setMessage('Catalogue updated from live PrimeHubMall data.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Catalogue update failed.');
    } finally {
      setRefreshing(false);
    }
  }

  function selectAllInstructions() {
    const textarea = editorRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.select();
  }

  if (loading) {
    return <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><div className="rounded-3xl bg-white p-6 text-sm font-bold text-black/45 shadow-sm">Loading Salar…</div></section>;
  }

  return (
    <section className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[#E1352B]"><Bot size={18}/><span className="text-[10px] font-black uppercase tracking-[0.16em]">Salar</span></div>
          <p className="mt-3 text-sm font-black">{enabled ? 'Salesman ON' : 'Salesman OFF'} · {data?.runtime.ready ? 'AI Ready' : 'AI not ready'}</p>
          <div className="mt-2 space-y-1.5">
            {(data?.runtime.providers || []).map((provider) => (
              <div key={provider.provider} className="rounded-xl bg-[#F7F7F3] px-2.5 py-2 text-[9px] leading-4 text-black/55">
                <b className="text-[#14140F]">{providerLabel(provider.provider)}</b>: {provider.configured ? 'Configured' : 'Not configured'}
                {provider.model ? ` · ${provider.model}` : ''}
                {provider.visionConfigured ? ' · Vision ready' : ''}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] leading-4 text-black/35">Uses the existing Vercel environment only. API keys are never shown here.</p>
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
            <h2 className="mt-1 text-lg font-black">Your salesman training</h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-black/45">Keep core sales behaviour separate from the order/payment flow. Both sections are combined for Salar at runtime; nothing is hardcoded into customer replies.</p>
          </div>
          <button
            type="button"
            onClick={() => void saveEnabled(!enabled)}
            disabled={savingEnabled}
            aria-pressed={enabled}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black transition disabled:opacity-50 ${enabled ? 'bg-[#0F6A5F] text-white' : 'bg-[#F1F1ED] text-black/55'}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${enabled ? 'bg-white' : 'bg-black/25'}`}/>
            {savingEnabled ? 'Saving…' : enabled ? 'Salar ON' : 'Salar OFF'}
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-black/8 bg-[#FAFAF7] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black">1. Core Sales Instructions</p>
              <p className="mt-1 text-[9px] leading-4 text-black/40">Identity, tone, product discovery, size, colour, retail/wholesale, product continuity, images and general behaviour.</p>
            </div>
            <button type="button" onClick={() => setEditorSection('core')} className="inline-flex items-center gap-2 rounded-full bg-[#0F6A5F] px-3 py-2 text-[9px] font-black text-white"><Maximize2 size={12}/>Open full editor</button>
          </div>
          <textarea value={instructions} onChange={(event) => setInstructions(event.target.value.slice(0, INSTRUCTION_LIMIT))} rows={10} className="mt-3 w-full resize-y rounded-2xl border border-black/10 bg-white p-4 text-sm leading-6 outline-none transition focus:border-[#0F6A5F]/50"/>
          <p className="mt-2 text-right text-[9px] text-black/35">{instructions.length.toLocaleString()} / {INSTRUCTION_LIMIT.toLocaleString()} characters</p>
        </div>

        <div className="mt-4 rounded-2xl border border-[#E9C677]/50 bg-[#FFF9EC] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black">2. Order & Payment Flow</p>
              <p className="mt-1 text-[9px] leading-4 text-black/40">Put the step-by-step bill → confirmation → customer details → advance → payment proof → final order → WhatsApp flow here.</p>
            </div>
            <button type="button" onClick={() => setEditorSection('order')} className="inline-flex items-center gap-2 rounded-full bg-[#14140F] px-3 py-2 text-[9px] font-black text-white"><Maximize2 size={12}/>Open full editor</button>
          </div>
          <textarea value={orderInstructions} onChange={(event) => setOrderInstructions(event.target.value.slice(0, INSTRUCTION_LIMIT))} rows={10} className="mt-3 w-full resize-y rounded-2xl border border-black/10 bg-white p-4 text-sm leading-6 outline-none transition focus:border-[#E9C677]"/>
          <p className="mt-2 text-right text-[9px] text-black/35">{orderInstructions.length.toLocaleString()} / {INSTRUCTION_LIMIT.toLocaleString()} characters</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10px] text-black/35">Saved together in Salar settings; existing Core instructions stay compatible.</span>
          <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#14140F] px-5 py-3 text-[11px] font-black text-white disabled:opacity-50"><Save size={14}/>{saving ? 'Saving…' : 'Save Both Sections'}</button>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F6A5F]">Chat Launcher</p>
        <h3 className="mt-1 text-base font-black">Salar icon</h3>
        <p className="mt-1 text-[10px] leading-4 text-black/45">Choose an image from your phone gallery. It will appear on the website Salar chat icon.</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#FFB020] text-[#14140F] shadow-sm">
            {iconUrl ? <img src={iconUrl} alt="Salar icon" className="h-full w-full object-cover"/> : <Bot size={26}/>}
          </div>
          <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void chooseIcon(event.target.files?.[0])}/>
          <button type="button" disabled={uploadingIcon} onClick={() => iconInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-[#14140F] px-4 py-3 text-[10px] font-black text-white disabled:opacity-50"><ImagePlus size={14}/>{uploadingIcon ? 'Uploading…' : 'Choose from gallery'}</button>
          {iconUrl ? <button type="button" disabled={uploadingIcon} onClick={() => void removeIcon()} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F1] text-[#E1352B] disabled:opacity-40" aria-label="Remove custom icon"><Trash2 size={15}/></button> : null}
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-black/8 bg-white px-4 py-3 text-xs font-bold text-black/60 shadow-sm">{message}</div> : null}

      {editorSection ? (
        <div className="fixed inset-0 z-[120] flex flex-col bg-[#F7F7F3]">
          <div className="flex shrink-0 items-center justify-between border-b border-black/8 bg-white px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#E1352B]">Salar Instructions</p>
              <p className="text-sm font-black">{editorSection === 'core' ? 'Core Sales Instructions' : 'Order & Payment Flow'}</p>
            </div>
            <button type="button" onClick={() => setEditorSection(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F4F1]" aria-label="Close full editor"><X size={17}/></button>
          </div>
          <div className="flex-1 p-3 sm:p-5">
            <textarea
              ref={editorRef}
              autoFocus
              value={editorSection === 'core' ? instructions : orderInstructions}
              onChange={(event) => editorSection === 'core'
                ? setInstructions(event.target.value.slice(0, INSTRUCTION_LIMIT))
                : setOrderInstructions(event.target.value.slice(0, INSTRUCTION_LIMIT))}
              className="h-full min-h-[50vh] w-full resize-none rounded-2xl border border-black/10 bg-white p-4 text-sm leading-6 outline-none focus:border-[#0F6A5F]/50"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 border-t border-black/8 bg-white p-3 sm:px-5">
            <button type="button" onClick={selectAllInstructions} className="rounded-full bg-[#F1F1ED] px-4 py-3 text-[10px] font-black">Select all</button>
            <span className="ml-auto text-[9px] text-black/35">{(editorSection === 'core' ? instructions.length : orderInstructions.length).toLocaleString()} / {INSTRUCTION_LIMIT.toLocaleString()}</span>
            <button type="button" disabled={saving} onClick={() => void save(true)} className="inline-flex items-center gap-2 rounded-full bg-[#14140F] px-5 py-3 text-[10px] font-black text-white disabled:opacity-50"><Save size={14}/>{saving ? 'Saving…' : 'Save Both'}</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
