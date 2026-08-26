import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { approveResellerReward } from '@/lib/resellerRewardsAdmin';
export const runtime = 'nodejs';
const ADMIN_UID = process.env.FIREBASE_ADMIN_UID || '';
async function requireAdmin(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('Unauthorized');
  const decoded = await getAdminAuth().verifyIdToken(header.slice(7));
  if (!ADMIN_UID || decoded.uid !== ADMIN_UID) throw new Error('Forbidden');
}
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const resellerUserId = String(body?.resellerUserId || '');
    const orderId = String(body?.orderId || '');
    const orderTotal = Number(body?.orderTotal || 0);
    const source = String(body?.source || 'website');
    if (!resellerUserId || !orderId || !Number.isFinite(orderTotal)) return NextResponse.json({ error: 'Reseller ID, order ID and valid order total are required.' }, { status: 400 });
    const result = await approveResellerReward({ resellerUserId, orderId, orderTotal, source });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to approve reseller reward.' }, { status: 403 });
  }
}
