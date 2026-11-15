'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';

type Props = { children: React.ReactNode };

const ADMIN_HINT_KEY = 'primehub-admin-session-hint-v1';

export default function AdminAuthGuard({ children }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setChecking(true);
    setSessionUnavailable(false);

    const checkSavedSession = async () => {
      // A temporary network/5xx failure must never turn a valid remembered
      // device cookie into a new password prompt. Only the server can confirm
      // admin access; localStorage is used solely to decide whether to retry.
      for (let attempt = 0; attempt < 2 && active; attempt++) {
        try {
          const response = await fetch('/api/admin/session', {
            cache: 'no-store',
            credentials: 'same-origin',
          });
          if (!response.ok) throw new Error('Admin session verification unavailable.');
          const data = await response.json();
          if (typeof data?.authenticated !== 'boolean') {
            throw new Error('Invalid admin session response.');
          }
          if (!active) return;

          let remembered = false;
          try { remembered = window.localStorage.getItem(ADMIN_HINT_KEY) === '1'; } catch {}
          if (!data.authenticated && remembered && attempt === 0) {
            // A single retry for a previously logged-in device protects
            // against transient deployment/server signing-key errors.
            await new Promise((resolve) => window.setTimeout(resolve, 350));
            continue;
          }

          setAuthenticated(data.authenticated);
          try {
            if (data.authenticated) window.localStorage.setItem(ADMIN_HINT_KEY, '1');
            else window.localStorage.removeItem(ADMIN_HINT_KEY);
          } catch {}
          setChecking(false);
          return;
        } catch {
          if (attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 350));
          }
        }
      }

      if (!active) return;
      // Fail closed without deleting a potentially valid signed cookie.
      setAuthenticated(false);
      setSessionUnavailable(true);
      setChecking(false);
    };

    void checkSavedSession();
    return () => { active = false; };
  }, [verificationAttempt]);

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
      setSessionUnavailable(false);
      try { window.localStorage.setItem(ADMIN_HINT_KEY, '1'); } catch {}
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
      try { window.localStorage.removeItem(ADMIN_HINT_KEY); } catch {}
      setPassword('');
      setBusy(false);
      router.replace('/admin');
      router.refresh();
    }
  }

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F4F4F1]"><div className="rounded-3xl bg-white px-6 py-5 text-xs font-black shadow-sm">Opening admin...</div></div>;
  }

  if (sessionUnavailable) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-4">
        <div className="w-full max-w-sm rounded-[30px] bg-white p-7 shadow-xl">
          <ShieldCheck size={30} className="text-[#14140F]" />
          <h1 className="mt-5 text-2xl font-black">Checking admin login</h1>
          <p className="mt-2 text-xs leading-5 text-black/55">
            Connection ki wajah se saved login verify nahi ho saka. Session delete nahi hua.
          </p>
          <button
            type="button"
            onClick={() => setVerificationAttempt((value) => value + 1)}
            className="mt-5 w-full rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white"
          >
            Retry saved login
          </button>
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-[30px] bg-white p-7 shadow-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14140F] text-white"><ShieldCheck size={24} /></div>
          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">PrimeHub Admin</p>
          <h1 className="mt-1 text-2xl font-black">Admin Login</h1>
          <p className="mt-2 text-xs leading-5 text-black/40">Is device par login yaad rahega. Logout se session band hoga.</p>
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
