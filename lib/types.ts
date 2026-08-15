// lib/types.ts
// Shared TypeScript shapes for our Firestore collections.
// Used by both the admin panel and storefront components so both
// sides always agree on what a Product / Category / Order / Settings
// document looks like.

export interface FreeDeliverySettings {
  enabled: boolean;
  itemThreshold: number;
  message: string;
  unlockedMessage: string;
}

export interface PriceBucket {
  id: string;
  title: string;
  amount?: number | null;
  iconUrl: string;
  accent: string;
  sortOrder: number;
  active: boolean;
}

export type Weekday =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface WeeklyDeal {
  id: string;
  day: Weekday;
  label: string;
  productId: string;
  imageUrl: string;
  title: string;
  originalPrice: number;
  dealPrice: number;
  startAt: string;
  endAt: string;
  buttonText: string;
  buttonLink: string;
  active: boolean;
}

export interface DailyDeal {
  productId: string;
  imageUrl: string;
  title: string;
  originalPrice: number;
  dealPrice: number;
  startAt: string;
  endAt: string;
  buttonText: string;
  buttonLink: string;
  active: boolean;
}

export interface YouTubeGuideSettings {
  enabled: boolean;
  title: string;
  videoId: string;
  description: string;
}

export interface PolicyPageContent {
  title: string;
  content: string;
}

export interface SiteSettings {
  freeDelivery?: FreeDeliverySettings;
  priceBuckets?: PriceBucket[];
  weeklyDeals?: WeeklyDeal[];
  dailyDeal?: DailyDeal;
  youtubeGuide?: YouTubeGuideSettings;
  policies?: {
    privacyPolicy?: PolicyPageContent;
    terms?: PolicyPageContent;
    returnPolicy?: PolicyPageContent;
  };
  announcementText: string;
  whatsappNumber: string;
  freeShippingCount: number;
  heroTitle: string;
  heroDiscountText: string;
  heroCountdownEndTime: string;
  heroImageUrl: string;
  heroButtonText: string;
  heroButtonLink: string;
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
  isWholesale?: boolean;
  imageUrl: string;
  videoUrl?: string;
}

export interface Category {
  id: string;
  title: string;
  iconUrl: string;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  notes?: string;
}

export interface Order {
  id: string;
  customer: OrderCustomer;
  items: OrderItem[];
  totalItems: number;
  subtotal: number;
  total: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  source: 'website' | 'WhatsApp';
  createdAt: any;
  updatedAt?: any;
}
