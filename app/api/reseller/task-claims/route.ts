import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { createResellerTaskClaim, recordResellerTaskOpen } from '@/lib/resellerServer';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const user = await getAdminAuth().verifyIdToken(header.slice(7));
    const body = await request.json();
    const taskId = String(body?.taskId || '');
    if (body?.action === 'open') {
      await recordResellerTaskOpen(user.uid, taskId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(await createResellerTaskClaim(user.uid, taskId, String(body?.proof || '')));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Task action failed.' }, { status: 400 }); }
}