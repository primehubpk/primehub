import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { createPendingResellerReward } from '@/lib/resellerServer';
export const runtime = 'nodejs';
const ADMIN_UID = 'BZfIarsxGkXwZUIEcfFXa9u7Ge02';

async function isAdmin(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  try { const decoded = await getAdminAuth().verifyIdToken(header.slice(7)); return decoded.uid === ADMIN_UID; } catch { return false; }
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  try {
    const body = await request.json();
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    if (!orderId) return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    return NextResponse.json(await createPendingResellerReward(orderId));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Reward processing failed.' }, { status: 400 }); }
}
