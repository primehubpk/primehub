// lib/firebase.ts
// Firebase initialization for PrimeHub Deals (phdeals).
//
// Safe for Next.js: guards against re-initializing the app on every
// hot-reload/re-render in development by checking getApps().length first.
//
// Env vars (NEXT_PUBLIC_FIREBASE_*) are read first so you can override
// per-environment (e.g. a separate Firebase project for staging) without
// touching this file — they fall back to the hardcoded project keys
// below so it also works instantly on a fresh Vercel deploy with no
// env vars set at all.
//
// NOTE: a Firebase Web apiKey is not a secret — it's included in your
// client bundle no matter what and is meant to be public. What actually
// protects your data is your Firestore Security Rules (and, for the
// API key itself, HTTP referrer restrictions in the Google Cloud
// Console under APIs & Services > Credentials). Setting env vars here
// is about environment flexibility, not hiding this value.

import { getAuth } from 'firebase/auth';
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ==========================================
// SECTION: FIREBASE CONFIG (env override -> hardcoded fallback)
// ==========================================
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyA0jI5esNvMt3Sb3Wvy7NQShsoWzntJxQU',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'prime-hub-a02f0.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'prime-hub-a02f0',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'prime-hub-a02f0.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '987298121402',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:987298121402:web:1037435704552e4292a483',
};

// ==========================================
// SECTION: SAFE APP INITIALIZATION (prevents duplicate app on re-render)
// ==========================================
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ==========================================
// SECTION: EXPORTED SERVICES
// ==========================================
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
