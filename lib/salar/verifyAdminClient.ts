'use client';

export async function verifySalarAdmin() {
  const [{ auth }, { GoogleAuthProvider, signInWithPopup }] = await Promise.all([import('@/lib/firebase'), import('firebase/auth')]);
  const google = new GoogleAuthProvider();
  google.setCustomParameters({ prompt: 'select_account' });
  const login = await signInWithPopup(auth, google);
  const response = await fetch('/api/admin/salar/credentials', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify-admin', idToken: await login.user.getIdToken(true) }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Admin verification failed.');
}
