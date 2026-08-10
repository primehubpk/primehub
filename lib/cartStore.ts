/**
 * lib/cartStore.ts
 * Global cart state using Zustand.
 * Persistent single source of truth for customer cart line items.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const FREE_DELIVERY_THRESHOLD = 5;

export interface CartItem {
  id: string | number;
  name: string;
  price: number;
  originalPrice: number;
  image?: string;
  imageUrl?: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  removeItem: (id: string | number) => void;
  updateQty: (id: string | number, qty: number) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  getCartCount: () => number;
  getSubtotal: () => number;
  getItemsToFreeDelivery: () => number;
  getDeliveryProgress: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,
      // Keep the customer on the page after adding. The persistent bottom mini-cart provides cart actions.
      addItem: (item) => set((state) => {
        const existing = state.items.find((i) => i.id === item.id);
        return {
          items: existing
            ? state.items.map((i) => i.id === item.id ? { ...i, ...item, qty: i.qty + 1 } : i)
            : [...state.items, { ...item, qty: 1 }],
          isDrawerOpen: false,
        };
      }),
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateQty: (id, qty) => set((state) => ({
        items: qty <= 0 ? state.items.filter((i) => i.id !== id) : state.items.map((i) => i.id === id ? { ...i, qty } : i),
      })),
      clearCart: () => set({ items: [], isDrawerOpen: false }),
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
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
