'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, ArrowLeft } from 'lucide-react';

type Status = { type: 'settings'; allowed: boolean; enabled: boolean; supported: boolean };
declare global {
  interface Window {
    PrimeHubNative?: { postMessage(message: string): void; onmessage?: ((event: { data: string }) => void) | null };
  }
}
export default function NotificationSettings() {
  const [state, setState] = useState<Status | null>(null);
  const [native, setNative] = useState(false);
  useEffect(() => {
    const bridge = window.PrimeHubNative;
    if (!bridge) return;
    setNative(true);
    const onMessage = (event: { data: string }) => {
      try {
        const response = JSON.parse(event.data) as Status;
        if (response.type === 'settings') setState(response);
      } catch {}
    };
    bridge.onmessage = onMessage;
    bridge.postMessage(JSON.stringify({ action: 'settings' }));
    const onFocus = () => bridge.postMessage(JSON.stringify({ action: 'settings' }));
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      if (bridge.onmessage === onMessage) bridge.onmessage = null;
    };
  }, []);
  return <main className="mx-auto min-h-[65vh] max-w-lg px-4 py-8">
    <Link href="/account" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={16} /> Back</Link>
    <section className="mt-6 rounded-[26px] border border-black/10 bg-white p-6 shadow-sm">
      <Bell className="mb-4 text-[#0F6A5F]" size={30} />
      <h1 className="text-2xl font-black">Notifications</h1>
      <p className="mt-2 text-sm text-black/60">Daily PrimeHub picks, Big Deals, Weekly Deals and new arrivals. Maximum 4 scheduled messages per day.</p>
      {!native ? <p className="mt-5 text-sm">These settings are available in the PrimeHub Android app.</p> :
        state ? <>
          <label className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-[#F4F4F1] px-4 py-4">
            <span className="text-sm font-bold">Push notifications</span>
            <input type="checkbox" aria-label="Push notifications" checked={state.enabled && state.allowed}
              onChange={(event) => window.PrimeHubNative?.postMessage(JSON.stringify({ action: 'toggle', enabled: event.target.checked }))}
              className="h-5 w-5 accent-[#0F6A5F]" />
          </label>
          {!state.allowed && <p className="mt-3 text-xs text-amber-800">Android has blocked notifications. Turn ON to open your phone's notification settings.</p>}
          {!state.supported && <p className="mt-3 text-xs text-amber-800">Push setup is not yet available on this app build.</p>}
        </> : <p className="mt-5 text-sm">Reading notification settings…</p>}
    </section>
  </main>;
}
