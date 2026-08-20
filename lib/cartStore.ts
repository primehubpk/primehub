/** Global persistent cart state + global variant selector trigger. */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ProductVariantRow, ProductVariantSelection, Weekday } from '@/lib/types';

export const FREE_DELIVERY_THRESHOLD = 5;

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
  variant?: ProductVariantSelection;
}

export interface VariantModalProduct {
  id: string;
  title?: string;
  name?: string;
  price?: number;
  originalPrice?: number;
  compareAtPrice?: number;
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
  addItem: (item: Omit<CartItem, 'qty'>) => void;
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

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') return String(item).trim();
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const value = record.name ?? record.value ?? record.label ?? record.title;
        return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
      }
      return '';
    })
    .filter(Boolean);
}

function rowValue(row: ProductVariantRow, key: 'color' | 'size'): string {
  const record = row as Record<string, unknown>;
  const direct = record[key] ?? record[`variant${key[0].toUpperCase()}${key.slice(1)}`];

  if (typeof direct === 'string' || typeof direct === 'number') return String(direct).trim();

  if (record.options && typeof record.options === 'object') {
    const options = record.options as Record<string, unknown>;
    const value = options[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  }

  return '';
}

function rowImage(row: ProductVariantRow, color: string, colorImageMap: Record<string, string>, colorItems: Array<{ name: string; imageUrl?: string }>): string | undefined {
  if (typeof row.imageUrl === 'string' && row.imageUrl) return row.imageUrl;
  if (colorImageMap[color]) return colorImageMap[color];
  return colorItems.find((item) => item.name === color)?.imageUrl || undefined;
}

/**
 * Single source of truth for all product variant shapes saved by the admin.
 * It preserves configured color/size order, hydrates matrix rows, and fills
 * missing matrix combinations from the configured option lists.
 */
export function normalizeProductVariants(product: VariantModalProduct): NormalizedProductVariants {
  const directRows = Array.isArray(product.variants) ? product.variants : [];
  const matrixRows = Array.isArray(product.variantMatrix) ? product.variantMatrix : [];
  const sourceRows = [...directRows, ...matrixRows];

  const colorItems: Array<{ name: string; imageUrl?: string }> = [];
  const addColor = (name: string, imageUrl?: string) => {
    const clean = name.trim();
    if (!clean) return;
    const existing = colorItems.find((item) => item.name === clean);
    if (existing) {
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
      return;
    }
    colorItems.push({ name: clean, imageUrl });
  };

  if (Array.isArray(product.variantColors)) {
    product.variantColors.forEach((item) => {
      if (typeof item === 'string') {
        addColor(item, product.colorImages?.[item]);
      } else if (item && typeof item === 'object') {
        addColor(item.name, item.imageUrl || product.colorImages?.[item.name]);
      }
    });
  }

  asStrings(product.colors).forEach((color) => addColor(color, product.colorImages?.[color]));

  const optionColors = product.variantOptions?.find((option) => /color/i.test(String(option.id)))?.values;
  asStrings(optionColors).forEach((color) => addColor(color, product.colorImages?.[color]));

  const rawRows = sourceRows.map((row, index) => ({
    ...row,
    id: row.id || `variant-${index}`,
    color: rowValue(row, 'color'),
    size: rowValue(row, 'size'),
  }));

  rawRows.forEach((row) => {
    if (row.color) addColor(row.color, rowImage(row, row.color, product.colorImages || {}, colorItems));
  });

  const sizes: string[] = [];
  const addSize = (value: string) => {
    const clean = value.trim();
    if (clean && !sizes.includes(clean)) sizes.push(clean);
  };

  asStrings(product.variantSizes).forEach(addSize);
  asStrings(product.sizes).forEach(addSize);

  const optionSizes = product.variantOptions?.find((option) => /size/i.test(String(option.id)))?.values;
  asStrings(optionSizes).forEach(addSize);
  rawRows.forEach((row) => row.size && addSize(row.size));

  const hasVariantMetadata = Boolean(
    product.hasVariants === true ||
      colorItems.length > 0 ||
      sizes.length > 0 ||
      sourceRows.length > 0,
  );

  if (!hasVariantMetadata) {
    return { hasVariants: false, colors: [], sizes: [], rows: [] };
  }

  if (!colorItems.length) addColor('Standard', product.imageUrl || product.image);
  if (!sizes.length) addSize('Standard');

  const rowMap = new Map<string, ProductVariantRow>();
  rawRows.forEach((row) => {
    const color = row.color || colorItems[0].name;
    const size = row.size || sizes[0];
    const key = `${color}::${size}`;
    if (rowMap.has(key)) return;

    rowMap.set(key, {
      ...row,
      color,
      size,
      stock: Math.max(0, Number(row.stock ?? 0)),
      price: row.price == null ? product.price : Number(row.price),
      imageUrl: rowImage(row, color, product.colorImages || {}, colorItems),
    });
  });

  // Preserve every configured Color × Size combination. Existing matrix rows
  // retain their exact stock/price/image; missing rows remain visible but are
  // marked unavailable instead of disappearing from the selector.
  const rows = colorItems.flatMap((color) =>
    sizes.map((size) => {
      const key = `${color.name}::${size}`;
      return (
        rowMap.get(key) || {
          id: `variant-${encodeURIComponent(color.name)}-${encodeURIComponent(size)}`,
          color: color.name,
          size,
          stock: 0,
          price: product.price,
          imageUrl: color.imageUrl,
        }
      );
    }),
  );

  return { hasVariants: true, colors: colorItems, sizes, rows };
}

function variantKey(variant?: ProductVariantSelection): string {
  return variant
    ? Object.entries(variant)
        .filter(([, value]) => value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${value}`)
        .join('|')
    : '';
}

function resolveVisibleProductImage(item: Omit<CartItem, 'qty'>): string {
  if (item.image || item.imageUrl || typeof document === 'undefined') {
    return item.image || item.imageUrl || '';
  }

  const match = Array.from(document.images).find(
    (image) => image.alt.trim().toLowerCase() === item.name.trim().toLowerCase(),
  );
  return match?.currentSrc || match?.src || '';
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,
      isMiniCollapsed: false,
      variantModalProduct: null,
      variantModalMode: null,
      addItem: (item) => {
        const resolvedImage = resolveVisibleProductImage(item);
        const normalized = {
          ...item,
          id: item.id || `${item.productId || ''}:${variantKey(item.variant)}`,
          image: item.image || item.imageUrl || resolvedImage,
          imageUrl: item.imageUrl || item.image || resolvedImage,
        };

        set((state) => {
          const existing = state.items.find((current) => current.id === normalized.id);
          return {
            items: existing
              ? state.items.map((current) =>
                  current.id === normalized.id
                    ? { ...current, ...normalized, qty: current.qty + 1 }
                    : current,
                )
              : [...state.items, { ...normalized, qty: 1 }],
            isDrawerOpen: true,
            isMiniCollapsed: false,
          };
        });
      },
      removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      updateQty: (id, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((item) => item.id !== id)
              : state.items.map((item) => (item.id === id ? { ...item, qty } : item)),
        })),
      clearCart: () => set({ items: [], isDrawerOpen: false, isMiniCollapsed: false }),
      openDrawer: () => set({ isDrawerOpen: true, isMiniCollapsed: false }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      minimizeCart: () => set({ isDrawerOpen: false, isMiniCollapsed: true }),
      expandMiniCart: () => set({ isDrawerOpen: true, isMiniCollapsed: false }),
      toggleDrawer: () =>
        set((state) => ({
          isDrawerOpen: !state.isDrawerOpen,
          isMiniCollapsed: state.isDrawerOpen ? state.isMiniCollapsed : false,
        })),
      openVariantModal: (product, mode) => {
        const normalized = normalizeProductVariants(product);
        if (!normalized.hasVariants) return false;
        set({ variantModalProduct: product, variantModalMode: mode });
        return true;
      },
      closeVariantModal: () => set({ variantModalProduct: null, variantModalMode: null }),
      getCartCount: () => get().items.reduce((sum, item) => sum + item.qty, 0),
      getSubtotal: () => get().items.reduce((sum, item) => sum + item.price * item.qty, 0),
      getItemsToFreeDelivery: () =>
        Math.max(0, FREE_DELIVERY_THRESHOLD - get().items.reduce((sum, item) => sum + item.qty, 0)),
      getDeliveryProgress: () =>
        Math.min(
          100,
          Math.round(
            (get().items.reduce((sum, item) => sum + item.qty, 0) / FREE_DELIVERY_THRESHOLD) * 100,
          ),
        ),
    }),
    {
      name: 'phdeals-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

export function getVariantRows(product: VariantModalProduct): ProductVariantRow[] {
  return normalizeProductVariants(product).rows;
}
