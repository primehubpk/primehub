import { NextResponse } from 'next/server';
import { getConfiguredReadMode } from '@/lib/dualReadServer';
import {
  getFreshPublicCatalogSnapshot,
  getFreshPublicProductSnapshot,
  getFreshStorefrontSettingsDocumentsSnapshot,
  getPrimeSkillsSnapshot,
} from '@/lib/publicCatalogServer';

export const runtime = 'nodejs';

const FRESH_BROWSER_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
};

function requestedProductIds(url: URL) {
  try {
    const parsed = JSON.parse(String(url.searchParams.get('ids') || '[]'));
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    ).slice(0, 24);
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = String(url.searchParams.get('type') || 'catalog');
  try {
    if (type === 'settings') {
      const documents = await getFreshStorefrontSettingsDocumentsSnapshot();
      return NextResponse.json(
        { documents, source: 'fresh', mode: getConfiguredReadMode() },
        { headers: FRESH_BROWSER_HEADERS },
      );
    }
    if (type === 'skills') {
      const result = await getPrimeSkillsSnapshot();
      return NextResponse.json(
        { skills: result.skills, source: result.source, mode: getConfiguredReadMode() },
        { headers: FRESH_BROWSER_HEADERS },
      );
    }
    if (type === 'products') {
      const ids = requestedProductIds(url);
      if (ids.length === 0) {
        return NextResponse.json({ error: 'At least one product id is required.' }, { status: 400 });
      }
      const results = await Promise.all(ids.map((id) => getFreshPublicProductSnapshot(id)));
      const products = results
        .map((result) => result.product)
        .filter((product) => Boolean(product));
      return NextResponse.json(
        { products, source: 'fresh', mode: getConfiguredReadMode() },
        { headers: FRESH_BROWSER_HEADERS },
      );
    }
    if (type === 'product') {
      const id = String(url.searchParams.get('id') || '').trim();
      if (!id) {
        return NextResponse.json({ error: 'Product id is required.' }, { status: 400 });
      }
      const result = await getFreshPublicProductSnapshot(id);
      if (!result.product) {
        return NextResponse.json(
          { error: 'Product not found.', mode: getConfiguredReadMode() },
          { status: 404, headers: FRESH_BROWSER_HEADERS },
        );
      }
      return NextResponse.json(
        { ...result, source: 'fresh', mode: getConfiguredReadMode() },
        { headers: FRESH_BROWSER_HEADERS },
      );
    }
    const result = await getFreshPublicCatalogSnapshot();
    return NextResponse.json(
      { ...result, source: 'fresh', mode: getConfiguredReadMode() },
      { headers: FRESH_BROWSER_HEADERS },
    );
  } catch (error) {
    console.error('storefront dual read failed', error);
    return NextResponse.json(
      { error: 'Storefront data unavailable.' },
      { status: 503, headers: FRESH_BROWSER_HEADERS },
    );
  }
}
