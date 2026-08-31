import { isWholesaleProduct } from '@/lib/wholesale';

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

export function calculateDeliveryCharge(items: DeliveryItem[]) {
  const wholesaleItems = items.reduce(
    (total, item) => total + (isWholesaleProduct(item) ? quantityOfDeliveryItem(item) : 0),
    0,
  );
  return {
    baseDelivery: BASE_DELIVERY_CHARGE,
    wholesaleItems,
    wholesaleSurcharge: wholesaleItems * WHOLESALE_ITEM_DELIVERY_CHARGE,
    deliveryCharge: BASE_DELIVERY_CHARGE + wholesaleItems * WHOLESALE_ITEM_DELIVERY_CHARGE,
  };
}
