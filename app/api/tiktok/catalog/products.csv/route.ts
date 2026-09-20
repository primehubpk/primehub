import { getDualFeedCatalog } from '@/lib/dualReadServer';
import { getFreshStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import {
  PRODUCT_FEED_HEADERS,
  buildProductFeedRows,
  rowsToCsv,
} from '@/lib/tiktokCatalogFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEED_HEADERS = {
  'Content-Type': 'text/csv; charset=utf-8',
  'Content-Disposition': 'inline; filename="primehubmall-tiktok-products.csv"',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(request: Request) {
  try {
    const [catalog, settings] = await Promise.all([
      getDualFeedCatalog({ cache: 'no-store', timeoutMs: 8000 }),
      getFreshStorefrontSettingsSnapshot(),
    ]);

    if (catalog.source === 'empty') {
      throw new Error('Product catalog is unavailable.');
    }

    const { rows, skipped } = buildProductFeedRows({
      products: catalog.products,
      categories: catalog.categories,
      settings,
      requestOrigin: new URL(request.url).origin,
      now: new Date(),
    });

    const csv = rowsToCsv(PRODUCT_FEED_HEADERS, rows);
    return new Response(csv, {
      status: 200,
      headers: {
        ...FEED_HEADERS,
        'X-PrimeHub-Feed-Items': String(rows.length),
        'X-PrimeHub-Feed-Skipped': String(skipped),
        'X-PrimeHub-Feed-Source': catalog.source,
      },
    });
  } catch (error) {
    console.error('TikTok product feed failed', error);
    return new Response('PrimeHub TikTok product feed is temporarily unavailable.\n', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
