'use client';

import { useEffect, useState } from 'react';

type Settings = {
  pixelId: string;
  enabled: boolean;
  tokenConfigured: boolean;
  testEventCode: string;
};

const initial: Settings = {
  pixelId: 'DANU2LRC77U5PB600R4G',
  enabled: false,
  tokenConfigured: false,
  testEventCode: '',
};

export default function TikTokEventsManager() {
  const [settings, setSettings] = useState<Settings>(initial);
  const [accessToken, setAccessToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/tiktok', { cache: 'no-store', credentials: 'same-origin' });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'TikTok settings could not load.');
      setSettings(result.settings);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'TikTok settings could not load.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save(removeToken = false) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/tiktok', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          pixelId: settings.pixelId,
          enabled: settings.enabled,
          testEventCode: settings.testEventCode,
          removeToken,
          ...(accessToken.trim() ? { accessToken: accessToken.trim() } : {}),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'TikTok settings could not save.');
      setSettings(result.settings);
      setAccessToken('');
      setMessage(removeToken
        ? 'TikTok Events API access token removed.'
        : 'TikTok Events API settings saved securely.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'TikTok settings could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage('');
    try {
      if (accessToken.trim()) {
        const saveResponse = await fetch('/api/admin/tiktok', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            pixelId: settings.pixelId,
            enabled: true,
            testEventCode: settings.testEventCode,
            accessToken: accessToken.trim(),
          }),
        });
        const saved = await saveResponse.json().catch(() => null);
        if (!saveResponse.ok || !saved?.success) throw new Error(saved?.error || 'Save the TikTok token first.');
        setSettings(saved.settings);
        setAccessToken('');
      }

      const response = await fetch('/api/admin/tiktok', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', testEventCode: settings.testEventCode }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'TikTok test event failed.');
      setMessage('Test server event sent. Check TikTok Events Manager → Test events.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'TikTok test event failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">TikTok tracking</p>
        <h2 className="mt-1 text-xl font-black">Pixel + Events API</h2>
        <p className="mt-2 text-xs leading-5 text-black/55">
          Browser Pixel is already installed. Paste the Events API access token here; it is stored server-side and is never displayed again.
        </p>

        <label className="mt-5 block text-xs font-bold">Pixel ID</label>
        <input
          value={settings.pixelId}
          onChange={(event) => setSettings(current => ({ ...current, pixelId: event.target.value }))}
          disabled={busy}
          className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-xs"
        />

        <label className="mt-4 block text-xs font-bold">Events API access token</label>
        <textarea
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          disabled={busy}
          rows={3}
          spellCheck={false}
          autoComplete="off"
          placeholder={settings.tokenConfigured ? 'Token already saved — leave blank to keep it' : 'Paste token generated in TikTok Events Manager'}
          className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-xs"
        />

        <label className="mt-4 block text-xs font-bold">Test Event Code</label>
        <input
          value={settings.testEventCode}
          onChange={(event) => setSettings(current => ({ ...current, testEventCode: event.target.value }))}
          disabled={busy}
          placeholder="Example: TEST12345"
          className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-xs"
        />
        <p className="mt-1 text-[10px] leading-4 text-black/45">
          Use this only while testing in TikTok. Clear it and save again before running live campaigns.
        </p>

        <label className="mt-4 flex items-center gap-2 text-xs font-bold">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => setSettings(current => ({ ...current, enabled: event.target.checked }))}
            disabled={busy}
          />
          Enable server-side Events API
        </label>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={busy}
            className="rounded-full bg-[#0F6A5F] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
          >
            {busy ? 'Please wait…' : 'Save TikTok settings'}
          </button>
          <button
            type="button"
            onClick={() => void test()}
            disabled={busy || !settings.testEventCode}
            className="rounded-full bg-[#14140F] px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"
          >
            Send test event
          </button>
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={busy || !settings.tokenConfigured}
            className="rounded-full border border-black/10 px-4 py-2.5 text-xs font-black disabled:opacity-40"
          >
            Remove access token
          </button>
        </div>

        <p className="mt-4 text-[11px] font-bold text-black/65">
          {settings.tokenConfigured ? 'Access token: saved securely' : 'Access token: not saved yet'}
        </p>
        <p role="status" className="mt-2 text-[11px] leading-4 text-black/60">{message}</p>
      </div>
    </section>
  );
}
