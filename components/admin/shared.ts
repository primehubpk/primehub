// ==================== ADMIN SHARED TYPES ====================
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Product { id: string; title: string; price: number; originalPrice?: number; category: string; stock: number; imageUrl?: string; images?: string[]; description?: string; isFlashSale?: boolean; isWeekendSpecial?: boolean; [key: string]: unknown }
export interface Category { id: string; title: string; iconUrl?: string; imageUrl?: string; active?: boolean; order?: number; sortOrder?: number; slug?: string; [key: string]: unknown }
export interface Order { id: string; customer: { name?: string; phone?: string; city?: string; [key: string]: unknown }; items: Array<{ title?: string; quantity?: number; price?: number; [key: string]: unknown }>; total?: number; subtotal?: number; status?: string; createdAt?: unknown; [key: string]: unknown }
export interface VendorRequest { id: string; supplierName?: string; businessName?: string; whatsappNumber?: string; city?: string; productTitle?: string; wholesalePrice?: number; stock?: number; category?: string; description?: string; photos?: string[]; status?: string; [key: string]: unknown }
export interface SiteSettings { announcementText?: string; whatsappNumber?: string; freeShippingCount?: number; [key: string]: unknown }
export interface UserReward { id: string; points?: number; streak?: number; coupons?: string[]; lastCheckIn?: string; lastSpin?: string }
export interface DashboardStats { totalProducts: number; totalOrders: number; totalRevenue: number; lowStockProducts: number }

export type AdminRole = 'super_admin' | 'admin' | 'manager' | 'editor' | 'support';
export type AdminPermission =
  | 'dashboard.view' | 'products.view' | 'products.manage' | 'categories.view' | 'categories.manage'
  | 'deals.view' | 'deals.manage' | 'orders.view' | 'orders.manage' | 'customers.view' | 'customers.manage'
  | 'inventory.view' | 'inventory.manage' | 'marketing.view' | 'marketing.manage' | 'content.view' | 'content.manage'
  | 'analytics.view' | 'settings.view' | 'settings.manage' | 'suppliers.view' | 'suppliers.manage'
  | 'security.view' | 'security.manage';
export interface AdminProfile { id: string; email?: string; displayName?: string; role: AdminRole; permissions: AdminPermission[]; active: boolean; lastLoginAt?: unknown; createdAt?: unknown; [key: string]: unknown }

// ==================== FAST MEDIA UPLOAD ====================
const IMGBB_KEY = 'f38fa84b03c7eaaeda2a4d3a164b116f';

async function compressImageForUpload(file: File): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); return file; }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.82;
  let blob: Blob | null = null;
  while (quality >= 0.5) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (blob && blob.size <= 300 * 1024) break;
    quality -= 0.08;
  }
  if (!blob) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'product'}.webp`, { type: 'image/webp', lastModified: Date.now() });
}

export async function uploadImageToImgBB(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image must be 10MB or smaller.');
  const optimized = await compressImageForUpload(file);
  const form = new FormData();
  form.append('image', optimized);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Image upload failed (${response.status}).`);
  const result = await response.json();
  if (!result.success || !result.data?.url) throw new Error('Image upload failed. Please try again.');
  return result.data.url as string;
}

// ==================== FIRESTORE ADMIN UTILITIES ====================
export const adminCollection = (name: string) => collection(db, name);
export const getAdminDocument = (name: string, id: string) => getDoc(doc(db, name, id));
export const listAdminDocuments = (name: string) => getDocs(collection(db, name));

function normalizeAdminDocument(name: string, value: Record<string, any>) {
  if (name !== 'categories') return value;
  const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl : typeof value.iconUrl === 'string' ? value.iconUrl : '';
  return { ...value, imageUrl, iconUrl: typeof value.iconUrl === 'string' ? value.iconUrl : imageUrl };
}

export const createAdminDocument = (name: string, value: Record<string, any>) => addDoc(collection(db, name), normalizeAdminDocument(name, value));
export const updateAdminDocument = (name: string, id: string, value: Record<string, any>) => updateDoc(doc(db, name, id), normalizeAdminDocument(name, value));
export const setAdminDocument = (name: string, id: string, value: Record<string, any>) => setDoc(doc(db, name, id), normalizeAdminDocument(name, value), { merge: true });
export const deleteAdminDocument = (name: string, id: string) => deleteDoc(doc(db, name, id));

export async function writeAdminAuditLog(action: string, entity: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  const actor = (await import('firebase/auth')).getAuth().currentUser;
  if (!actor) throw new Error('Admin authentication required.');
  await addDoc(collection(db, 'admin_audit_logs'), { action, entity, entityId: entityId || null, actorUid: actor.uid, actorEmail: actor.email || null, metadata, createdAt: new Date().toISOString() });
}

export function pakistanDayKey(date = new Date()) { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(date).toLowerCase(); }
export function isWithinSchedule(startAt?: string, endAt?: string, now = new Date()) { const start = startAt ? new Date(startAt).getTime() : Number.NEGATIVE_INFINITY; const end = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY; const current = now.getTime(); return Number.isFinite(current) && current >= start && current <= end; }