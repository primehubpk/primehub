'use client';
import { useEffect, useId, useState } from 'react';

type Provider = 'cloudflare' | 'groq' | 'gemini' | 'openrouter';
type Summary = Partial<Record<Provider, { keyCount: number; accountId: string; disabled: boolean }>>;

export default function SalarCredentialManager({ provider, onVerified }: { provider: Provider; onVerified: () => void }) {
  const id = useId();
  const [verified, setVerified] = useState(false);
  const [summary, setSummary] = useState<Summary>({});
  const [keys, setKeys] = useState('');
  const [accountId, setAccountId] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/admin/salar/credentials', { cache: 'no-store' }).then(async response => {
      const result = await response.json();
      if (active && response.ok && result.success) { setVerified(true); setSummary(result.providers); }
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => { setKeys(''); setAccountId(summary[provider]?.accountId || ''); setDisabled(summary[provider]?.disabled || false); setMessage(''); }, [provider, summary]);
  async function verify() {
    setBusy(true); setMessage('');
    try {
      const [{ auth }, { GoogleAuthProvider, signInWithPopup }] = await Promise.all([import('@/lib/firebase'), import('firebase/auth')]);
      const google = new GoogleAuthProvider(); google.setCustomParameters({ prompt: 'select_account' });
      const login = await signInWithPopup(auth, google);
      const response = await fetch('/api/admin/salar/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify-admin', idToken: await login.user.getIdToken(true) }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Admin verification failed.');
      setVerified(true); onVerified();
      const saved = await fetch('/api/admin/salar/credentials', { cache: 'no-store' });
      if (saved.ok) setSummary((await saved.json()).providers);
      setMessage('Admin verified. You can now save keys and AI settings.');
    } catch { setMessage('Google verification failed. Use the authorized admin account; this site domain must be enabled in Firebase Authentication.'); }
    finally { setBusy(false); }
  }
  async function save(reset: boolean) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/salar/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', provider, reset, disabled, ...(provider === 'cloudflare' ? { accountId } : {}), ...(keys.trim() ? { keys: keys.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean) } : {}) }) });
      const result = await response.json();
      if (!response.ok || !result.success) { if (response.status === 401) setVerified(false); throw new Error(result.error || 'Save failed.'); }
      setSummary(result.providers); setKeys(''); onVerified();
      setMessage(reset ? 'Saved keys removed. Vercel environment settings are active.' : 'Saved securely. New requests use these keys in order.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 border-t border-black/10 pt-3">
    {!verified ? <><p className="text-[11px] text-black/60">Verify your admin Google account to change AI settings or API keys.</p><button type="button" disabled={busy} onClick={() => void verify()} className="mt-2 rounded-lg bg-black px-3 py-2 text-xs text-white">{busy ? 'Verifying…' : 'Verify admin with Google'}</button></> : <details>
      <summary className="cursor-pointer text-xs font-bold">API keys · {summary[provider]?.keyCount || 0} saved</summary>
      <p className="mt-2 text-[11px] text-black/60">Enter up to 9 keys, one per line, in fallback order. Saving replaces this provider’s saved list. Leave blank to keep it. Saved keys are never displayed.</p>
      <label htmlFor={`${id}-keys`} className="mt-2 block text-xs">New API keys</label>
      <textarea id={`${id}-keys`} value={keys} onChange={event => setKeys(event.target.value)} rows={3} autoComplete="off" spellCheck={false} disabled={busy} className="mt-1 w-full rounded-lg border p-2 text-xs" />
      {provider === 'cloudflare' && <><label htmlFor={`${id}-account`} className="mt-2 block text-xs">Cloudflare account ID</label><input id={`${id}-account`} value={accountId} onChange={event => setAccountId(event.target.value)} maxLength={32} disabled={busy} placeholder="Leave blank to use Vercel account ID" className="mt-1 w-full rounded-lg border p-2 text-xs" /></>}
      <label className="mt-2 flex gap-2 text-xs"><input type="checkbox" checked={disabled} onChange={event => setDisabled(event.target.checked)} disabled={busy} />Disable this provider, including Vercel keys</label>
      <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void save(false)} className="rounded-lg bg-[#0F6A5F] px-3 py-2 text-xs text-white">Save API keys</button><button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-lg border px-3 py-2 text-xs">Remove saved keys / use Vercel</button></div>
    </details>}
    <p role="status" className="mt-2 text-[11px]">{message}</p>
  </div>;
}
