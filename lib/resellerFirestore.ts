'use client';

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function createResellerProfile(userId: string, email: string) {
  if (!userId || !email) throw new Error('A valid signed-in user is required.');
  const ref = doc(db, 'reseller_profiles', userId);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) return;

    await setDoc(ref, {
      userId,
      email,
      displayName: '',
      status: 'active',
      tierId: 'starter',
      monthlyOrders: 0,
      walletAvailable: 0,
      walletPending: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String((error as { code?: string }).code) : '';
    if (code === 'permission-denied') {
      throw new Error('PROFILE_PERMISSION_DENIED: Firestore blocked creation of your reseller profile. Check the reseller_profiles rules and make sure they are deployed to the same Firebase project used by Vercel.');
    }
    if (code === 'unavailable') {
      throw new Error('PROFILE_UNAVAILABLE: Firebase Firestore is temporarily unavailable. Please try again.');
    }
    throw error;
  }
}
