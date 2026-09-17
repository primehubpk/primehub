'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

export default function AdminQuickAccess() {
  const pathname = usePathname();
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/session', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const data = await response.json().catch(() => null);
      const active = response.ok && data?.authenticated === true;
      setAuthenticated(active);
      if (active) router.prefetch('/admin');
    } catch {
      setAuthenticated(false);
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    void checkSession();
  }, [pathname, checkSession]);

  useEffect(() => {
    const handleFocus = () => void checkSession();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkSession();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkSession]);

  if (checking || !authenticated || pathname.startsWith('/admin')) return null;

  return (
    <button
      type="button"
      onClick={() => router.push('/admin')}
      onPointerEnter={() => router.prefetch('/admin')}
      onFocus={() => router.prefetch('/admin')}
      aria-label="Open admin panel"
      title="Open Admin Panel"
      className="group fixed bottom-[calc(72px+env(safe-area-inset-bottom)+14px)] left-3 z-[60] flex h-12 w-12 touch-manipulation items-center justify-center rounded-full border border-white/20 bg-[#14140F] text-white shadow-[0_12px_36px_rgba(0,0,0,.28)] transition active:scale-95 sm:left-5 sm:h-13 sm:w-auto sm:min-w-13 sm:gap-2 sm:px-4"
    >
      <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
        <ShieldCheck size={17} strokeWidth={2.2} />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#14140F] bg-[#25D366]" aria-hidden="true" />
      </span>
      <span className="hidden text-[10px] font-black uppercase tracking-[0.14em] sm:inline">Admin</span>
    </button>
  );
}
