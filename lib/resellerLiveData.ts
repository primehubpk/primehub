'use client';

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ResellerProfile } from '@/lib/resellerTypes';

export async function getMyResellerProfile(userId: string): Promise<ResellerProfile | null> {
  if (!userId) return null;
  const snapshot = await getDoc(doc(db, 'reseller_profiles', userId));
  if (!snapshot.exists()) return null;
  return snapshot.data() as ResellerProfile;
}
