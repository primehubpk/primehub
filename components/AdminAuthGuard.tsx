'use client';

// ==================== ADMIN AUTH GUARD WITH FIX & MASTER PIN ====================
import { FormEvent, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';

// FIXED: Hardcoded actual Admin UID as default fallback so login NEVER fails!
const ADMIN_UID = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_UID || 'PNLTtUqxHyRuvyvG5fododxC2CO2';

type Props = {
  children: React.ReactNode;
};

export default function AdminAuthGuard({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [masterUser, setMasterUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('primehubpk1@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setChecking(false);
        return;
      }

      // Check if user matches admin UID or email
      if (nextUser.uid === ADMIN_UID || nextUser.email === 'primehubpk1@gmail.com') {
        setUser(nextUser);
      } else {
        await signOut(auth);
        setUser(null);
      }
      setChecking(false);
    });
  }, []);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    // ==================== MASTER PIN / PASSWORD BYPASS ====================
    if (password === 'prime123' || password === 'junaid00') {
      const mockUser = {
        uid: ADMIN_UID,
        email: email.trim() || 'primehubpk1@gmail.com',
        displayName: 'PrimeHub Admin',
      } as User;
      setMasterUser(mockUser);
      setBusy(false);
      return;
    }

    // ==================== FIREBASE AUTHENTICATION ====================
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);

      if (credential.user.uid !== ADMIN_UID && credential.user.email !== 'primehubpk1@gmail.com') {
        await signOut(auth);
        setError('This Firebase account is not authorized for the PrimeHub Deals Admin panel.');
        return;
      }
    } catch (err: any) {
      console.error(err);
      setError('Login failed. Enter Master PIN: prime123');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F4F1]">
        <div className="rounded-3xl bg-white px-6 py-5 text-xs font-black shadow-sm">
          Checking admin security...
        </div>
      </div>
    );
  }

  const activeUser = user || masterUser;

  if (!activeUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-4">
        <form
          onSubmit={login}
          className="w-full max-w-sm rounded-[30px] bg-white p-7 shadow-xl"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14140F] text-white">
            <ShieldCheck size={24} />
          </div>

          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">
            PrimeHub Admin
          </p>
          <h1 className="mt-1 text-2xl font-black">Secure Login</h1>
          <p className="mt-2 text-xs leading-5 text-black/40">
            Enter your Admin Email & Password or Master PIN
          </p>

          {error && (
            <div className="mt-4 rounded-2xl bg-[#E1352B]/10 p-3 text-[10px] font-bold leading-4 text-[#E1352B]">
              {error}
            </div>
          )}

          <label className="mt-5 block">
            <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">
              Admin Email
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl bg-[#F4F4F1] px-3 py-3.5 text-xs font-bold outline-none"
              placeholder="primehubpk1@gmail.com"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">
              Password or Master PIN
            </span>
            <div className="flex items-center gap-2 rounded-2xl bg-[#F4F4F1] px-3">
              <LockKeyhole size={15} className="text-black/30" />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent py-3.5 text-xs font-bold outline-none"
                placeholder="prime123 or junaid00"
              />
            </div>
          </label>

          <button
            disabled={busy}
            className="mt-5 w-full rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white disabled:opacity-50"
          >
            {busy ? 'Signing in...' : 'Sign in securely'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-[150] flex items-center justify-end gap-3 border-b border-black/5 bg-white/90 px-4 py-2 backdrop-blur">
        <span className="truncate text-[9px] font-bold text-black/35">
          {activeUser.email}
        </span>
        <button
          type="button"
          onClick={() => {
            signOut(auth);
            setMasterUser(null);
          }}
          className="flex items-center gap-1.5 rounded-full bg-[#F4F4F1] px-3 py-2 text-[9px] font-black"
        >
          <LogOut size={12} />
          Logout
        </button>
      </div>
      {children}
    </div>
  );
}
