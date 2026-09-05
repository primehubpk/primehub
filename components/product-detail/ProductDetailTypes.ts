import type { Dispatch, SetStateAction } from 'react';
import type { Product as SharedProduct, ProductVariantRow, ProductVariantSelection, WeeklyDeal } from '@/lib/types';
import type { countdownParts, dealTiming } from '@/lib/weeklyDealUtils';
import { normalizeImageUrl } from '@/lib/imageUrl';

export type Product=SharedProduct&{name?:string;compareAtPrice?:number;originalPrice?:number;image?:string;images?:string[];categoryId?:string;quantity?:number;inventory?:number;stock?:number;reelUrl?:string;description?:string;rating?:number;reviews?:number;[key:string]:any};
export type ProductDetailState={product:Product|null;weeklyProducts:Record<string,Product>;loading:boolean;failed:boolean;activeImage:number;quantity:number;wished:boolean;videoOpen:boolean;added:boolean;nowTick:number|null;images:string[];regularPrice:number;productOriginal:number;stock:number;rating:number;reviews:number;weeklyDeals:WeeklyDeal[];currentDeal?:WeeklyDeal;timing:ReturnType<typeof dealTiming>|null;liveDeal:boolean;dealPrice:number;normalForDeal:number;savingsAmount:number;savingsPercent:number;countdown:ReturnType<typeof countdownParts>|null;currentPrice:number;whatsappNumber:string;maxQuantity?:number;stockProgress:number;bannerCountdown:string;variantRows:ProductVariantRow[];variantModalOpen:boolean;variantMode:'cart'|'buy';variantSelection?:ProductVariantSelection};
export type ProductDetailActions={setActiveImage:Dispatch<SetStateAction<number>>;setQuantity:Dispatch<SetStateAction<number>>;setWished:Dispatch<SetStateAction<boolean>>;setVideoOpen:Dispatch<SetStateAction<boolean>>;addProduct:()=>void;orderNow:()=>void;buyWhatsApp:()=>void;openVariantSelector:(mode:'cart'|'buy')=>void;closeVariantSelector:()=>void;confirmVariant:(selection:ProductVariantSelection,quantity:number)=>void};
export type ProductDetailModel=ProductDetailState&ProductDetailActions;

export function titleOf(product:Product){return product.title||product.name||'PrimeHub Deal';}
export function regularPriceOf(product:Product){return Number(product.price||0);}
export function originalPriceOf(product:Product){return Number(product.compareAtPrice??product.originalPrice??product.price??0);}
export function imagesOf(product:Product){
  const list=[...(Array.isArray(product.images)?product.images:[]),product.imageUrl,product.image]
    .filter(Boolean)
    .map((value)=>normalizeImageUrl(String(value)))
    .filter(Boolean);
  return [...new Set(list)];
}
export function videoOf(product:Product){return product.videoUrl||product.reelUrl||'';}
export function money(value:number){return `Rs. ${Number(value||0).toLocaleString()}`;}
export function dealDiscount(dealPrice:number,regularPrice:number){if(regularPrice<=0||dealPrice<=0||dealPrice>=regularPrice)return 0;return Math.round(((regularPrice-dealPrice)/regularPrice)*100);}
