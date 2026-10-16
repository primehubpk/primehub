import { isWholesaleProduct } from '@/lib/wholesale';

export const BASE_DELIVERY_CHARGE = 350;
export const FREE_DELIVERY_QUANTITY = 5;
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
  const totalQuantity = items.reduce((count, item) => count + quantityOfDeliveryItem(item), 0);
  // Five total units, including different variants and wholesale packs, unlock
  // FREE delivery. Compute on server-verified items as well as cart previews.
  const freeDelivery = totalQuantity >= FREE_DELIVERY_QUANTITY;
  return {
    baseDelivery: freeDelivery ? 0 : BASE_DELIVERY_CHARGE,
    wholesaleItems,
    wholesaleSurcharge: freeDelivery ? 0 : wholesaleItems * WHOLESALE_ITEM_DELIVERY_CHARGE,
    deliveryCharge: freeDelivery ? 0 : BASE_DELIVERY_CHARGE + wholesaleItems * WHOLESALE_ITEM_DELIVERY_CHARGE,
  };
}
