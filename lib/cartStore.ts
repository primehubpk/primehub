/**
 * lib/cartStore.ts
 * Global persistent cart state for the customer experience.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

type NewCartItem = Omit<CartItem, 'qty'>;

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  addItem: (item: NewCartItem) => void;
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

const imageCache = new Map<string, string>();

function normalizeImage(data: any): string {
  return data?.imageUrl || data?.image || (Array.isArray(data?.images) ? data.images[0] : '') || '';
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,

      addItem: (item) => {
        const id = item.id;
        const existing = get().items.find((cartItem) => cartItem.id === id);
        const suppliedImage = item.imageUrl || item.image || '';

        // Add immediately so the UI never waits for a network request. If the
        // caller did not provide an image (for example a product-detail page),
        // resolve it from the same Firebase product record in the background.
        set((state) => ({
          items: existing
            ? state.items.map((cartItem) => cartItem.id === id ? { ...cartItem, ...item, qty: cartItem.qty + 1 } : cartItem)
            : [...state.items, { ...item, qty: 1 }],
          isDrawerOpen: false,
        }));

        if (!suppliedImage && !imageCache.has(String(id))) {
          void getDoc(doc(db, 'products', String(id))).then((snap) => {
            if (!snap.exists()) return;
            const image = normalizeImage(snap.data());
            if (!image) return;
            imageCache.set(String(id), image);
            set((state) => ({
              items: state.items.map((cartItem) => cartItem.id === id
                ? { ...cartItem, image, imageUrl: image }
                : cartItem),
            }));
          }).catch(() => undefined);
        } else if (!suppliedImage && imageCache.has(String(id))) {
          const image = imageCache.get(String(id))!;
          set((state) => ({ items: state.items.map((cartItem) => cartItem.id === id ? { ...cartItem, image, imageUrl: image } : cartItem) }));
        } else if (suppliedImage) {
          imageCache.set(String(id), suppliedImage);
        }
      },

      removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      updateQty: (id, qty) => set((state) => ({
        items: qty <= 0
          ? state.items.filter((item) => item.id !== id)
          : state.items.map((item) => item.id === id ? { ...item, qty } : item),
      })),
      clearCart: () => set({ items: [], isDrawerOpen: false }),
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
      getCartCount: () => get().items.reduce((sum, item) => sum + item.qty, 0),
      getSubtotal: () => get().items.reduce((sum, item) => sum + item.price * item.qty, 0),
      getItemsToFreeDelivery: () => Math.max(0, FREE_DELIVERY_THRESHOLD - get().items.reduce((sum, item) => sum + item.qty, 0)),
      getDeliveryProgress: () => Math.min(100, Math.round((get().items.reduce((sum, item) => sum + item.qty, 0) / FREE_DELIVERY_THRESHOLD) * 100)),
    }),
    {
      name: 'phdeals-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
