import { getAuth } from 'firebase/auth';
import { initializeApp,getApps,getApp,type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
const firebaseConfig:FirebaseOptions={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY||'AIzaSyA0jI5esNvMt3Sb3Wvy7NQShsoWzntJxQU',authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN||'prime-hub-a02f0.firebaseapp.com',projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID||'prime-hub-a02f0',storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET||'prime-hub-a02f0.firebasestorage.app',messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID||'987298121402',appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID||'1:987298121402:web:1037435704552e4292a483'};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
export const auth=getAuth(app); export const db=getFirestore(app); export const storage=getStorage(app); export default app;
