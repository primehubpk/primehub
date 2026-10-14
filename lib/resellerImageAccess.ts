import 'server-only';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function requireActiveResellerForImages(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new Error('SIGN_IN_REQUIRED');
  let uid = '';
  try {
    const user = await getAdminAuth().verifyIdToken(authorization.slice(7), true);
    uid = user.uid;
  } catch { throw new Error('SIGN_IN_REQUIRED'); }
  const profile = await getAdminDb().collection('reseller_profiles').doc(uid).get();
  if (!profile.exists || profile.data()?.status !== 'active') throw new Error('ACTIVE_RESELLER_REQUIRED');
  return uid;
}

export function imageAccessError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'SIGN_IN_REQUIRED') return { status: 401, message: 'Sign in with your existing PrimeHub Reseller account.' };
  if (code === 'ACTIVE_RESELLER_REQUIRED') return { status: 403, message: 'Only active PrimeHub reseller accounts can download the image catalogue.' };
  return { status: 503, message: 'Image library temporarily unavailable. Please try again.' };
}
