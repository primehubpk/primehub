import type { ProductVariantRow } from './types';
import type { VariantModalProduct, NormalizedProductVariants } from './cartStore';

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

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
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

function findColorImage(color: string, colorImageMap: Record<string, string>): string | undefined {
  const wanted = normalizeKey(color);
  const match = Object.entries(colorImageMap).find(([name, url]) => normalizeKey(name) === wanted && typeof url === 'string' && url);
  return match?.[1];
}

function rowImage(row: ProductVariantRow, color: string, colorImageMap: Record<string, string>, colorItems: Array<{ name: string; imageUrl?: string }>): string | undefined {
  if (typeof row.imageUrl === 'string' && row.imageUrl) return row.imageUrl;
  return findColorImage(color, colorImageMap) || colorItems.find((item) => normalizeKey(item.name) === normalizeKey(color))?.imageUrl || undefined;
}

export function normalizeProductVariants(product: VariantModalProduct): NormalizedProductVariants {
  const directRows = Array.isArray(product.variants) ? product.variants : [];
  const matrixRows = Array.isArray(product.variantMatrix) ? product.variantMatrix : [];
  const allSourceRows = matrixRows.length ? matrixRows : directRows;
  const sourceRows = allSourceRows.filter((row) => {
    const record = row as Record<string, unknown>;
    return Boolean(record) && record.active !== false && record.hidden !== true;
  });
  const colorItems: Array<{ name: string; imageUrl?: string }> = [];
  const addColor = (name: string, imageUrl?: string) => {
    const clean = name.trim();
    if (!clean) return;
    const existing = colorItems.find((item) => normalizeKey(item.name) === normalizeKey(clean));
    if (existing) {
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
      return;
    }
    colorItems.push({ name: clean, imageUrl });
  };
  if (Array.isArray(product.variantColors)) product.variantColors.forEach((item) => {
    if (typeof item === 'string') addColor(item, findColorImage(item, product.colorImages || {}));
    else if (item && typeof item === 'object') addColor(item.name, item.imageUrl || findColorImage(item.name, product.colorImages || {}));
  });
  asStrings(product.colors).forEach((color) => addColor(color, findColorImage(color, product.colorImages || {})));
  const optionColors = product.variantOptions?.find((option) => /color/i.test(String(option.id)))?.values;
  asStrings(optionColors).forEach((color) => addColor(color, findColorImage(color, product.colorImages || {})));
  const sizes: string[] = [];
  const addSize = (value: string) => {
    const clean = value.trim();
    if (clean && !sizes.some((item) => normalizeKey(item) === normalizeKey(clean))) sizes.push(clean);
  };
  asStrings(product.variantSizes).forEach(addSize);
  asStrings(product.sizes).forEach(addSize);
  const optionSizes = product.variantOptions?.find((option) => /size/i.test(String(option.id)))?.values;
  asStrings(optionSizes).forEach(addSize);
  const hasVariantRows = sourceRows.length > 0;
  if (!hasVariantRows) return { hasVariants: false, colors: [], sizes: [], rows: [] };
  if (!colorItems.length) addColor('Standard', product.imageUrl || product.image);
  if (!sizes.length) addSize('Standard');

  const rawParentStock = product.stock ?? product.quantity;
  const parentStock =
    rawParentStock == null || rawParentStock === ''
      ? 30
      : Math.max(0, Number(rawParentStock) || 0);

  const rawRows = sourceRows.map((row, index) => {
    const color = rowValue(row, 'color') || colorItems[0]?.name || 'Standard';
    const size = rowValue(row, 'size') || sizes[0] || 'Standard';
    return {
      ...row,
      id: row.id || `variant-${index}`,
      color,
      size,
      stock:
        row.stock == null || row.stock === ''
          ? parentStock
          : Math.max(0, Number(row.stock) || 0),
      price: row.price == null ? Number(product.price ?? 0) : Number(row.price),
      imageUrl: rowImage(row, color, product.colorImages || {}, colorItems),
    };
  });

  const rowMap = new Map<string, ProductVariantRow>();
  rawRows.forEach((row) => {
    const key = `${normalizeKey(row.color)}::${normalizeKey(row.size)}`;
    if (!rowMap.has(key)) rowMap.set(key, row);
  });
  const rows = Array.from(rowMap.values());
  const activeColorKeys = new Set(rows.map((row) => normalizeKey(row.color)));
  const activeSizeKeys = new Set(rows.map((row) => normalizeKey(row.size)));
  const visibleColors = colorItems.filter((item) => activeColorKeys.has(normalizeKey(item.name)));
  rows.forEach((row) => {
    const name = String(row.color || '').trim();
    if (name && !visibleColors.some((item) => normalizeKey(item.name) === normalizeKey(name))) {
      visibleColors.push({ name, imageUrl: rowImage(row, name, product.colorImages || {}, colorItems) });
    }
  });
  const visibleSizes = sizes.filter((size) => activeSizeKeys.has(normalizeKey(size)));
  rows.forEach((row) => {
    const size = String(row.size || '').trim();
    if (size && !visibleSizes.some((item) => normalizeKey(item) === normalizeKey(size))) visibleSizes.push(size);
  });
  return { hasVariants: true, colors: visibleColors, sizes: visibleSizes, rows };
}

