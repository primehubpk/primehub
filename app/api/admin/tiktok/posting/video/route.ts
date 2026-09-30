import { randomUUID } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { postingAdmin, sameOrigin } from '@/lib/integrations/tiktokPostingAuth';
import { r2Client, r2PublicUrl } from '@/lib/r2';

export const runtime = 'nodejs';
const MAX_BYTES = 3_500_000; // Safely below Vercel's request payload limit.

export async function POST(request: Request) {
  if (!sameOrigin(request) || !await postingAdmin(request)) return NextResponse.json({ error: 'TikTok posting authorization required.' }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get('video');
    if (!(file instanceof File) || file.size < 1024 || file.size > MAX_BYTES || file.type !== 'video/mp4') {
      return NextResponse.json({ error: 'Choose an MP4 video smaller than 3.5 MB.' }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(4, 8).toString('ascii') !== 'ftyp') {
      return NextResponse.json({ error: 'The file is not an MP4 video.' }, { status: 400 });
    }
    const key = `tiktok-sandbox/${Date.now()}-${randomUUID()}.mp4`;
    const url = r2PublicUrl(key);
    if (new URL(url).hostname !== 'images.primehubmall.com') throw new Error('The verified R2 media domain is not configured.');
    await r2Client().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME?.trim() || 'primehub', Key: key,
      Body: bytes, ContentType: 'video/mp4', CacheControl: 'public, max-age=86400',
    }));
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Video upload failed.' }, { status: 503 });
  }
}
