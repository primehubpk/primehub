import { getDualFeedCatalog } from '@/lib/dualReadServer';
import { getFreshStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import { buildProductFeedRows, rowsToCsv } from '@/lib/tiktokCatalogFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = [
  'id', 'title', 'description', 'availability', 'condition', 'price',
  'link', 'image_link', 'brand', 'product_type', 'sale_price',
  'custom_label_0', 'custom_label_1', 'custom_label_2', 'custom_label_3', 'custom_label_4',
] as const;

export async function GET(request: Request) {
  try {
    const [catalog, settings] = await Promise.all([
      getDualFeedCatalog({ cache: 'no-store', timeoutMs: 8000 }),
      getFreshStorefrontSettingsSnapshot(),
    ]);
    if (catalog.source === 'empty') throw new Error('Product catalog is unavailable.');

    // Keep item IDs identical to the existing product IDs and pixel events.
    // Shared feed pricing keeps weekly and rotating deals in sync with checkout.
    const { rows, skipped } = buildProductFeedRows({
      products: catalog.products,
      categories: catalog.categories,
      settings,
      requestOrigin: new URL(request.url).origin,
      now: new Date(),
    });
    const metaRows = rows.map(({ sku_id, sale_price, ...row }) => ({
      id: sku_id,
      ...row,
      // Leave the field blank outside an active discount.
      sale_price: sale_price || '',
    }));
    return new Response(rowsToCsv(HEADERS, metaRows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'inline; filename="primehubmall-meta-products.csv"',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        'X-Content-Type-Options': 'nosniff',
        'X-PrimeHub-Feed-Items': String(rows.length),
        'X-PrimeHub-Feed-Skipped': String(skipped),
      },
    });
  } catch (error) {
    console.error('Meta product feed failed', error);
    return new Response('PrimeHubMall Meta product feed is temporarily unavailable.\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
