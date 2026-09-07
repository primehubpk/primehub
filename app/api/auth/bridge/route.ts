import { NextResponse } from 'next/server';
import { mirrorFirebaseIdentityFromToken } from '@/lib/authDualBridge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  try {
    const result = await mirrorFirebaseIdentityFromToken(header.slice(7));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('Auth identity bridge failed', error);
    return NextResponse.json({ error: 'Unable to mirror account identity.' }, { status: 401 });
  }
}
