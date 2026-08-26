'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Crown, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { createResellerAccount, resetResellerPassword, signInReseller } from '@/lib/resellerAuth';
import { createResellerProfile } from '@/lib/resellerFirestore';

function authMessage(code: string, rawMessage = '') {
  switch (code) {
    case 'auth/email-already-in-use': return 'This email already has a PrimeHub account. Please use Sign In instead.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/invalid-credential': return 'Email or password is incorrect.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later.';
    case 'auth/operation-not-allowed': return 'Email/password signup is disabled in Firebase. Enable Email/Password in Firebase Authentication → Sign-in method.';
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key': return 'Firebase API key is invalid. Update the PrimeHub Web App API key in Firebase Project Settings, then redeploy Vercel.';
    case 'auth/network-request-failed': return 'Network connection to Firebase failed. Please check your internet connection and try again.';
    case 'PROFILE_PERMISSION_DENIED': return 'Your Firebase account was created, but Firestore blocked the reseller profile. Check the deployed reseller_profiles rules.';
    case 'PROFILE_UNAVAILABLE': return 'Your Firebase account was created, but Firestore is temporarily unavailable. Please try again.';
    case 'permission-denied': return 'Your Firebase account was created, but Firestore blocked the reseller profile. Check the deployed reseller_profiles rules.';
    default: return rawMessage ? `Signup failed: ${rawMessage}` : 'Signup failed. Please try again.';
  }
}

export default function ResellerJoinPage() {
  const [mode, setMode] = useState<'signup' | 'signin'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'signup') setMode('signup');
  }, []);

  function switchMode(nextMode: 'signup' | 'signin') {
    setMode(nextMode);
    setMessage('');
    setSuccess(false);
    setPassword('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(''); setSuccess(false);
    try {
      if (mode === 'signup') {
        const credential = await createResellerAccount(email, password);
        try {
          await createResellerProfile(credential.user.uid, credential.user.email || email.trim());
        } catch (profileError) {
          const profileCode = profileError instanceof Error ? String(profileError.message).split(':')[0] : '';
          setMessage(authMessage(profileCode, profileError instanceof Error ? profileError.message : 'Profile creation failed.'));
          return;
        }
        setSuccess(true); setMessage('Your PrimeHub Reseller Club account is ready.');
      } else {
        const credential = await signInReseller(email, password, rememberMe);
        await createResellerProfile(credential.user.uid, credential.user.email || email.trim());
        setSuccess(true); setMessage('Welcome back. Your Reseller Club account is securely signed in.');
      }
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String((error as { code?: string }).code) : '';
      setMessage(authMessage(code, error instanceof Error ? error.message : 'Unknown error.'));
    } finally { setBusy(false); }
  }

  async function forgotPassword() {
    if (!email.trim()) { setMessage('Enter your email first, then tap Forgot password.'); return; }
    setBusy(true); setMessage('');
    try { await resetResellerPassword(email); setMessage('Password reset email sent. Please check your inbox.'); }
    catch (error) { const code = error instanceof Error && 'code' in error ? String((error as { code?: string }).code) : ''; setMessage(authMessage(code, error instanceof Error ? error.message : '')); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
    <section className="px-4 pb-10 pt-5 sm:px-6"><div className="mx-auto max-w-md">
      <Link href="/reseller" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[10px] font-black text-black/55 shadow-sm"><ArrowLeft size={13}/> Reseller Club</Link>
      <div className="mt-4 overflow-hidden rounded-[30px] bg-white shadow-[0_18px_50px_rgba(20,20,15,0.08)]">
        <div className="bg-gradient-to-br from-[#151610] to-[#0F6A5F] px-5 pb-6 pt-7 text-white sm:px-7"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCF68] text-[#14140F]"><Crown size={23}/></div><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FFCF68]">PrimeHub Reseller Club</p><h1 className="mt-1 text-xl font-black">{mode === 'signup' ? 'Join & Start Earning' : 'Welcome Back'}</h1></div></div><p className="mt-4 text-[11px] leading-5 text-white/65">{mode === 'signup' ? 'Create your secure account to unlock reseller benefits.' : 'Sign in to your reseller account and continue earning.'}</p></div>
        <div className="p-5 sm:p-7">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#F4F4F1] p-1"><button type="button" onClick={() => switchMode('signin')} className={`rounded-xl py-3 text-[10px] font-black ${mode === 'signin' ? 'bg-[#14140F] text-white shadow-sm' : 'text-black/45'}`}>SIGN IN</button><button type="button" onClick={() => switchMode('signup')} className={`rounded-xl py-3 text-[10px] font-black ${mode === 'signup' ? 'bg-[#14140F] text-white shadow-sm' : 'text-black/45'}`}>CREATE ACCOUNT</button></div>
          <div className="mt-5 rounded-2xl bg-[#FFF5D8] px-3 py-2.5 text-[10px] font-bold text-[#8A6200]"><strong>{mode === 'signup' ? 'New to Reseller Club?' : 'Already a member?'}</strong> {mode === 'signup' ? 'Create your account below — it only takes a minute.' : 'Use your PrimeHub reseller email and password.'}</div>
          <form onSubmit={submit} className="mt-5 space-y-3"><label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-black/40"><Mail size={12}/> Email</span><input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" className="w-full rounded-2xl border border-black/8 bg-[#F8F8F5] px-4 py-3.5 text-sm outline-none focus:border-[#0F6A5F]"/></label><label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-black/40"><LockKeyhole size={12}/> Password</span><div className="relative"><input value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?'text':'password'} autoComplete={mode==='signup'?'new-password':'current-password'} minLength={6} required placeholder="Minimum 6 characters" className="w-full rounded-2xl border border-black/8 bg-[#F8F8F5] px-4 py-3.5 text-sm outline-none focus:border-[#0F6A5F] pr-12"/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/35" aria-label="Toggle password visibility">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
          {mode === 'signin' && <div className="flex items-center justify-between px-1"><label className="flex items-center gap-2 text-[10px] font-bold text-black/55"><input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} className="h-4 w-4 accent-[#0F6A5F]"/> Remember me</label><button type="button" disabled={busy} onClick={forgotPassword} className="text-[10px] font-black text-[#0F6A5F]">Forgot password?</button></div>}
          <button disabled={busy} type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14140F] py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-50">{busy?'Please wait…':mode==='signup'?'Create My Reseller Account':'Sign In'}<ChevronRight size={16}/></button></form>
          {message&&<div className={`mt-4 rounded-2xl p-3.5 text-[10px] font-bold leading-5 ${success?'bg-[#0F6A5F]/10 text-[#0F6A5F]':'bg-[#E1352B]/10 text-[#B82B23]'}`}>{success&&<Check size={14} className="mr-1 inline"/>}{message}{success&&<Link href="/reseller/dashboard" className="mt-2 flex w-full items-center justify-center rounded-xl bg-[#0F6A5F] py-2.5 text-white">Open My Reseller Dashboard</Link>}</div>}
          <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-[#DDF5F0] p-3"><ShieldCheck size={15} className="text-[#0F6A5F]"/><p className="mt-2 text-[9px] font-black">Secure Firebase login</p></div><div className="rounded-2xl bg-[#FFE0DC] p-3"><Crown size={15} className="text-[#C83B31]"/><p className="mt-2 text-[9px] font-black">Reseller benefits</p></div></div>
          <p className="mt-5 text-center text-[9px] leading-4 text-black/35">Normal shopping remains available without an account. Your reseller account is only needed for Club benefits and wallet.</p>
        </div>
      </div>
    </div></section>
  </main>;
}
