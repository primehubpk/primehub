import { normalizeProductVariants } from './productVariants';
export { normalizeProductVariants } from './productVariants';
/** Global persistent cart state + global variant selector trigger. */
import { loadProductForPurchase } from './purchaseProduct';
import { rememberShoppingReturnPath } from './shoppingReturn';
import { FREE_DELIVERY_THRESHOLD } from './deliveryCharges';
export { FREE_DELIVERY_THRESHOLD } from './deliveryCharges';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ProductVariantRow, ProductVariantSelection, Weekday } from '@/lib/types';


type VariantModalImage = string | { url?: string } | Record<string, unknown>;

export interface CartItem {
  id: string | number;
  name: string;
  price: number;
  originalPrice: number;
  image?: string;
  imageUrl?: string;
  qty: number;
  dealDay?: Weekday;
  productId?: string;
  category?: string;
  variant?: ProductVariantSelection;
}

export interface VariantModalProduct {
  id: string;
  title?: string;
  name?: string;
  price?: number | string;
  originalPrice?: number | string;
  compareAtPrice?: number | string;
  imageUrl?: string;
  image?: string;
  images?: VariantModalImage[];
  variantMatrix?: ProductVariantRow[];
  variants?: ProductVariantRow[];
  variantColors?: Array<{ name: string; imageUrl?: string }> | string[];
  variantSizes?: string[];
  colors?: string[];
  sizes?: string[];
  variantOptions?: Array<{ id: string; values: string[] }>;
  hasVariants?: boolean;
  colorImages?: Record<string, string>;
  [key: string]: unknown;
}

export interface NormalizedProductVariants {
  hasVariants: boolean;
  colors: Array<{ name: string; imageUrl?: string }>;
  sizes: string[];
  rows: ProductVariantRow[];
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  isMiniCollapsed: boolean;
  variantModalProduct: VariantModalProduct | null;
  variantModalMode: 'cart' | 'buy' | null;
  cartError: string;
  clearCartError: () => void;
  addItem: (item: Omit<CartItem, 'qty'>, quantity?: number, verifiedProduct?: VariantModalProduct) => Promise<boolean>;
  removeItem: (id: string | number) => void;
  updateQty: (id: string | number, qty: number) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  minimizeCart: () => void;
  expandMiniCart: () => void;
  toggleDrawer: () => void;
  openVariantModal: (product: VariantModalProduct, mode: 'cart' | 'buy') => boolean;
  closeVariantModal: () => void;
  getCartCount: () => number;
  getSubtotal: () => number;
  getItemsToFreeDelivery: () => number;
  getDeliveryProgress: () => number;
}

function variantKey(variant?: ProductVariantSelection): string {
  return variant ? Object.entries(variant).filter(([, value]) => value).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}:${value}`).join('|') : '';
}

function resolveVisibleProductImage(item: Omit<CartItem, 'qty'>): string {
  if (item.image || item.imageUrl || typeof document === 'undefined') return item.image || item.imageUrl || '';
  const match = Array.from(document.images).find((image) => image.alt.trim().toLowerCase() === item.name.trim().toLowerCase());
  return match?.currentSrc || match?.src || '';
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [], isDrawerOpen: false, isMiniCollapsed: false, variantModalProduct: null, variantModalMode: null,
      cartError: '',
      clearCartError: () => set({ cartError: '' }),
      addItem: async (item, quantity = 1, verifiedProduct) => {
        set({ cartError: '' });
        rememberShoppingReturnPath();
        try {
          const productId = String(item.productId || String(item.id).split(':')[0]);
          const product = verifiedProduct?.id === productId ? verifiedProduct : await loadProductForPurchase(productId);
          const variants = normalizeProductVariants(product);
          const selection = item.variant;
          const selected = selection && variants.rows.find(row =>
            (!row.color || row.color === selection.color) && (!row.size || row.size === selection.size));
          if (variants.hasVariants && !selected) {
            if (selection) throw new Error('The selected size/color has changed. Please close the options and choose again.');
            get().openVariantModal({ ...product, price: item.price, originalPrice: item.originalPrice, dealDay: item.dealDay }, 'cart');
            return false;
          }
          const rawStock = selected?.stock ?? product.stock ?? product.quantity;
          const stock = rawStock == null || rawStock === '' ? 30 : Math.max(0, Number(rawStock) || 0);
          if (!Number.isFinite(item.price) || item.price <= 0) throw new Error('Product price is not available.');
          const qty = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
          const variant = variants.hasVariants ? selection : undefined;
          const id = variant ? `${productId}:${variantKey(variant)}` : productId;
          const inCart = get().items.find(current => current.id === id)?.qty || 0;
          if (stock < inCart + qty) throw new Error(stock > 0 ? 'The selected quantity is not available. Please reduce the quantity.' : 'This option is out of stock. Please choose another option.');
          const resolvedImage = resolveVisibleProductImage(item);
          const normalized = { ...item, id, productId, variant, category: String(product.category || item.category || ''), image: item.image || item.imageUrl || resolvedImage, imageUrl: item.imageUrl || item.image || resolvedImage };
          set(state => ({ items: state.items.find(current => current.id === id)
            ? state.items.map(current => current.id === id ? { ...current, ...normalized, qty: current.qty + qty } : current)
            : [...state.items, { ...normalized, qty }], isDrawerOpen: true, isMiniCollapsed: false }));
          return true;
        } catch (error) {
          set({ cartError: error instanceof Error ? error.message : 'Unable to add this product. Please try again.' });
          return false;
        }
      },
      removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      updateQty: (id, qty) => set((state) => ({ items: qty <= 0 ? state.items.filter((item) => item.id !== id) : state.items.map((item) => (item.id === id ? { ...item, qty } : item)) })),
      clearCart: () => set({ items: [], isDrawerOpen: false, isMiniCollapsed: false }),
      openDrawer: () => set({ isDrawerOpen: true, isMiniCollapsed: false }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      minimizeCart: () => set({ isDrawerOpen: false, isMiniCollapsed: true }),
      expandMiniCart: () => set({ isDrawerOpen: true, isMiniCollapsed: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen, isMiniCollapsed: state.isDrawerOpen ? state.isMiniCollapsed : false })),
      openVariantModal: (product, mode) => { const normalized = normalizeProductVariants(product); if (!normalized.hasVariants) return false; set({ variantModalProduct: product, variantModalMode: mode }); return true; },
      closeVariantModal: () => set({ variantModalProduct: null, variantModalMode: null }),
      getCartCount: () => get().items.reduce((sum, item) => sum + item.qty, 0),
      getSubtotal: () => get().items.reduce((sum, item) => sum + item.price * item.qty, 0),
      getItemsToFreeDelivery: () => Math.max(0, FREE_DELIVERY_THRESHOLD - get().items.reduce((sum, item) => sum + item.qty, 0)),
      getDeliveryProgress: () => Math.min(100, Math.round((get().items.reduce((sum, item) => sum + item.qty, 0) / FREE_DELIVERY_THRESHOLD) * 100)),
    }),
    { name: 'phdeals-cart', storage: createJSONStorage(() => localStorage), partialize: (state) => ({ items: state.items }) },
  ),
);

export function getVariantRows(product: VariantModalProduct): ProductVariantRow[] { return normalizeProductVariants(product).rows; }
