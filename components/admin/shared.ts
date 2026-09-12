// ==================== ADMIN SHARED TYPES ====================
import { collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notifyCatalogUpdated } from '@/lib/catalogRefreshSignal';

export interface Product { id: string; title: string; price: number; originalPrice?: number; category: string; stock: number; imageUrl?: string; images?: Array<string | { url?: string }>; description?: string; isFlashSale?: boolean; isWeekendSpecial?: boolean; [key: string]: unknown }
export interface Category { id: string; title: string; iconUrl?: string; imageUrl?: string; active?: boolean; order?: number; sortOrder?: number; slug?: string; [key: string]: unknown }
export interface Order { id: string; customer: { name?: string; phone?: string; city?: string; [key: string]: unknown }; items: Array<{ title?: string; quantity?: number; price?: number; [key: string]: unknown }>; total?: number; subtotal?: number; status?: string; createdAt?: unknown; [key: string]: unknown }
export interface VendorRequest { id: string; supplierName?: string; businessName?: string; whatsappNumber?: string; city?: string; productTitle?: string; wholesalePrice?: number; stock?: number; category?: string; description?: string; photos?: string[]; status?: string; [key: string]: unknown }
export interface SiteSettings { announcementText?: string; whatsappNumber?: string; freeShippingCount?: number; [key: string]: unknown }
export interface UserReward { id: string; points?: number; streak?: number; coupons?: string[]; lastCheckIn?: string; lastSpin?: string }
export interface DashboardStats { totalProducts: number; totalOrders: number; totalRevenue: number; lowStockProducts: number }
export type AdminRole = 'super_admin' | 'admin' | 'manager' | 'editor' | 'support';
export type AdminPermission = 'dashboard.view'|'products.view'|'products.manage'|'categories.view'|'categories.manage'|'deals.view'|'deals.manage'|'orders.view'|'orders.manage'|'customers.view'|'customers.manage'|'inventory.view'|'inventory.manage'|'marketing.view'|'marketing.manage'|'content.view'|'content.manage'|'analytics.view'|'settings.view'|'settings.manage'|'suppliers.view'|'suppliers.manage'|'security.view'|'security.manage';
export interface AdminProfile { id: string; email?: string; displayName?: string; role: AdminRole; permissions: AdminPermission[]; active: boolean; lastLoginAt?: unknown; createdAt?: unknown; [key: string]: unknown }

async function adminRequest(action: 'create' | 'update' | 'set' | 'delete' | 'get' | 'list', name: string, id?: string, value?: Record<string, any>) {
  const response = await fetch('/api/admin/firestore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, name, id, value }),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.error || 'Admin operation failed.');
  if ((name === 'products' || name === 'categories') && ['create', 'update', 'set', 'delete'].includes(action)) {
    notifyCatalogUpdated({ action, collection: name, id, at: new Date().toISOString() });
  }
  return result;
}

async function adminWrite(action: 'create' | 'update' | 'set' | 'delete', name: string, id?: string, value?: Record<string, any>) {
  return adminRequest(action, name, id, value);
}

/** New uploads prefer R2 and automatically fall back to the established ImgBB upload route. */
export async function uploadImageToImgBB(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image must be 10MB or smaller.');

  async function tryUpload(endpoint: string) {
    const form = new FormData();
    form.append('image', file, file.name || 'upload');
    const response = await fetch(endpoint, { method: 'POST', body: form, credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || typeof result.url !== 'string') {
      throw new Error(result?.error || 'Image upload failed.');
    }
    return result.url as string;
  }

  let url = '';
  try {
    url = await tryUpload('/api/upload/r2');
  } catch {
    url = await tryUpload('/api/upload/imgbb');
  }

  if (!/^https:\/\/images\.primehubmall\.com\//i.test(url) && !/^https:\/\/pub-[a-z0-9]+\.r2\.dev\//i.test(url) && !/^https:\/\/i\.ibb\.co\//i.test(url)) {
    throw new Error('Upload returned a non-CDN image URL.');
  }
  return url;
}

export const adminCollection = (name: string) => collection(db, name);

export async function getAdminDocument(name: string, id: string) {
  const result = await adminRequest('get', name, id);
  return {
    exists: () => result.exists === true,
    data: () => result.data || undefined,
    id,
  };
}

export async function listAdminDocuments(name: string) {
  const result = await adminRequest('list', name);
  const rows = Array.isArray(result.documents) ? result.documents : [];
  return {
    docs: rows.map((row: any) => ({ id: String(row.id), data: () => row.data || {} })),
    size: rows.length,
    empty: rows.length === 0,
  };
}

function normalizeAdminDocument(name: string, value: Record<string, any>) {
  if (name !== 'categories') return value;
  const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl : typeof value.iconUrl === 'string' ? value.iconUrl : '';
  return { ...value, imageUrl, iconUrl: typeof value.iconUrl === 'string' ? value.iconUrl : imageUrl };
}
export const createAdminDocument = (name: string, value: Record<string, any>) => adminWrite('create', name, undefined, normalizeAdminDocument(name, value));
export const updateAdminDocument = (name: string, id: string, value: Record<string, any>) => adminWrite('update', name, id, normalizeAdminDocument(name, value));
export const setAdminDocument = (name: string, id: string, value: Record<string, any>) => adminWrite('set', name, id, normalizeAdminDocument(name, value));
export const deleteAdminDocument = (name: string, id: string) => adminWrite('delete', name, id);
export async function writeAdminAuditLog(action: string, entity: string, entityId?: string, metadata: Record<string, unknown> = {}) { await adminWrite('create', 'admin_audit_logs', undefined, { action, entity, entityId: entityId || null, actorUid: 'local-admin', actorEmail: 'primehubpk1@gmail.com', metadata, createdAt: new Date().toISOString() }); }
export function pakistanDayKey(date = new Date()) { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(date).toLowerCase(); }
export function isWithinSchedule(startAt?: string, endAt?: string, now = new Date()) { const start = startAt ? new Date(startAt).getTime() : Number.NEGATIVE_INFINITY; const end = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY; const current = now.getTime(); return Number.isFinite(current) && current >= start && current <= end; }
