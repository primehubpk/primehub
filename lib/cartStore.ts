/**
 * lib/cartStore.ts
 * Global cart state using Zustand.
 * Persistent single source of truth for customer cart line items.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Weekday } from '@/lib/types';

export const FREE_DELIVERY_THRESHOLD = 5;

export interface CartItem {
  id: string | number;
  name: string;
  price: number;
  originalPrice: number;
  image?: string;
  imageUrl?: string;
  qty: number;
  dealDay?: Weekday;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  isMiniCollapsed: boolean;
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  removeItem: (id: string | number) => void;
  updateQty: (id: string | number, qty: number) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  minimizeCart: () => void;
  expandMiniCart: () => void;
  toggleDrawer: () => void;
  getCartCount: () => number;
  getSubtotal: () => number;
  getItemsToFreeDelivery: () => number;
  getDeliveryProgress: () => number;
}

function resolveVisibleProductImage(item: Omit<CartItem, 'qty'>) {
  if (item.image || item.imageUrl || typeof document === 'undefined') return item.image || item.imageUrl || '';
  const images = Array.from(document.images);
  const match = images.find((image) => image.alt.trim().toLowerCase() === item.name.trim().toLowerCase());
  return match?.currentSrc || match?.src || '';
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,
      isMiniCollapsed: false,
      addItem: (item) => {
        const resolvedImage = resolveVisibleProductImage(item);
        const normalized = {
          ...item,
          image: item.image || item.imageUrl || resolvedImage,
          imageUrl: item.imageUrl || item.image || resolvedImage,
        };
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);
          return {
            items: existing
              ? state.items.map((i) => i.id === item.id ? { ...i, ...normalized, qty: i.qty + 1 } : i)
              : [...state.items, { ...normalized, qty: 1 }],
            isDrawerOpen: true,
            isMiniCollapsed: false,
          };
        });
      },
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateQty: (id, qty) => set((state) => ({
        items: qty <= 0 ? state.items.filter((i) => i.id !== id) : state.items.map((i) => i.id === id ? { ...i, qty } : i),
      })),
      clearCart: () => set({ items: [], isDrawerOpen: false, isMiniCollapsed: false }),
      openDrawer: () => set({ isDrawerOpen: true, isMiniCollapsed: false }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      minimizeCart: () => set({ isDrawerOpen: false, isMiniCollapsed: true }),
      expandMiniCart: () => set({ isDrawerOpen: true, isMiniCollapsed: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen, isMiniCollapsed: state.isDrawerOpen ? state.isMiniCollapsed : false })),
      getCartCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
      getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
      getItemsToFreeDelivery: () => Math.max(0, FREE_DELIVERY_THRESHOLD - get().items.reduce((sum, i) => sum + i.qty, 0)),
      getDeliveryProgress: () => Math.min(100, Math.round((get().items.reduce((sum, i) => sum + i.qty, 0) / FREE_DELIVERY_THRESHOLD) * 100)),
    }),
    {
      name: 'phdeals-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
