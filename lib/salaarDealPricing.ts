import { getEffectivePrice, getPakistanDay } from '@/lib/dealPricing';
import type { SalaarStoreKnowledge } from '@/lib/salaarStoreKnowledgeCore';

function numberValue(value: unknown): number {
  const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function productId(product: any): string {
  return String(product?.id || '').trim();
}

function titleCaseDay(day: string | undefined): string | undefined {
  const value = String(day || '').trim().toLowerCase();
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : undefined;
}

export type SalaarProductPricing = {
  price: number;
  originalPrice: number;
  regularPrice: number;
  dealLive: boolean;
  dealLabel?: string;
};

/**
 * Uses the same pricing contract as the PrimeHub homepage:
 * - product dealPrice is live only on product.dealDay in Pakistan time
 * - weekly settings deal is live only on its Pakistan weekday
 * - active Big Deal uses its configured deal price
 * - otherwise the normal store price is returned
 */
export function resolveSalaarProductPricing(
  product: any,
  knowledge: SalaarStoreKnowledge | null,
  now = new Date(),
): SalaarProductPricing {
  const id = productId(product);
  const regularPrice = numberValue(product?.normalPrice || product?.price || product?.salePrice || product?.retailPrice);
  const productDealPrice = numberValue(product?.dealPrice);
  const productDealDay = titleCaseDay(product?.dealDay);
  let price = getEffectivePrice({ price: regularPrice, dealPrice: productDealPrice, dealDay: productDealDay }, now);
  let dealLive = price > 0 && price !== regularPrice;
  let dealLabel = dealLive ? `${getPakistanDay(now)} Deal` : undefined;
  let originalPrice = numberValue(product?.compareAtPrice ?? product?.originalPrice ?? regularPrice) || regularPrice;

  const weeklyDeal = knowledge?.weeklyDeals?.find((deal) => deal.productId && deal.productId === id);
  if (weeklyDeal) {
    const weeklyPrice = getEffectivePrice({
      price: regularPrice,
      dealPrice: numberValue(weeklyDeal.dealPrice),
      dealDay: titleCaseDay(weeklyDeal.day),
    }, now);
    if (weeklyPrice > 0 && weeklyPrice !== regularPrice) {
      price = weeklyPrice;
      dealLive = true;
      dealLabel = weeklyDeal.title || `${getPakistanDay(now)} Deal`;
      originalPrice = numberValue(weeklyDeal.originalPrice) || originalPrice || regularPrice;
    }
  }

  const bigDeal = knowledge?.bigDeal;
  if (bigDeal?.productId && bigDeal.productId === id) {
    const bigDealPrice = numberValue(bigDeal.dealPrice);
    if (bigDealPrice > 0) {
      price = bigDealPrice;
      dealLive = true;
      dealLabel = bigDeal.title || 'Big Deal';
      originalPrice = numberValue(bigDeal.originalPrice) || originalPrice || regularPrice;
    }
  }

  if (!price) price = regularPrice;
  if (!originalPrice) originalPrice = price;

  return { price, originalPrice, regularPrice, dealLive, ...(dealLabel ? { dealLabel } : {}) };
}

export function withSalaarEffectivePricing(product: any, knowledge: SalaarStoreKnowledge | null, now = new Date()) {
  const pricing = resolveSalaarProductPricing(product, knowledge, now);
  return {
    ...product,
    price: pricing.price,
    salePrice: pricing.price,
    originalPrice: pricing.originalPrice,
    salaarDealLive: pricing.dealLive,
    salaarDealLabel: pricing.dealLabel,
    salaarRegularPrice: pricing.regularPrice,
  };
}
