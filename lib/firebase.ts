// lib/firebase.ts
// Firebase initialization for PrimeHub Deals (phdeals).
// Uses the Firebase Web App configuration from the PrimeHub project.
// The Web API key is a client-side identifier, not a service-account secret.

import { getAuth } from 'firebase/auth';
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyA0jI5esNvMt3Sb3Wvy7NQShsoWzntJxQU',
  authDomain: 'prime-hub-a02f0.firebaseapp.com',
  projectId: 'prime-hub-a02f0',
  storageBucket: 'prime-hub-a02f0.firebasestorage.app',
  messagingSenderId: '987298121402',
  appId: '1:987298121402:web:1037435704552e4292a483',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
