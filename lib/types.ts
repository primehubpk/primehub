// lib/types.ts
export interface FreeDeliverySettings { enabled:boolean; itemThreshold:number; message:string; unlockedMessage:string; }
export interface PriceBucket { id:string; title:string; amount?:number|null; iconUrl:string; accent:string; sortOrder:number; active:boolean; }
export type Weekday='sunday'|'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday';
export interface WeeklyDeal { id:string; day:Weekday; label:string; productId:string; imageUrl:string; title:string; originalPrice:number; dealPrice:number; startAt:string; endAt:string; buttonText:string; buttonLink:string; active:boolean; }
export interface DailyDeal { productId:string; imageUrl:string; title:string; originalPrice:number; dealPrice:number; startAt:string; endAt:string; buttonText:string; buttonLink:string; active:boolean; }
export interface YouTubeGuideSettings { enabled:boolean; title:string; videoId:string; description:string; }
export interface PolicyPageContent { title:string; content:string; }
export interface SiteSettings { freeDelivery?:FreeDeliverySettings; priceBuckets?:PriceBucket[]; weeklyDeals?:WeeklyDeal[]; dailyDeal?:DailyDeal; youtubeGuide?:YouTubeGuideSettings; policies?:{privacyPolicy?:PolicyPageContent;terms?:PolicyPageContent;returnPolicy?:PolicyPageContent}; announcementText:string; whatsappNumber:string; freeShippingCount:number; heroTitle:string; heroDiscountText:string; heroCountdownEndTime:string; heroImageUrl:string; heroButtonText:string; heroButtonLink:string; }
export interface ProductVariantSelection { color?:string; size?:string; }
export interface ProductVariantRow { id?:string; color?:string; size?:string; stock?:number|string; imageUrl?:string; price?:number|string; [key:string]:unknown; }
export interface ProductVariantColor { name:string; imageUrl?:string; }
export interface ProductVariantOption { id:string; values:string[]; }
export interface Product { id:string; title:string; price:number; originalPrice:number; category:string; stock:number; isWeekendSpecial:boolean; isFlashSale:boolean; isWholesale?:boolean; imageUrl:string; videoUrl?:string; variantColors?:ProductVariantColor[]|string[]; variantSizes?:string[]; colors?:string[]; sizes?:string[]; variantOptions?:ProductVariantOption[]; variantMatrix?:ProductVariantRow[]; variants?:ProductVariantRow[]; colorImages?:Record<string,string>; hasVariants?:boolean; [key:string]:unknown; }
export interface Category { id:string; title:string; slug?:string; iconUrl?:string; imageUrl?:string; active?:boolean; sortOrder?:number; }
export interface OrderItem { productId:string; title:string; price:number; quantity:number; image?:string; variant?:ProductVariantSelection; }
export interface OrderCustomer { name:string; phone:string; email?:string; address:string; city:string; notes?:string; }
export interface Order { id:string; customer:OrderCustomer; items:OrderItem[]; totalItems:number; subtotal:number; total:number; currency:string; status:'pending'|'confirmed'|'shipped'|'delivered'|'cancelled'; source:'website'|'WhatsApp'; createdAt:any; updatedAt?:any; }
