import { createHash } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { mapDocumentToSupabase, recordMirrorFailure, supabasePrimaryUpsert } from '@/lib/dualWriteServer';
import { compressForR2, isR2PublicUrl, uploadWebpToR2 } from '@/lib/r2';

export const runtime = 'nodejs';

const BATCH_SIZE = 3;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_TIMEOUT_MS = 25_000;
const LEGACY_IMAGE_URL = /^https:\/\/i\.ibb\.co\//i;

function isAuthorized(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').some((part) => part.trim() === 'primehub_admin_auth=true');
}

function legacyUrl(data: Record<string, any>) {
  return [data.iconUrl, data.imageUrl]
    .map((value) => String(value || '').trim())
    .find((value) => LEGACY_IMAGE_URL.test(value)) || '';
}

function existingR2Url(data: Record<string, any>) {
  return [data.iconUrl, data.imageUrl]
    .map((value) => String(value || '').trim())
    .find((value) => isR2PublicUrl(value)) || '';
}

async function downloadLegacyImage(url: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'Cache-Control': 'no-cache',
          'User-Agent': 'PrimeHubMall-R2-Migration/1.0',
        },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Legacy image returned HTTP ${response.status}.`);
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) throw new Error('Legacy URL did not return an image.');
      const declaredSize = Number(response.headers.get('content-length') || 0);
      if (declaredSize > MAX_SOURCE_BYTES) throw new Error('Legacy image is larger than 10MB.');
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length > MAX_SOURCE_BYTES) throw new Error('Legacy image is larger than 10MB.');
      if (body.length === 0) throw new Error('Legacy image download returned an empty file.');
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < DOWNLOAD_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError || 'Unknown download error');
  throw new Error(`Legacy image download failed after ${DOWNLOAD_ATTEMPTS} attempts: ${reason}`);
}

function migrationObjectKey(sourceUrl: string) {
  const digest = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 20);
  return `categories/legacy-${digest}.webp`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const snapshot = await db.collection('categories').get();
    const legacyDocs = snapshot.docs.filter((doc) => Boolean(legacyUrl(doc.data() || {})));
    const batch = legacyDocs.slice(0, BATCH_SIZE);
    const failures: Array<{ id: string; error: string }> = [];
    let migrated = 0;

    for (const doc of batch) {
      const data = doc.data() || {};
      const sourceUrl = legacyUrl(data);
      if (!sourceUrl) continue;

      try {
        let r2Url = existingR2Url(data);
        if (!r2Url) {
          const original = await downloadLegacyImage(sourceUrl);
          const compressed = await compressForR2(original);
          r2Url = await uploadWebpToR2(compressed, migrationObjectKey(sourceUrl));
          if (!isR2PublicUrl(r2Url)) throw new Error('R2 returned an invalid public URL.');
        }

        const nextData = {
          ...data,
          iconUrl: r2Url,
          imageUrl: r2Url,
          categoryImageMigratedToR2At: new Date().toISOString(),
        };
        const row = mapDocumentToSupabase('categories', doc.id, nextData, 'supabase');
        if (!row) throw new Error('Supabase category mapping is unavailable.');
        await supabasePrimaryUpsert({ table: 'categories', row });

        try {
          await doc.ref.set(nextData, { merge: false });
        } catch (error) {
          await recordMirrorFailure('categories', doc.id, 'upsert', nextData, 'firebase');
          throw new Error(`Firebase mirror failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        migrated += 1;
      } catch (error) {
        failures.push({ id: doc.id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (migrated > 0) {
      revalidateTag('public-catalog', { expire: 0 });
    }

    const remaining = Math.max(0, legacyDocs.length - migrated);
    return NextResponse.json(
      { success: true, migrated, remaining, failures },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Category R2 migration error', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Category migration failed.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
