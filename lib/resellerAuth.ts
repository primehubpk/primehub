'use client';

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export async function createResellerAccount(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signInReseller(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function resetResellerPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutReseller(): Promise<void> {
  await signOut(auth);
}
