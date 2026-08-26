import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { releaseMaturedResellerRewards } from '@/lib/resellerServer';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const user = await getAdminAuth().verifyIdToken(header.slice(7));
    return NextResponse.json(await releaseMaturedResellerRewards(user.uid));
  } catch { return NextResponse.json({ error: 'Authentication required.' }, { status: 401 }); }
}
