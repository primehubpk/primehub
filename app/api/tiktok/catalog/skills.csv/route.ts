import { getDualSkills } from '@/lib/dualReadServer';
import {
  SKILL_FEED_HEADERS,
  buildSkillFeedRows,
  rowsToCsv,
} from '@/lib/tiktokCatalogFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const result = await getDualSkills({ cache: 'no-store', timeoutMs: 8000 });
    const { rows, skipped } = buildSkillFeedRows({
      skills: result.skills,
      requestOrigin: new URL(request.url).origin,
    });

    const csv = rowsToCsv(SKILL_FEED_HEADERS, rows);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'inline; filename="primehubmall-tiktok-skills.csv"',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        'X-Content-Type-Options': 'nosniff',
        'X-PrimeHub-Feed-Items': String(rows.length),
        'X-PrimeHub-Feed-Skipped': String(skipped),
        'X-PrimeHub-Feed-Source': result.source,
      },
    });
  } catch (error) {
    console.error('TikTok Prime Skills feed failed', error);
    return new Response('PrimeHub TikTok Prime Skills feed is temporarily unavailable.\n', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
