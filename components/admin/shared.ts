// ==================== ADMIN SHARED TYPES ====================
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ADMIN_SESSION_KEY = 'primehub_admin_auth';

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

function requireAdminSession() {
  if (typeof window === 'undefined' || window.localStorage.getItem(ADMIN_SESSION_KEY) !== 'true') {
    throw new Error('Admin session required.');
  }
}

/**
 * ImgBB uploads use the simple admin session instead of Firebase Auth.
 */
export async function uploadImageToImgBB(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image must be 10MB or smaller.');
  requireAdminSession();
  const form = new FormData();
  form.append('image', file, file.name || 'upload');
  const response = await fetch('/api/upload/imgbb', {
    method: 'POST',
    body: form,
    cache: 'no-store',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success || typeof result.url !== 'string') {
    throw new Error(result?.error || 'Image upload failed. Please try again.');
  }
  if (!/^https:\/\/i\.ibb\.co\//i.test(result.url)) {
    throw new Error('Upload returned a non-CDN image URL.');
  }
  return result.url;
}

export const adminCollection = (name: string) => collection(db, name);
export const getAdminDocument = (name: string, id: string) => getDoc(doc(db, name, id));
export const listAdminDocuments = (name: string) => getDocs(collection(db, name));
function normalizeAdminDocument(name: string, value: Record<string, any>) {
  if (name !== 'categories') return value;
  const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl : typeof value.iconUrl === 'string' ? value.iconUrl : '';
  return { ...value, imageUrl, iconUrl: typeof value.iconUrl === 'string' ? value.iconUrl : imageUrl };
}
export const createAdminDocument = (name: string, value: Record<string, any>) => { requireAdminSession(); return addDoc(collection(db, name), normalizeAdminDocument(name, value)); };
export const updateAdminDocument = (name: string, id: string, value: Record<string, any>) => { requireAdminSession(); return updateDoc(doc(db, name, id), normalizeAdminDocument(name, value)); };
export const setAdminDocument = (name: string, id: string, value: Record<string, any>) => { requireAdminSession(); return setDoc(doc(db, name, id), normalizeAdminDocument(name, value), { merge: true }); };
export const deleteAdminDocument = (name: string, id: string) => { requireAdminSession(); return deleteDoc(doc(db, name, id)); };
export async function writeAdminAuditLog(action: string, entity: string, entityId?: string, metadata: Record<string, unknown> = {}) { requireAdminSession(); await addDoc(collection(db, 'admin_audit_logs'), { action, entity, entityId: entityId || null, actorUid: 'local-admin', actorEmail: 'primehubpk1@gmail.com', metadata, createdAt: new Date().toISOString() }); }
export function pakistanDayKey(date = new Date()) { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(date).toLowerCase(); }
export function isWithinSchedule(startAt?: string, endAt?: string, now = new Date()) { const start = startAt ? new Date(startAt).getTime() : Number.NEGATIVE_INFINITY; const end = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY; const current = now.getTime(); return Number.isFinite(current) && current >= start && current <= end; }