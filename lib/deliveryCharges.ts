import { isWholesaleProduct } from '@/lib/wholesale';

export const FREE_DELIVERY_THRESHOLD = 5;
export type FreeDeliverySettings = { enabled?: boolean; itemThreshold?: number };
export function freeDeliveryPolicy(settings?: FreeDeliverySettings) {
  const value = Number(settings?.itemThreshold);
  return { enabled: settings?.enabled !== false, threshold: Number.isFinite(value) && value > 0 ? Math.floor(value) : FREE_DELIVERY_THRESHOLD };
}

export const BASE_DELIVERY_CHARGE = 350;
export const WHOLESALE_ITEM_DELIVERY_CHARGE = 30;

type DeliveryItem = {
  quantity?: number;
  qty?: number;
  isWholesale?: unknown;
  category?: unknown;
  categoryId?: unknown;
};

export function quantityOfDeliveryItem(item: DeliveryItem) {
  return Math.max(1, Math.floor(Number(item.quantity ?? item.qty ?? 1) || 1));
}

export function calculateDeliveryCharge(items: DeliveryItem[], settings?: FreeDeliverySettings) {
  const wholesaleItems = items.reduce(
    (total, item) => total + (isWholesaleProduct(item) ? quantityOfDeliveryItem(item) : 0),
    0,
  );
  const policy = freeDeliveryPolicy(settings);
  const totalItems = items.reduce((sum, item) => sum + quantityOfDeliveryItem(item), 0);
  const freeDelivery = policy.enabled && totalItems >= policy.threshold;
  return {
    freeDelivery,
    baseDelivery: freeDelivery ? 0 : BASE_DELIVERY_CHARGE,
    wholesaleItems,
    wholesaleSurcharge: freeDelivery ? 0 : wholesaleItems * WHOLESALE_ITEM_DELIVERY_CHARGE,
    deliveryCharge: freeDelivery ? 0 : BASE_DELIVERY_CHARGE + wholesaleItems * WHOLESALE_ITEM_DELIVERY_CHARGE,
  };
}
