import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { compressForR2, isR2PublicUrl, uploadWebpToR2 } from '@/lib/r2';
import { ensureSalarConversation, readSalarSid, SALAR_UNBLOCK_EMAIL, verifiedCustomerUid } from '@/lib/salar/chatStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  const sid = readSalarSid(request);
  if (!sid) return NextResponse.json({ error: 'session_required' }, { status: 401 });

  try {
    const customerUid = await verifiedCustomerUid(request);
    const conversation = await ensureSalarConversation(sid, customerUid);
    const snapshot = await conversation.ref.get();
    if (snapshot.data()?.blocked === true) {
      return NextResponse.json({ error: 'blocked', unblockEmail: SALAR_UNBLOCK_EMAIL }, { status: 403 });
    }

    const form = await request.formData();
    const image = form.get('image');
    if (!(image instanceof File)) return NextResponse.json({ error: 'An image file is required.' }, { status: 400 });
    if (!ALLOWED.has(image.type)) return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images are allowed.' }, { status: 400 });
    if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image must be 4MB or smaller.' }, { status: 400 });

    const compressed = await compressForR2(Buffer.from(await image.arrayBuffer()));
    const safeConversation = conversation.id.slice(0, 40).replace(/[^a-z0-9_-]/gi, '');
    const key = `salar/${safeConversation}/${Date.now()}-${randomUUID().slice(0, 8)}.webp`;
    const url = await uploadWebpToR2(compressed, key);
    if (!isR2PublicUrl(url)) return NextResponse.json({ error: 'Image storage returned an invalid URL.' }, { status: 502 });

    return NextResponse.json({ ok: true, url }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch {
    return NextResponse.json({ error: 'Image upload service is unavailable.' }, { status: 500 });
  }
}
