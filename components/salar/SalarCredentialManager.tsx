'use client';

import { useEffect, useId, useState } from 'react';

type Provider = 'cloudflare' | 'groq' | 'gemini' | 'openrouter';
type Summary = Partial<Record<Provider, { keyCount: number; accountId: string; disabled: boolean }>>;

export default function SalarCredentialManager({ provider, onVerified }: { provider: Provider; onVerified: () => void }) {
  const id = useId();
  const [summary, setSummary] = useState<Summary>({});
  const [keys, setKeys] = useState('');
  const [accountId, setAccountId] = useState('');
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

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    setKeys('');
    setAccountId(summary[provider]?.accountId || '');
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
    <div className="mt-3 border-t border-black/10 pt-3">
      <details open>
        <summary className="cursor-pointer text-xs font-bold">
          API keys · {summary[provider]?.keyCount || 0} saved
        </summary>
        <p className="mt-2 text-[11px] text-black/60">
          Enter up to 9 keys, one per line, in fallback order. Keys are saved from this admin panel and are never displayed again.
        </p>
        <label htmlFor={`${id}-keys`} className="mt-2 block text-xs">API keys</label>
        <textarea
          id={`${id}-keys`}
          value={keys}
          onChange={event => setKeys(event.target.value)}
          rows={3}
          autoComplete="off"
          spellCheck={false}
          disabled={busy || loading}
          placeholder={summary[provider]?.keyCount ? 'Leave blank to keep saved keys' : 'Paste API key(s), one per line'}
          className="mt-1 w-full rounded-lg border p-2 text-xs"
        />
        {provider === 'cloudflare' && (
          <>
            <label htmlFor={`${id}-account`} className="mt-2 block text-xs">Cloudflare account ID</label>
            <input
              id={`${id}-account`}
              value={accountId}
              onChange={event => setAccountId(event.target.value)}
              maxLength={32}
              disabled={busy || loading}
              placeholder="Enter Cloudflare account ID"
              className="mt-1 w-full rounded-lg border p-2 text-xs"
            />
          </>
        )}
        <label className="mt-2 flex gap-2 text-xs">
          <input
            type="checkbox"
            checked={disabled}
            onChange={event => setDisabled(event.target.checked)}
            disabled={busy || loading}
          />
          Disable this provider
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void save(false)}
            className="rounded-lg bg-[#0F6A5F] px-3 py-2 text-xs text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save API keys'}
          </button>
          <button
            type="button"
            disabled={busy || loading || !summary[provider]?.keyCount}
            onClick={() => void save(true)}
            className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
          >
            Remove saved keys
          </button>
        </div>
      </details>
      <p role="status" className="mt-2 text-[11px]">{loading ? 'Loading saved API key settings…' : message}</p>
    </div>
  );
}
