'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';

type Props = { children: React.ReactNode };

export default function AdminAuthGuard({ children }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/session', { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => response.json().catch(() => null))
      .then((data) => {
        if (!active) return;
        setAuthenticated(data?.authenticated === true);
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.authenticated !== true) {
        throw new Error(String(data?.error || 'Admin login failed.'));
      }

      setAuthenticated(true);
      setPassword('');
      router.replace('/admin');
      router.refresh();
    } catch (loginError) {
      setAuthenticated(false);
      setError(loginError instanceof Error ? loginError.message : 'Admin login failed.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/admin/session', { method: 'DELETE', cache: 'no-store', credentials: 'same-origin' }).catch(() => undefined);
    } finally {
      setAuthenticated(false);
      setPassword('');
      setBusy(false);
      router.replace('/admin');
      router.refresh();
    }
  }

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F4F4F1]"><div className="rounded-3xl bg-white px-6 py-5 text-xs font-black shadow-sm">Opening admin...</div></div>;
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-[30px] bg-white p-7 shadow-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14140F] text-white"><ShieldCheck size={24} /></div>
          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">PrimeHub Admin</p>
          <h1 className="mt-1 text-2xl font-black">Admin Login</h1>
          <p className="mt-2 text-xs leading-5 text-black/40">Sirf admin password enter karein.</p>
          {error && <div className="mt-4 rounded-2xl bg-[#E1352B]/10 p-3 text-[10px] font-bold leading-4 text-[#E1352B]">{error}</div>}
          <label className="mt-5 block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">Password</span><div className="flex items-center gap-2 rounded-2xl bg-[#F4F4F1] px-3"><LockKeyhole size={15} className="text-black/30" /><input required type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent py-3.5 text-xs font-bold outline-none" placeholder="Enter password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="p-1 text-black/40" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          <button type="submit" disabled={busy} className="mt-5 w-full rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white disabled:opacity-50">{busy ? 'Opening...' : 'Open Admin'}</button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-[150] flex items-center justify-end gap-2 border-b border-black/5 bg-white/90 px-4 py-2 backdrop-blur"><span className="mr-auto truncate text-[9px] font-bold text-black/35">PrimeHub Admin</span><button type="button" onClick={() => void logout()} disabled={busy} className="flex items-center gap-1.5 rounded-full bg-[#F4F4F1] px-3 py-2 text-[9px] font-black disabled:opacity-50"><LogOut size={12} /> Logout</button></div>
      {children}
    </div>
  );
}
