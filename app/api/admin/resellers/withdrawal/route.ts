import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { reviewResellerWithdrawal } from '@/lib/resellerServer';
export const runtime = 'nodejs';
const ADMIN_UID = 'BZfIarsxGkXwZUIEcfFXa9u7Ge02';

async function isAdmin(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  try { return (await getAdminAuth().verifyIdToken(header.slice(7))).uid === ADMIN_UID; } catch { return false; }
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
  try {
    const body = await request.json();
    const id = typeof body?.withdrawalId === 'string' ? body.withdrawalId.trim() : '';
    const action = body?.action;
    if (!id || !['approve', 'reject', 'paid'].includes(action)) return NextResponse.json({ error: 'Withdrawal ID and valid action are required.' }, { status: 400 });
    await reviewResellerWithdrawal(id, action, String(body?.adminNote || ''));
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Withdrawal review failed.' }, { status: 400 }); }
}
