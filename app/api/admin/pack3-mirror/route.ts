import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getSupabasePrimaryPayload, recordMirrorFailure } from '@/lib/dualWriteServer';

export const runtime = 'nodejs';

const PRODUCT_IDS = [
  'Ee51r7Bg0F3ZTgWHygK5',
  'fLkw9BdUXs87O5UeiCSn',
  'XeosekOWD0V9Mgl3ALEp',
  'GnvZHslTaN7WiG5h6SH3',
  'KPMOsTZEt952aIFLIVPF',
  '7k3QcDqsyoyhEmOToRJQ',
  'ppbPRnYDcamg9NVMdvPs',
  'scGsM3eeYeu3X9LLG8fZ',
  'Sm2IuBY5qaG5lS9ErDJK',
  'z1hOliEEtbvwdtEWR5pt',
  'd3RsBcoxt7mjMs3SGIZX',
  '2p79uLpS1qp08qeIpfTZ',
  'LGVsLvYQFBbWJgja8zzO',
  '2S481wxMPs2AzlMRyzav',
  'JwJdJi4WmMZCjZlFYC4C',
  'ZnAbiesat64yFuPTOZK2',
];

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'fix/bulk-editor-variant-image-save') {
    return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get('run') !== 'pack3') {
    return NextResponse.json({ ready: true, count: PRODUCT_IDS.length });
  }

  const db = getAdminDb();
  const mirrored: string[] = [];
  const missing: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of PRODUCT_IDS) {
    const data = await getSupabasePrimaryPayload('products', id);
    if (!data) {
      missing.push(id);
      continue;
    }

    try {
      await db.collection('products').doc(id).set(data, { merge: false });
      mirrored.push(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ id, error: message });
      await recordMirrorFailure('products', id, 'upsert', data, 'firebase');
    }
  }

  revalidateTag('public-catalog');
  revalidateTag('public-products');
  revalidateTag('salaar-catalog');
  revalidateTag('salaar-store-knowledge');

  return NextResponse.json({ success: failed.length === 0 && missing.length === 0, mirrored: mirrored.length, missing, failed });
}
