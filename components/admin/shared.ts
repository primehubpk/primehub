// ==================== ADMIN SHARED TYPES ====================
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';

export interface Product { id: string; title: string; price: number; originalPrice?: number; category: string; stock: number; imageUrl?: string; images?: string[]; description?: string; isFlashSale?: boolean; isWeekendSpecial?: boolean; [key: string]: unknown }
export interface Category { id: string; title: string; iconUrl?: string; active?: boolean; order?: number; [key: string]: unknown }
export interface Order { id: string; customer: { name?: string; phone?: string; city?: string; [key: string]: unknown }; items: Array<{ title?: string; quantity?: number; price?: number; [key: string]: unknown }>; total?: number; subtotal?: number; status?: string; createdAt?: unknown; [key: string]: unknown }
export interface VendorRequest { id: string; supplierName?: string; businessName?: string; whatsappNumber?: string; city?: string; productTitle?: string; wholesalePrice?: number; stock?: number; category?: string; description?: string; photos?: string[]; status?: string; [key: string]: unknown }
export interface SiteSettings { announcementText?: string; whatsappNumber?: string; freeShippingCount?: number; [key: string]: unknown }
export interface UserReward { id: string; points?: number; streak?: number; coupons?: string[]; lastCheckIn?: string; lastSpin?: string }
export interface DashboardStats { totalProducts: number; totalOrders: number; totalRevenue: number; lowStockProducts: number }

export type AdminRole = 'super_admin' | 'admin' | 'manager' | 'editor' | 'support';
export type AdminPermission =
  | 'dashboard.view'
  | 'products.view' | 'products.manage'
  | 'categories.view' | 'categories.manage'
  | 'deals.view' | 'deals.manage'
  | 'orders.view' | 'orders.manage'
  | 'customers.view' | 'customers.manage'
  | 'inventory.view' | 'inventory.manage'
  | 'marketing.view' | 'marketing.manage'
  | 'content.view' | 'content.manage'
  | 'analytics.view'
  | 'settings.view' | 'settings.manage'
  | 'suppliers.view' | 'suppliers.manage'
  | 'security.view' | 'security.manage';

export interface AdminProfile { id: string; email?: string; displayName?: string; role: AdminRole; permissions: AdminPermission[]; active: boolean; lastLoginAt?: unknown; createdAt?: unknown; [key: string]: unknown }

// ==================== SECURE MEDIA UPLOAD ====================
// Uploads now use Firebase Storage instead of an ImgBB API key embedded in
// the client bundle. Storage Security Rules must restrict writes to admins.
export async function uploadImageToImgBB(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image must be 10MB or smaller.');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
  const path = `admin-media/${auth.currentUser?.uid || 'anonymous'}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type, customMetadata: { uploadedBy: auth.currentUser?.uid || '' } });
  return getDownloadURL(storageRef);
}

// ==================== FIRESTORE ADMIN UTILITIES ====================
export const adminCollection = (name: string) => collection(db, name);
export const getAdminDocument = (name: string, id: string) => getDoc(doc(db, name, id));
export const listAdminDocuments = (name: string) => getDocs(collection(db, name));
export const createAdminDocument = (name: string, value: Record<string, any>) => addDoc(collection(db, name), value);
export const updateAdminDocument = (name: string, id: string, value: Record<string, any>) => updateDoc(doc(db, name, id), value);
export const setAdminDocument = (name: string, id: string, value: Record<string, any>) => setDoc(doc(db, name, id), value, { merge: true });
export const deleteAdminDocument = (name: string, id: string) => deleteDoc(doc(db, name, id));

// ==================== ADMIN AUDIT FOUNDATION ====================
// Every important mutation can use this helper. Rules should allow writes only
// from authenticated admin identities and should prevent clients from editing
// old audit records.
export async function writeAdminAuditLog(action: string, entity: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Admin authentication required.');
  await addDoc(collection(db, 'admin_audit_logs'), {
    action,
    entity,
    entityId: entityId || null,
    actorUid: actor.uid,
    actorEmail: actor.email || null,
    metadata,
    createdAt: serverTimestamp(),
  });
}

export function pakistanDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' }).format(date).toLowerCase();
}

export function isWithinSchedule(startAt?: string, endAt?: string, now = new Date()) {
  const start = startAt ? new Date(startAt).getTime() : Number.NEGATIVE_INFINITY;
  const end = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY;
  const current = now.getTime();
  return Number.isFinite(current) && current >= start && current <= end;
}
