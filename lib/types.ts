// lib/types.ts
// Shared TypeScript shapes for our Firestore collections.
// Used by both the admin panel and the storefront components so both
// sides always agree on what a Product / Category / Order / Settings
// document looks like.

export interface SiteSettings {
  announcementText: string;
  whatsappNumber: string; // digits only, no + or leading zeros
  freeShippingCount: number;
  heroTitle: string;
  heroDiscountText: string;
  heroCountdownEndTime: string; // ISO date string, e.g. "2026-08-10T20:00:00"
}

export interface Product {
  id: string;
  title: string;
  price: number;
  originalPrice: number;
  category: string;
  stock: number;
  isWeekendSpecial: boolean;
  isFlashSale: boolean;
  imageUrl: string;
  videoUrl?: string; // optional YouTube Shorts / Instagram Reel / direct .mp4 link
}

export interface Category {
  id: string;
  title: string;
  iconUrl: string;
}

export interface OrderItem {
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  items: OrderItem[];
  total: number;
  paymentStatus: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  placedVia: 'Website' | 'WhatsApp';
  createdAt: any; // Firestore Timestamp
}
