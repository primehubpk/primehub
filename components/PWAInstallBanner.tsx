'use client';

// ==================== PWA INSTALL BANNER ====================
import { useEffect, useState } from 'react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); setHidden(localStorage.getItem('phdeals-install-dismissed') === '1'); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  if (!prompt || hidden) return null;
  return <aside className="fixed bottom-20 left-3 right-3 z-[120] mx-auto max-w-md rounded-2xl bg-[#14140F] p-4 text-white shadow-2xl"><p className="text-xs font-black">Install PrimeHub Deals</p><p className="mt-1 text-[10px] text-white/60">Install the app for faster shopping.</p><div className="mt-3 flex gap-2"><button onClick={async () => { await prompt.prompt(); setHidden(true); }} className="rounded-xl bg-[#FFB020] px-4 py-2 text-[10px] font-black text-[#14140F]">Install App</button><button onClick={() => { localStorage.setItem('phdeals-install-dismissed', '1'); setHidden(true); }} className="px-3 text-[10px] font-bold text-white/70">Not now</button></div></aside>;
}
