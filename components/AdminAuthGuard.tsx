'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  User,
} from 'firebase/auth';
import { Eye, EyeOff, KeyRound, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase';

const ADMIN_UID = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_UID || '';
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_EMAIL || 'primehubpk1@gmail.com';

type Props = { children: React.ReactNode };
type Notice = { type: 'error' | 'success'; text: string } | null;

function isAllowedAdmin(user: User) {
  if (ADMIN_UID && user.uid === ADMIN_UID) return true;
  return Boolean(user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

export default function AdminAuthGuard({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [showSecurity, setShowSecurity] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser && isAllowedAdmin(nextUser)) {
        if (mounted) setUser(nextUser);
      } else if (nextUser) {
        await signOut(auth);
        if (mounted) {
          setUser(null);
          setError('This Firebase account is not authorized for the PrimeHub Admin panel.');
        }
      } else if (mounted) {
        setUser(null);
      }
      if (mounted) setChecking(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice(null);
    setBusy(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!isAllowedAdmin(credential.user)) {
        await signOut(auth);
        setError('This Firebase account is not authorized for the PrimeHub Admin panel.');
      }
    } catch (err) {
      console.error(err);
      setError('Login failed. Use your authorized Firebase Admin email and password.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!user?.email) return;
    if (newPassword.length < 8) {
      setNotice({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    setSavingPassword(true);
    setNotice(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setNotice({ type: 'success', text: 'Admin password changed successfully.' });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', text: 'Password change failed. Verify your current password and try again.' });
    } finally {
      setSavingPassword(false);
    }
  }

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F4F4F1]"><div className="rounded-3xl bg-white px-6 py-5 text-xs font-black shadow-sm">Checking admin security...</div></div>;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-4">
        <form onSubmit={login} className="w-full max-w-sm rounded-[30px] bg-white p-7 shadow-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14140F] text-white"><ShieldCheck size={24} /></div>
          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">PrimeHub Admin</p>
          <h1 className="mt-1 text-2xl font-black">Secure Login</h1>
          <p className="mt-2 text-xs leading-5 text-black/40">Sign in with your authorized Firebase Admin account.</p>
          {error && <div className="mt-4 rounded-2xl bg-[#E1352B]/10 p-3 text-[10px] font-bold leading-4 text-[#E1352B]">{error}</div>}
          {notice && <div className="mt-4 rounded-2xl bg-[#0F6A5F]/10 p-3 text-[10px] font-bold leading-4 text-[#0F6A5F]">{notice.text}</div>}
          <label className="mt-5 block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">Admin Email</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-2xl bg-[#F4F4F1] px-3 py-3.5 text-xs font-bold outline-none" placeholder="admin@example.com" autoComplete="username" /></label>
          <label className="mt-3 block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">Password</span><div className="flex items-center gap-2 rounded-2xl bg-[#F4F4F1] px-3"><LockKeyhole size={15} className="text-black/30" /><input required type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent py-3.5 text-xs font-bold outline-none" placeholder="Enter password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="p-1 text-black/40" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          <button disabled={busy} className="mt-5 w-full rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white disabled:opacity-50">{busy ? 'Signing in...' : 'Sign in securely'}</button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-[150] flex items-center justify-end gap-2 border-b border-black/5 bg-white/90 px-4 py-2 backdrop-blur"><span className="mr-auto truncate text-[9px] font-bold text-black/35">{user.email}</span><button type="button" onClick={() => setShowSecurity((value) => !value)} className="flex items-center gap-1.5 rounded-full bg-[#F4F4F1] px-3 py-2 text-[9px] font-black"><KeyRound size={12} /> Security</button><button type="button" onClick={() => { void signOut(auth); }} className="flex items-center gap-1.5 rounded-full bg-[#F4F4F1] px-3 py-2 text-[9px] font-black"><LogOut size={12} /> Logout</button></div>
      {showSecurity && <div className="border-b border-black/5 bg-white px-4 py-4"><form onSubmit={changePassword} className="mx-auto grid max-w-6xl gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end"><label><span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/40">Current password</span><input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-xl bg-[#F4F4F1] px-3 py-2.5 text-xs outline-none" autoComplete="current-password" /></label><label><span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-black/40">New password</span><div className="flex rounded-xl bg-[#F4F4F1] px-3"><input required minLength={8} type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-transparent py-2.5 text-xs outline-none" autoComplete="new-password" /><button type="button" onClick={() => setShowNewPassword((value) => !value)} aria-label="Toggle new password visibility" className="text-black/40">{showNewPassword ? <EyeOff size={15} /> : <Eye size={16} />}</button></div></label><button disabled={savingPassword} className="rounded-xl bg-[#14140F] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{savingPassword ? 'Saving...' : 'Change password'}</button></form>{notice && <p className={`mx-auto mt-2 max-w-6xl text-[10px] font-bold ${notice.type === 'error' ? 'text-[#E1352B]' : 'text-[#0F6A5F]'}`}>{notice.text}</p>}</div>}
      {children}
    </div>
  );
}
