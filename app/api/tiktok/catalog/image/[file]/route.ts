import sharp from 'sharp';
import { getDualSkills } from '@/lib/dualReadServer';
import { getFreshPublicProductSnapshot } from '@/lib/publicCatalogServer';
import { PRIME_SKILLS_SEED } from '@/lib/primeSkillsSeed';
import {
  decodeImageToken,
  sourceImageForProduct,
  sourceImageForSkill,
} from '@/lib/tiktokCatalogFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = new Set([
  'images.primehubmall.com',
  'i.ibb.co',
]);

function trustedImageUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host) || host.endsWith('.r2.dev')) return url;
    return null;
  } catch {
    return null;
  }
}

async function productSource(id: string) {
  const result = await getFreshPublicProductSnapshot(id);
  return result.product ? sourceImageForProduct(result.product) : '';
}

async function skillSource(id: string) {
  const result = await getDualSkills({ cache: 'no-store', timeoutMs: 8000 });
  const source = result.skills.length ? result.skills : PRIME_SKILLS_SEED;
  const skill = source.find((item: any) => String(item?.id || '') === id);
  return skill ? sourceImageForSkill(skill) : '';
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  try {
    const { file } = await context.params;
    const token = decodeImageToken(file);
    if (!token?.id) {
      return new Response('Not found', { status: 404 });
    }

    const source = token.kind === 'p'
      ? await productSource(token.id)
      : await skillSource(token.id);
    const imageUrl = trustedImageUrl(source);
    if (!imageUrl) {
      return new Response('Catalog image unavailable', { status: 404 });
    }

    const upstream = await fetch(imageUrl, {
      cache: 'force-cache',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'PrimeHubMall-TikTok-Catalog/1.0' },
    });
    if (!upstream.ok) {
      return new Response('Catalog image unavailable', { status: 502 });
    }

    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (contentLength > 15 * 1024 * 1024) {
      return new Response('Catalog image too large', { status: 413 });
    }

    const sourceBytes = new Uint8Array(await upstream.arrayBuffer());
    if (sourceBytes.byteLength > 15 * 1024 * 1024) {
      return new Response('Catalog image too large', { status: 413 });
    }

    const jpeg = await sharp(sourceBytes, { failOn: 'none' })
      .rotate()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    return new Response(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('TikTok catalog image proxy failed', error);
    return new Response('Catalog image unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
