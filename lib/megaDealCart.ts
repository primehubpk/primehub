import type { CartItem } from '@/lib/cartStore';
import type { ProductVariantRow } from '@/lib/types';

const key = (value: unknown) => String(value ?? '').trim().toLowerCase();
export const MAX_MEGA_CART_QUANTITY = 50;

/** Resolve a real row only; never silently choose between different colours. */
export function prepareMegaCartItem(product: Record<string, any>, rows: ProductVariantRow[], size: string, color: string, items: CartItem[], quantity = 1) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_MEGA_CART_QUANTITY) throw new Error('Choose a quantity from 1 to 50.');
  let selected: ProductVariantRow | undefined;
  if (rows.length) {
    if (!size) throw new Error('Please choose a size.');
    const available = rows.filter(row => key(row.size) === key(size) && Number(row.stock) > 0);
    if (!available.length) throw new Error('This size is no longer in stock. Please choose another size.');
    const colors = [...new Set(available.map(row => String(row.color || 'Standard')))];
    if (colors.length > 1 && !color) return { colors, item: null };
    selected = available.find(row => !color || key(row.color) === key(color));
    if (!selected) throw new Error('This colour is no longer available in the selected size.');
  }
  const selection = selected ? { color: selected.color || undefined, size: selected.size || undefined } : undefined;
  const identity = selection ? Object.entries(selection).filter(([, value]) => value).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${name}:${value}`).join('|') : '';
  const id = selection ? `${product.id}:${identity}` : String(product.id);
  const stock = selected ? Number(selected.stock) : Number(product.stock ?? product.quantity ?? 30);
  const existingQuantity = items.find(item => item.id === id)?.qty || 0;
  if (existingQuantity + quantity > MAX_MEGA_CART_QUANTITY) throw new Error('Maximum 50 per option. Reduce the quantity.');
  if (!Number.isFinite(stock) || stock <= 0 || existingQuantity + quantity > stock) {
    throw new Error('No more stock is available for this option.');
  }
  const basePrice = Number(product.price);
  const originalPrice = Number(product.compareAtPrice ?? product.originalPrice ?? basePrice);
  const price = Number(product.megaDealPrice) > 0 || originalPrice > basePrice ? basePrice : Number(selected?.price ?? basePrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error('Product price is unavailable.');
  const image = String(selected?.imageUrl || product.imageUrl || product.image || '');
  const item: Omit<CartItem, 'qty'> = {
    id, productId: String(product.id), category: String(product.category || ''),
    name: String(product.title || product.name || ''), price, originalPrice: originalPrice || price,
    image, imageUrl: image, ...(selection ? { variant: selection } : {}),
    ...(product.bogoOffer ? { bogoOffer: product.bogoOffer } : {}),
  };
  return { colors: [] as string[], item };
}
