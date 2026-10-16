import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getDualProduct } from '@/lib/dualReadServer';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { uploadWebpToR2 } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Point = { x: number; y: number };
type Stroke = { points: Point[] };
const MAX_SOURCE_BYTES = 7 * 1024 * 1024;
const MAX_STROKES = 35;
const MAX_POINTS = 250;

function cleanProductId(value: unknown) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{1,100}$/.test(id) ? id : '';
}

function allowedSource(value: unknown) {
  try {
    const u = new URL(normalizeImageUrl(String(value || '')));
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
    if (!['images.primehubmall.com', 'i.ibb.co'].includes(u.hostname)) return '';
    return u.href;
  } catch { return ''; }
}

function productImageUrls(product: Record<string, any>): Set<string> {
  const urls = new Set<string>();
  const collect = (value: unknown) => {
    const candidate = typeof value === 'string' ? value
      : value && typeof value === 'object' ? String((value as any).url || (value as any).imageUrl || '') : '';
    const url = allowedSource(candidate);
    if (url) urls.add(url);
  };
  collect(product.image);
  collect(product.imageUrl);
  for (const value of [...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray(product.galleryImages) ? product.galleryImages : [])]) collect(value);
  for (const value of Object.values(product.colorImages || {})) collect(value);
  for (const row of [...(Array.isArray(product.variantMatrix) ? product.variantMatrix : []),
    ...(Array.isArray(product.variants) ? product.variants : []),
    ...(Array.isArray(product.variantColors) ? product.variantColors : [])]) {
    collect(row?.imageUrl);
    collect(row?.image);
  }
  return urls;
}

function cleanStrokes(value: unknown): Stroke[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_STROKES) return [];
  const strokes: Stroke[] = [];
  for (const row of value) {
    if (!Array.isArray(row?.points) || !row.points.length || row.points.length > MAX_POINTS) return [];
    const points: Point[] = [];
    for (const point of row.points) {
      const x = Number(point?.x), y = Number(point?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1000 || y < 0 || y > 1000) return [];
      points.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
    strokes.push({ points });
  }
  return strokes;
}

async function fetchBoundedImage(url: string) {
  const response = await fetch(url, { redirect: 'error', cache: 'force-cache', signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.body) throw new Error('Product photo could not be loaded.');
  const size = Number(response.headers.get('content-length') || 0);
  if (size > MAX_SOURCE_BYTES) throw new Error('Product photo is too large.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_SOURCE_BYTES) throw new Error('Product photo is too large.');
      chunks.push(next.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  if (!total) throw new Error('Product photo is empty.');
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function markedSvg(width: number, height: number, strokes: Stroke[]) {
  const shapes = strokes.map(({ points }) => {
    if (points.length === 1) {
      const { x, y } = points[0];
      return `<circle cx="${x}" cy="${y}" r="16" fill="#fff" /><circle cx="${x}" cy="${y}" r="11" fill="#ed3329" />`;
    }
    const d = points.map((p, index) => `${index ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
    return `<path d="${d}" stroke="#fff" stroke-width="21" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" stroke="#ed3329" stroke-width="13" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1000 1000" preserveAspectRatio="none">${shapes}</svg>`);
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Invalid upload origin.' }, { status: 403 });
  }
  if (Number(request.headers.get('content-length') || 0) > 30000) {
    return NextResponse.json({ error: 'Too many marks.' }, { status: 413 });
  }
  try {
    const body = await request.json();
    const productId = cleanProductId(body?.productId);
    const originalUrl = allowedSource(body?.originalUrl);
    const strokes = cleanStrokes(body?.strokes);
    if (!productId || !originalUrl || !strokes.length) {
      return NextResponse.json({ error: 'Choose a valid product photo and mark a colour first.' }, { status: 400 });
    }

    // Only permit annotating a real photo belonging to this product.
    // The client never chooses an arbitrary remote URL or the R2 output key.
    const result = await getDualProduct(productId, { cache: 'no-store', timeoutMs: 5000 });
    if (!result.product || !productImageUrls(result.product as Record<string, any>).has(originalUrl)) {
      return NextResponse.json({ error: 'This photo is not available for the selected product.' }, { status: 400 });
    }
    const source = await fetchBoundedImage(originalUrl);
    const meta = await sharp(source, { limitInputPixels: 16_000_000 }).metadata();
    if (!meta.width || !meta.height) throw new Error('Invalid source image.');
    const resized = await sharp(source, { limitInputPixels: 16_000_000 })
      .rotate().resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });
    const overlay = markedSvg(resized.info.width, resized.info.height, strokes);
    const marked = await sharp(resized.data).composite([{ input: overlay }]).webp({ quality: 78 }).toBuffer();
    const key = `products/customer-marks/${productId}/${crypto.randomUUID()}.webp`;
    const markedUrl = await uploadWebpToR2(marked, key);
    return NextResponse.json({ success: true, markedImage: { originalUrl, markedUrl } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Product colour-mark save failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Marked photo could not be saved. Please try again.' }, { status: 503 });
  }
}
