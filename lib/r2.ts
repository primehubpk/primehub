import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const PUBLIC_BASE = (
  process.env.R2_PUBLIC_BASE_URL ||
  'https://pub-157b90419bf04016bdea666e4cbce181.r2.dev'
).replace(/\/+$/, '');

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
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

export function r2ObjectKey(originalName: string) {
  const stem = (originalName || 'image')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
  return `products/${Date.now()}-${stem}.webp`;
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
  return /^https:\/\/pub-[a-z0-9]+\.r2\.dev\//i.test((url || '').trim());
}
