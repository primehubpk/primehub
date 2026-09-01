import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { createResellerTaskClaim } from '@/lib/resellerServer';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const user = await getAdminAuth().verifyIdToken(header.slice(7));
    const body = await request.json();
    const result = await createResellerTaskClaim(user.uid, String(body?.taskId || ''), String(body?.proof || ''));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Task submission failed.' }, { status: 400 });
  }
}