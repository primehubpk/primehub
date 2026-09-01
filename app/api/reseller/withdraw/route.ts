import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { createResellerWithdrawal } from '@/lib/resellerServer';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const user = await getAdminAuth().verifyIdToken(header.slice(7));
    const body = await request.json();
    const amount = Number(body?.amount);
    const method = String(body?.method || '');
    const accountTitle = String(body?.accountTitle || '');
    const accountNumber = String(body?.accountNumber || '');
    const bankName = String(body?.bankName || '');
    return NextResponse.json(await createResellerWithdrawal(user.uid, amount, method, accountTitle, accountNumber, bankName));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Withdrawal failed.' }, { status: 400 }); }
}

