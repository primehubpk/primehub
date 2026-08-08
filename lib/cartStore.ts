/**
 * lib/cartStore.ts
 * Global cart state using Zustand.
 *
 * Install first:
 *   npm install zustand
 *
 * This store is the single source of truth for:
 *  - cart line items (add / remove / update qty)
 *  - derived totals (count, subtotal)
 *  - free delivery threshold + progress logic
 *  - cart drawer open/close toggle
 *
 * Any component (Header cart badge, ProductGrid add-to-cart buttons,
 * a future CartDrawer) reads from this single store instead of prop-drilling.
 */

import { create } from 'zustand';

// =====================================================================
// SECTION: CONFIG
// =====================================================================
export const FREE_DELIVERY_THRESHOLD = 8; // items needed in cart for free delivery

// =====================================================================
// SECTION: TYPES
// =====================================================================
export interface CartItem {
  id: number;
  name: string;
  price: number;
  originalPrice: number;
  qty: number;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;

  // actions
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  removeItem: (id: number) => void;
  updateQty: (id: number, qty: number) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // derived getters (computed on read, not stored)
  getCartCount: () => number;
  getSubtotal: () => number;
  getItemsToFreeDelivery: () => number;
  getDeliveryProgress: () => number;
}

// =====================================================================
// SECTION: STORE
// =====================================================================
export const useCartStore = create<CartState>((set, get) => ({
  items: [
    // seed with a couple of mock items so the header badge/progress bar
    // has something to show on first load — remove in production
    { id: 101, name: 'Steel Jug Set (2pc)', price: 149, originalPrice: 299, qty: 2 },
    { id: 102, name: 'Bangle Set (6pc)', price: 99, originalPrice: 199, qty: 1 },
  ],
  isDrawerOpen: false,

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, qty: i.qty + 1 } : i
          ),
        };
      }
      return { items: [...state.items, { ...item, qty: 1 }] };
    }),

  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

  updateQty: (id, qty) =>
    set((state) => ({
      items:
        qty <= 0
          ? state.items.filter((i) => i.id !== id)
          : state.items.map((i) => (i.id === id ? { ...i, qty } : i)),
    })),

  clearCart: () => set({ items: [] }),

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

  getCartCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),

  getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),

  getItemsToFreeDelivery: () => {
    const count = get().items.reduce((sum, i) => sum + i.qty, 0);
    return Math.max(0, FREE_DELIVERY_THRESHOLD - count);
  },

  getDeliveryProgress: () => {
    const count = get().items.reduce((sum, i) => sum + i.qty, 0);
    return Math.min(100, Math.round((count / FREE_DELIVERY_THRESHOLD) * 100));
  },
}));
