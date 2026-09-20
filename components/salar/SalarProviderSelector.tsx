'use client';

import SalarCredentialManager from './SalarCredentialManager';
import { useEffect, useId, useState } from 'react';

type Provider = 'cloudflare' | 'groq' | 'gemini' | 'openrouter';
type Selection = { preferredProvider: Provider; models: Partial<Record<Provider, string>> };
type Status = { provider: Provider; configured: boolean; model: string };
const labels: Record<Provider, string> = { cloudflare: 'Cloudflare', groq: 'Groq', gemini: 'Gemini', openrouter: 'OpenRouter' };

export default function SalarProviderSelector() {
  const id = useId();
  const [selection, setSelection] = useState<Selection>({ preferredProvider: 'cloudflare', models: {} });
  const [providers, setProviders] = useState<Status[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/salar', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error('Verify admin with Google below to load AI settings.');
        setSelection(result.salar.providerSelection);
        setProviders(result.salar.runtime.providers);
      }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [revision]);

  async function apply(test: boolean) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/salar', {
        method: test ? 'POST' : 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test ? { action: 'test-provider', providerSelection: selection } : { providerSelection: selection }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Could not update AI settings.');
      if (test) setMessage(`${labels[result.test.provider as Provider]} · ${result.test.model} · ${(result.test.elapsedMs / 1000).toFixed(2)}s · ${result.test.ok ? 'Test passed' : result.test.error}`);
      else { setSelection(result.salar.providerSelection); setProviders(result.salar.runtime.providers); setMessage('Saved. New messages use this provider first, with automatic fallback.'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed.'); }
    finally { setBusy(false); }
  }

  const provider = selection.preferredProvider;
  return <section className="rounded-2xl border border-black/10 bg-white p-3 text-[#14140F]">
    <SalarCredentialManager provider={provider} onVerified={() => setRevision(value => value + 1)} />
    <label htmlFor={`${id}-provider`} className="block text-xs font-bold">Salar AI provider</label>
    <select id={`${id}-provider`} value={provider} disabled={busy} onChange={event => setSelection(current => ({ ...current, preferredProvider: event.target.value as Provider }))} className="mt-2 w-full rounded-lg border p-2 text-xs">
      {(Object.keys(labels) as Provider[]).map(value => <option key={value} value={value}>{labels[value]}{providers.find(item => item.provider === value)?.configured ? '' : ' (not configured)'}</option>)}
    </select>
    <label htmlFor={`${id}-model`} className="mt-3 block text-xs font-bold">Text model</label>
    <input id={`${id}-model`} value={selection.models[provider] || ''} maxLength={200} disabled={busy} placeholder={providers.find(item => item.provider === provider)?.model || 'Enter provider model ID'} onChange={event => setSelection(current => ({ ...current, models: { ...current.models, [provider]: event.target.value } }))} className="mt-1 w-full rounded-lg border p-2 text-xs"/>
    <p className="mt-2 text-[10px] text-black/55">Leave blank for the configured default. Image messages use the configured vision model. Selection applies to all new customer messages.</p>
    <div className="mt-3 flex gap-2">
      <button type="button" disabled={busy} onClick={() => void apply(false)} className="rounded-full bg-[#0F6A5F] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save selection</button>
      <button type="button" disabled={busy} onClick={() => void apply(true)} className="rounded-full bg-[#F1F1ED] px-3 py-2 text-xs font-bold disabled:opacity-50">{busy ? 'Please wait…' : 'Test connection'}</button>
    </div>
    <p role="status" className="mt-2 break-words text-[11px]">{message}</p>
  </section>;
}
