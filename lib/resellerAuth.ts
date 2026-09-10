'use client';

import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export async function createResellerAccount(email: string, password: string): Promise<UserCredential> {
  await setPersistence(auth, browserLocalPersistence);
  return createUserWithEmailAndPassword(auth, email.trim(), password);
}

function isNetworkFailure(error: unknown) {
  return !!error && typeof error === 'object' && 'code' in error && String((error as { code?: string }).code) === 'auth/network-request-failed';
}

export async function signInReseller(email: string, password: string, rememberMe = true): Promise<UserCredential> {
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  const normalizedEmail = email.trim();
  try {
    return await signInWithEmailAndPassword(auth, normalizedEmail, password);
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    // Preview/mobile networks can occasionally drop the first Firebase Auth request.
    // Retry once without changing credentials, persistence, or reseller profile data.
    await new Promise(resolve => window.setTimeout(resolve, 700));
    return signInWithEmailAndPassword(auth, normalizedEmail, password);
  }
}

export async function resetResellerPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutReseller(): Promise<void> {
  await signOut(auth);
}
