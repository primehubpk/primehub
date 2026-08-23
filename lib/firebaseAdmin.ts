// ==================== FIREBASE ADMIN INITIALIZATION ====================
// Server-only Firebase Admin client for protected API routes.

import 'server-only';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccount) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'primehub-store';
  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL ||
    'firebase-adminsdk-fbsvc@primehub-store.iam.gserviceaccount.com';
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!privateKey) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_KEY is not configured.',
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function getAdminDb() { return getFirestore(getAdminApp()); }
export function getAdminAuth() { return getAuth(getAdminApp()); }
