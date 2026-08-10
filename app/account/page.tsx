'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { CheckCircle2, LogOut, UserRound } from 'lucide-react';
import { auth } from '@/lib/firebase';

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
        setMessage('Account created successfully.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setMessage('Welcome back.');
      }
      setPassword('');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setMessage(code.includes('auth/email-already-in-use') ? 'This email already has an account. Choose Log in.' : code.includes('auth/invalid-credential') ? 'Email or password is incorrect.' : code.includes('auth/weak-password') ? 'Password must be at least 6 characters.' : 'Unable to complete this request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return <main className="min-h-screen bg-[#F8F7F3] px-4 py-12"><section className="mx-auto max-w-md rounded-[28px] border border-black/10 bg-white p-7 shadow-[0_20px_60px_rgba(20,20,15,0.08)]"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14140F] text-white"><UserRound size={25}/></div><h1 className="mt-5 text-center text-2xl font-black">My Account</h1><p className="mt-1 text-center text-sm text-black/50">{user.displayName || user.email}</p><div className="mt-6 flex items-center gap-2 rounded-xl bg-[#0F6A5F]/10 px-4 py-3 text-sm font-bold text-[#0F6A5F]"><CheckCircle2 size={17}/>You are signed in.</div><button type="button" onClick={() => signOut(auth)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#14140F] py-3 text-sm font-black text-white"><LogOut size={16}/>Log out</button></section></main>;
  }

  return <main className="min-h-screen bg-[#F8F7F3] px-4 py-12"><section className="mx-auto max-w-md rounded-[28px] border border-black/10 bg-white p-7 shadow-[0_20px_60px_rgba(20,20,15,0.08)]"><div className="text-center"><div className="text-3xl font-black tracking-[-0.07em]">ph<span className="text-[#E1352B]">deals</span></div><p className="mt-1 text-[8px] font-black tracking-[0.35em] text-[#B77900]">PRIME HUB</p><h1 className="mt-7 text-2xl font-black">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1><p className="mt-1 text-sm text-black/50">{mode === 'signup' ? 'Save your details and shop faster.' : 'Log in to your PrimeHub account.'}</p></div>
    <form onSubmit={submit} className="mt-6 space-y-3">
      {mode === 'signup' && <label className="block text-xs font-bold">Full name<input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5 w-full rounded-xl border border-black/12 px-3 py-3 text-sm outline-none focus:border-[#14140F]" placeholder="Your name" /></label>}
      <label className="block text-xs font-bold">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5 w-full rounded-xl border border-black/12 px-3 py-3 text-sm outline-none focus:border-[#14140F]" placeholder="you@example.com" /></label>
      <label className="block text-xs font-bold">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required className="mt-1.5 w-full rounded-xl border border-black/12 px-3 py-3 text-sm outline-none focus:border-[#14140F]" placeholder="At least 6 characters" /></label>
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#14140F] py-3.5 text-sm font-black text-white disabled:opacity-50">{busy ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Log In'}</button>
    </form>
    {message && <div role="status" className="mt-4 rounded-xl bg-[#F4F4F1] px-4 py-3 text-sm font-semibold">{message}</div>}
    <button type="button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setMessage(''); }} className="mt-5 w-full text-center text-xs font-bold text-[#0F6A5F]">{mode === 'signup' ? 'Already have an account? Log in' : 'New customer? Create an account'}</button>
  </section></main>;
}
