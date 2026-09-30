import { NextResponse } from 'next/server';
import { postingAdmin, sameOrigin } from '@/lib/integrations/tiktokPostingAuth';
import { disconnectPosting, getPostingCredentials, postingApi, tiktokConfig } from '@/lib/integrations/tiktokPosting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };

function failed(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'TikTok request failed.' }, { status: 400, headers: noStore });
}

export async function GET(request: Request) {
  if (!await postingAdmin(request)) return NextResponse.json({ error: 'TikTok posting authorization required.' }, { status: 403, headers: noStore });
  try {
    tiktokConfig();
    const account = await getPostingCredentials();
    if (!account) return NextResponse.json({ connected: false }, { headers: noStore });
    const creator = await postingApi('creator_info/query/');
    return NextResponse.json({ connected: true, creator, scope: account.scope }, { headers: noStore });
  } catch (error) { return failed(error); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request) || !await postingAdmin(request)) return NextResponse.json({ error: 'TikTok posting authorization required.' }, { status: 403, headers: noStore });
  try {
    await disconnectPosting();
    return NextResponse.json({ connected: false }, { headers: noStore });
  } catch (error) { return failed(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request) || !await postingAdmin(request)) return NextResponse.json({ error: 'TikTok posting authorization required.' }, { status: 403, headers: noStore });
  try {
    const body = await request.json();
    if (body.action === 'status') {
      if (typeof body.publishId !== 'string' || !/^[\w~.:-]{1,100}$/.test(body.publishId)) throw new Error('Invalid post ID.');
      return NextResponse.json({ status: await postingApi('status/fetch/', { publish_id: body.publishId }) }, { headers: noStore });
    }
    if (body.action !== 'publish') throw new Error('Unknown action.');
    if (body.consent !== true) throw new Error('Confirm the TikTok posting terms first.');
    const videoUrl = String(body.videoUrl || '');
    const parsed = new URL(videoUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.primehubmall.com' || !/\.(mp4|mov)$/i.test(parsed.pathname)) {
      throw new Error('Video must be an HTTPS MP4/MOV URL hosted on the verified www.primehubmall.com domain.');
    }
    const creator = await postingApi('creator_info/query/');
    if (creator.can_post === false || creator.can_post_video === false) throw new Error('This creator cannot post right now.');
    const privacy = String(body.privacy || '');
    if (!privacy || !creator.privacy_level_options?.includes(privacy)) throw new Error('Choose a privacy option offered by TikTok.');
    if (privacy !== 'SELF_ONLY') throw new Error('Sandbox posts must use Only me privacy.');
    const title = String(body.title || '').trim();
    if (title.length > 2200) throw new Error('Caption is too long.');
    const brandOrganic = body.brandOrganic === true;
    const brandContent = body.brandContent === true;
    if (body.commercial === true && !brandOrganic && !brandContent) throw new Error('Select your brand or paid partnership.');
    if (brandContent && privacy === 'SELF_ONLY') throw new Error('Paid partnership cannot be posted privately.');
    const disabled = (key: string) => creator[key] === true || body[key.replace('_disabled', '')] !== true;
    const published = await postingApi('video/init/', {
      post_info: {
        title, privacy_level: privacy,
        disable_comment: disabled('comment_disabled'), disable_duet: disabled('duet_disabled'), disable_stitch: disabled('stitch_disabled'),
        brand_organic_toggle: body.commercial === true && brandOrganic,
        brand_content_toggle: body.commercial === true && brandContent,
        is_aigc: body.aiGenerated === true,
        video_cover_timestamp_ms: Number.isInteger(body.coverTimestampMs) && body.coverTimestampMs >= 0 ? body.coverTimestampMs : 0,
      },
      source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
    });
    return NextResponse.json({ publishId: published.publish_id }, { headers: noStore });
  } catch (error) { return failed(error); }
}
