import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { shoppingWalletBalance } from '@/lib/resellerShoppingCheckout';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Read once when the signed-in customer opens checkout; no Supabase read,
 * cart-level polling, or paid amount calculation on routine quotes. */
export async function GET(request: Request) {
  const value = request.headers.get('authorization') || '';
  if (!value.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  }
  try {
    const user = await getAdminAuth().verifyIdToken(value.slice(7), true);
    const balance = await shoppingWalletBalance(user.uid);
    return NextResponse.json({ balance }, {
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization' },
    });
  } catch (error) {
    console.warn('Shopping wallet balance read denied/unavailable:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Shopping wallet balance unavailable. Standard checkout remains available.' }, { status: 503 });
  }
}
