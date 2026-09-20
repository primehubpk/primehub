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

export function adminSignInError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    'auth/unauthorized-domain': 'This preview domain is not authorized in Firebase Authentication. Add this hostname to Authorized domains before Google sign-in.',
    'auth/operation-not-allowed': 'Google sign-in is not enabled in Firebase Authentication for this project.',
    'auth/popup-blocked': 'The browser blocked the Google sign-in popup. Allow popups for this site and try again.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before verification completed.',
    'auth/cancelled-popup-request': 'Another Google sign-in is already open.',
    'auth/network-request-failed': 'Google sign-in could not connect. Check the connection and try again.',
  };
  return messages[code] || 'Admin verification failed. Sign in using the authorized admin Google account.';
}
