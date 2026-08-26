'use client';

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function createResellerProfile(userId: string, email: string) {
  if (!userId || !email) throw new Error('A valid signed-in user is required.');
  const ref = doc(db, 'reseller_profiles', userId);
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
}
