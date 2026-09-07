import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const PUBLIC_BASE = (
  process.env.R2_PUBLIC_BASE_URL ||
  'https://images.primehubmall.com'
).replace(/\/+$/, '');

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function safeStem(originalName: string) {
  return (originalName || 'image')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
}

function safePathPart(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'anonymous';
}

export function r2Client() {
  const accountId = requiredEnv('R2_ACCOUNT_ID');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
}

export async function compressForR2(buffer: Buffer) {
  return sharp(buffer)
    .rotate()
    .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function compressSalaarImageForR2(buffer: Buffer) {
  let output = await sharp(buffer)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72, smartSubsample: true })
    .toBuffer();

  if (output.length > 900 * 1024) {
    output = await sharp(output)
      .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 60, smartSubsample: true })
      .toBuffer();
  }

  if (output.length > 1200 * 1024) {
    output = await sharp(output)
      .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 52, smartSubsample: true })
      .toBuffer();
  }

  return output;
}

export function r2ObjectKey(originalName: string) {
  return `products/${Date.now()}-${safeStem(originalName)}.webp`;
}

export function salaarR2ObjectKey(sessionId: string, originalName: string) {
  const random = crypto.randomUUID().slice(0, 8);
  return `salaar/${safePathPart(sessionId)}/${Date.now()}-${random}-${safeStem(originalName)}.webp`;
}

export function r2PublicUrl(key: string) {
  return `${PUBLIC_BASE}/${key.replace(/^\/+/, '')}`;
}

export async function uploadWebpToR2(body: Buffer, key: string) {
  const bucket = process.env.R2_BUCKET_NAME?.trim() || 'primehub';
  await r2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return r2PublicUrl(key);
}

export function isR2PublicUrl(url: string) {
  const value = (url || '').trim();
  return /^https:\/\/images\.primehubmall\.com\//i.test(value) ||
    /^https:\/\/pub-[a-z0-9]+\.r2\.dev\//i.test(value);
}
