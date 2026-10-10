'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/** Native-only identity link. Never exposes device install secret or FCM token to JavaScript. */
export default function NativePushIdentity() {
  useEffect(() => onAuthStateChanged(auth, async user => {
    const bridge = window.PrimeHubNative;
    if (!bridge) return;
    try {
      const idToken = user ? await user.getIdToken() : '';
      bridge.postMessage(JSON.stringify({ action: 'identity', idToken }));
    } catch { /* Notifications must not affect authentication. */ }
  }), []);
  return null;
}
