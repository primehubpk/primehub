import { NextResponse } from 'next/server';
import {
  getSalaarCatalogSnapshot,
  SALAAR_CATEGORY_BATCH_SIZE,
  SALAAR_CATALOG_REVALIDATE_SECONDS,
} from '@/lib/salaarCatalogCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const catalog = await getSalaarCatalogSnapshot();
    const requested = new URL(request.url).searchParams.get('category')?.trim().toLowerCase() || '';
    const products = Array.isArray(catalog.products) ? catalog.products : [];
    const categories = Array.isArray(catalog.categories) ? catalog.categories : [];
    const matchingCount = requested
      ? products.filter((product: any) => String(product?.category || '').trim().toLowerCase() === requested).length
      : null;
    const available = products.length > 0;

    return NextResponse.json({
      ok: available,
      degraded: catalog.degraded === true,
      source: catalog.source,
      productCount: products.length,
      categoryCount: categories.length,
      requestedCategory: requested || null,
      matchingCount,
      firstBatchCount: matchingCount == null ? null : Math.min(matchingCount, SALAAR_CATEGORY_BATCH_SIZE),
      batchSize: SALAAR_CATEGORY_BATCH_SIZE,
      safetyRefreshSeconds: SALAAR_CATALOG_REVALIDATE_SECONDS,
      refreshedAt: catalog.refreshedAt,
    }, { status: available ? 200 : 503 });
  } catch (error) {
    console.error('Salaar catalog health failed', error);
    return NextResponse.json({ ok: false, degraded: true, error: 'Catalog cache unavailable.' }, { status: 503 });
  }
}
