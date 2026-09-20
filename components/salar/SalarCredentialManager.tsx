'use client';

import { useEffect, useId, useState } from 'react';

type Provider = 'cloudflare' | 'groq' | 'gemini' | 'openrouter' | 'custom';
type Summary = Partial<Record<Provider, {
  keyCount: number;
  accountId: string;
  disabled: boolean;
  baseUrl: string;
  label: string;
}>>;

export default function SalarCredentialManager({ provider, onVerified }: { provider: Provider; onVerified: () => void }) {
  const id = useId();
  const [summary, setSummary] = useState<Summary>({});
  const [keys, setKeys] = useState('');
  const [accountId, setAccountId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [label, setLabel] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadSummary() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/salar/credentials', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'API key settings could not load.');
      }
      setSummary(result.providers || {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'API key settings could not load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadSummary(); }, []);

  useEffect(() => {
    setKeys('');
    setAccountId(summary[provider]?.accountId || '');
    setBaseUrl(summary[provider]?.baseUrl || '');
    setLabel(summary[provider]?.label || '');
    setDisabled(summary[provider]?.disabled || false);
  }, [provider, summary]);

  async function save(reset: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/salar/credentials', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          provider,
          reset,
          disabled,
          ...(provider === 'cloudflare' ? { accountId } : {}),
          ...(provider === 'custom' ? { baseUrl, label } : {}),
          ...(keys.trim()
            ? { keys: keys.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean) }
            : {}),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Save failed.');
      }

      setSummary(result.providers || {});
      setKeys('');
      onVerified();
      setMessage(
        reset
          ? 'Saved API keys removed. Add keys again before using this provider.'
          : 'Saved securely. New Salar requests use these admin-panel keys in order.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-black/8 bg-[#FAFAF8] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black">API connection</p>
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-black/50">
          {summary[provider]?.keyCount || 0} key{summary[provider]?.keyCount === 1 ? '' : 's'} saved
        </span>
      </div>

      {provider === 'custom' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold">Provider name</span>
            <input
              value={label}
              onChange={event => setLabel(event.target.value)}
              disabled={busy || loading}
              placeholder="Example: Together AI"
              className="mt-1 w-full rounded-lg border bg-white p-2 text-xs"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold">OpenAI-compatible Base URL</span>
            <input
              value={baseUrl}
              onChange={event => setBaseUrl(event.target.value)}
              disabled={busy || loading}
              placeholder="https://api.provider.com/v1"
              className="mt-1 w-full rounded-lg border bg-white p-2 text-xs"
            />
          </label>
        </div>
      )}

      {provider === 'cloudflare' && (
        <label htmlFor={`${id}-account`} className="mt-3 block">
          <span className="text-xs font-bold">Cloudflare account ID</span>
          <input
            id={`${id}-account`}
            value={accountId}
            onChange={event => setAccountId(event.target.value)}
            maxLength={32}
            disabled={busy || loading}
            placeholder="Enter Cloudflare account ID"
            className="mt-1 w-full rounded-lg border bg-white p-2 text-xs"
          />
        </label>
      )}

      <label htmlFor={`${id}-keys`} className="mt-3 block">
        <span className="text-xs font-bold">API keys</span>
        <textarea
          id={`${id}-keys`}
          value={keys}
          onChange={event => setKeys(event.target.value)}
          rows={3}
          autoComplete="off"
          spellCheck={false}
          disabled={busy || loading}
          placeholder={summary[provider]?.keyCount ? 'Leave blank to keep saved keys' : 'Paste up to 9 API keys, one per line'}
          className="mt-1 w-full rounded-lg border bg-white p-2 text-xs"
        />
      </label>

      <p className="mt-1 text-[10px] leading-4 text-black/50">
        Keys are stored server-side and are never displayed again. Fallback follows the order you enter them.
      </p>

      <label className="mt-3 flex gap-2 text-xs">
        <input
          type="checkbox"
          checked={disabled}
          onChange={event => setDisabled(event.target.checked)}
          disabled={busy || loading}
        />
        Disable this provider
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void save(false)}
          className="rounded-lg bg-[#0F6A5F] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save API connection'}
        </button>
        <button
          type="button"
          disabled={busy || loading || !summary[provider]?.keyCount}
          onClick={() => void save(true)}
          className="rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-50"
        >
          Remove saved keys
        </button>
      </div>

      <p role="status" className="mt-2 text-[11px]">
        {loading ? 'Loading saved API settings…' : message}
      </p>
    </div>
  );
}
