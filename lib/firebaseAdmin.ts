// ==================== FIREBASE ADMIN INITIALIZATION ====================
// Server-only Firebase Admin client for protected API routes.

import 'server-only';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccount) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not configured.');
}

const adminApp =
  getApps()[0] ||
  initializeApp({
    credential: cert(JSON.parse(serviceAccount)),
  });

export const adminDb = getFirestore(adminApp);
