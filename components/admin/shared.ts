// ==================== ADMIN SHARED TYPES ====================
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Product { id: string; title: string; price: number; originalPrice?: number; category: string; stock: number; imageUrl?: string; images?: string[]; description?: string; isFlashSale?: boolean; isWeekendSpecial?: boolean; [key: string]: unknown }
export interface Category { id: string; title: string; iconUrl?: string }
export interface Order { id: string; customer: { name?: string; phone?: string; city?: string; [key: string]: unknown }; items: Array<{ title?: string; quantity?: number; price?: number }>; total?: number; subtotal?: number; status?: string; createdAt?: unknown }
export interface VendorRequest { id: string; supplierName?: string; businessName?: string; whatsappNumber?: string; city?: string; productTitle?: string; wholesalePrice?: number; stock?: number; category?: string; description?: string; photos?: string[]; status?: string; [key: string]: unknown }
export interface SiteSettings { announcementText?: string; whatsappNumber?: string; freeShippingCount?: number; [key: string]: unknown }
export interface UserReward { id: string; points?: number; streak?: number; coupons?: string[]; lastCheckIn?: string; lastSpin?: string }
export interface DashboardStats { totalProducts: number; totalOrders: number; totalRevenue: number; lowStockProducts: number }

// ==================== IMGBB UPLOAD HELPER ====================
const IMGBB_KEY = 'f38fa84b03c7eaaeda2a4d3a164b116f';
export async function uploadImageToImgBB(file: File): Promise<string> { const form = new FormData(); form.append('image', file); const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: form }); const result = await response.json(); if (!result.success) throw new Error('ImgBB upload failed.'); return result.data.url as string; }

// ==================== FIRESTORE ADMIN UTILITIES ====================
export const adminCollection = (name: string) => collection(db, name);
export const getAdminDocument = (name: string, id: string) => getDoc(doc(db, name, id));
export const listAdminDocuments = (name: string) => getDocs(collection(db, name));
export const createAdminDocument = (name: string, value: Record<string, unknown>) => addDoc(collection(db, name), value);
export const updateAdminDocument = (name: string, id: string, value: Record<string, unknown>) => updateDoc(doc(db, name, id), value);
export const setAdminDocument = (name: string, id: string, value: Record<string, unknown>) => setDoc(doc(db, name, id), value, { merge: true });
export const deleteAdminDocument = (name: string, id: string) => deleteDoc(doc(db, name, id));
