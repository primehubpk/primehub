import 'server-only';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2';

export type SalaarCatalogBackupSnapshot = {
  products: any[];
  categories: any[];
  source: string;
  refreshedAt: string;
};

const BACKUP_KEY = (process.env.SALAAR_CATALOG_BACKUP_KEY || 'system/salaar/catalog-last-good-v1.json').replace(/^\/+/, '');
const MAX_BACKUP_AGE_MS = Math.max(60 * 60_000, Number(process.env.SALAAR_CATALOG_BACKUP_MAX_AGE_MS || 7 * 24 * 60 * 60_000));

function bucket() {
  return process.env.R2_BUCKET_NAME?.trim() || 'primehub';
}

function validSnapshot(value: unknown): value is SalaarCatalogBackupSnapshot {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.products) || source.products.length === 0) return false;
  if (!Array.isArray(source.categories)) return false;
  if (typeof source.refreshedAt !== 'string' || !source.refreshedAt) return false;
  const refreshedAt = Date.parse(source.refreshedAt);
  if (!Number.isFinite(refreshedAt) || Date.now() - refreshedAt > MAX_BACKUP_AGE_MS) return false;
  return true;
}

export async function writeSalaarCatalogBackup(snapshot: SalaarCatalogBackupSnapshot) {
  if (!validSnapshot(snapshot)) return false;
  const body = Buffer.from(JSON.stringify(snapshot));
  await r2Client().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: BACKUP_KEY,
    Body: body,
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'no-store',
  }));
  return true;
}

export async function readSalaarCatalogBackup(): Promise<SalaarCatalogBackupSnapshot | null> {
  try {
    const response = await r2Client().send(new GetObjectCommand({
      Bucket: bucket(),
      Key: BACKUP_KEY,
    }));
    const text = await response.Body?.transformToString();
    if (!text) return null;
    const parsed = JSON.parse(text);
    return validSnapshot(parsed) ? parsed : null;
  } catch (error) {
    console.warn('Salaar R2 catalog backup unavailable', error);
    return null;
  }
}
