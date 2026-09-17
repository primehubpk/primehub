from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Expected block not found: {label}")
    return text.replace(old, new, 1)


# 1) Bulk editor: add per-variant Hide / Unhide state + buttons.
path = Path("components/admin/BulkProductEditor.tsx")
text = path.read_text()
text = replace_once(
    text,
    "import { ImagePlus, Loader2, PackageSearch, Pencil, Save, Search, Star, Trash2 } from 'lucide-react';",
    "import { Eye, EyeOff, ImagePlus, Loader2, PackageSearch, Pencil, Save, Search, Star, Trash2 } from 'lucide-react';",
    "bulk icon import",
)
text = replace_once(
    text,
    """type VariantDraft = {
  id: string;
  color: string;
  size: string;
  stock: string;
  imageUrl: string;
  raw: Record<string, unknown>;
};""",
    """type VariantDraft = {
  id: string;
  color: string;
  size: string;
  stock: string;
  imageUrl: string;
  active: boolean;
  raw: Record<string, unknown>;
};""",
    "VariantDraft active",
)
text = replace_once(
    text,
    """        stock: String(row?.stock ?? legacyStock ?? 0),
        imageUrl: String(row?.imageUrl || colorImages[color] || fallbackImage || ''),
        raw: row && typeof row === 'object' ? { ...row } : {},""",
    """        stock: String(row?.stock ?? legacyStock ?? 0),
        imageUrl: String(row?.imageUrl || colorImages[color] || fallbackImage || ''),
        active: row?.active !== false && row?.hidden !== true,
        raw: row && typeof row === 'object' ? { ...row } : {},""",
    "loaded row active",
)
text = replace_once(
    text,
    """    stock: String(legacyStock ?? 0),
    imageUrl: colorPhoto(color),
    raw: {},""",
    """    stock: String(legacyStock ?? 0),
    imageUrl: colorPhoto(color),
    active: true,
    raw: {},""",
    "generated row active",
)
text = replace_once(
    text,
    """      && variant.stock === other.stock
      && variant.imageUrl === other.imageUrl;""",
    """      && variant.stock === other.stock
      && variant.imageUrl === other.imageUrl
      && variant.active === other.active;""",
    "draft compare active",
)
text = replace_once(
    text,
    """      imageUrl: variant.imageUrl,
      price: String(price),""",
    """      imageUrl: variant.imageUrl,
      price: String(price),
      active: variant.active !== false,
      hidden: variant.active === false,""",
    "save active",
)
text = replace_once(
    text,
    """        imageUrl: seed?.imageUrl || draft.images[0] || '',
        raw: {},""",
    """        imageUrl: seed?.imageUrl || draft.images[0] || '',
        active: true,
        raw: {},""",
    "new preset active",
)
text = replace_once(
    text,
    """  function removeVariant(index: number) {
    onChange({ ...draft, variants: draft.variants.filter((_, variantIndex) => variantIndex !== index) });
    setEditingVariantIndex(null);
    setRowMessage('Only this variant was removed. Press Save to keep the change.');
  }

  function sizePresetComplete""",
    """  function removeVariant(index: number) {
    onChange({ ...draft, variants: draft.variants.filter((_, variantIndex) => variantIndex !== index) });
    setEditingVariantIndex(null);
    setRowMessage('Only this variant was removed. Press Save to keep the change.');
  }

  function toggleVariantVisibility(index: number) {
    const variant = draft.variants[index];
    if (!variant) return;
    const nextActive = variant.active === false;
    updateVariant(index, { active: nextActive });
    setRowMessage(nextActive
      ? 'Variant is visible again. Press Save to keep the change.'
      : 'Variant hidden from customers. Press Save to keep the change.');
  }

  function sizePresetComplete""",
    "toggle function",
)
text = replace_once(
    text,
    """              <div className="col-span-4 flex justify-end gap-1.5">
                <button type="button" onClick={() => setEditingVariantIndex(null)} className="rounded-lg bg-[#0F6A5F] px-3 py-2 text-[8px] font-black text-white">Done</button>
                <button type="button" disabled={disabled} onClick={() => removeVariant(index)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-[8px] font-black text-[#E1352B] disabled:opacity-40"><Trash2 size={10}/>Delete</button>
              </div>""",
    """              <div className="col-span-4 flex flex-wrap justify-end gap-1.5">
                <button type="button" onClick={() => setEditingVariantIndex(null)} className="rounded-lg bg-[#0F6A5F] px-3 py-2 text-[8px] font-black text-white">Done</button>
                <button type="button" disabled={disabled} onClick={() => removeVariant(index)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-[8px] font-black text-[#E1352B] disabled:opacity-40"><Trash2 size={10}/>Delete</button>
                <button type="button" disabled={disabled} onClick={() => toggleVariantVisibility(index)} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[8px] font-black disabled:opacity-40 ${variant.active === false ? 'bg-[#0F6A5F]/10 text-[#0F6A5F]' : 'bg-amber-50 text-amber-700'}`}>{variant.active === false ? <Eye size={10}/> : <EyeOff size={10}/>} {variant.active === false ? 'Unhide' : 'Hide'}</button>
              </div>""",
    "editing hide button",
)
text = replace_once(
    text,
    """              <button type="button" disabled={disabled} onClick={() => setEditingVariantIndex(index)} className="inline-flex items-center gap-1 rounded-lg bg-[#0F6A5F]/10 px-2.5 py-2 text-[8px] font-black text-[#0F6A5F] disabled:opacity-40"><Pencil size={10}/>Edit</button>
              <button type="button" disabled={disabled} onClick={() => removeVariant(index)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-2 text-[8px] font-black text-[#E1352B] disabled:opacity-40"><Trash2 size={10}/>Delete</button>""",
    """              <div className="flex shrink-0 flex-col gap-1.5">
                <div className="flex gap-1.5">
                  <button type="button" disabled={disabled} onClick={() => setEditingVariantIndex(index)} className="inline-flex items-center gap-1 rounded-lg bg-[#0F6A5F]/10 px-2.5 py-2 text-[8px] font-black text-[#0F6A5F] disabled:opacity-40"><Pencil size={10}/>Edit</button>
                  <button type="button" disabled={disabled} onClick={() => removeVariant(index)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-2 text-[8px] font-black text-[#E1352B] disabled:opacity-40"><Trash2 size={10}/>Delete</button>
                </div>
                <button type="button" disabled={disabled} onClick={() => toggleVariantVisibility(index)} className={`inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-[8px] font-black disabled:opacity-40 ${variant.active === false ? 'bg-[#0F6A5F]/10 text-[#0F6A5F]' : 'bg-amber-50 text-amber-700'}`}>{variant.active === false ? <Eye size={10}/> : <EyeOff size={10}/>} {variant.active === false ? 'Unhide' : 'Hide'}</button>
              </div>""",
    "row hide button",
)
text = replace_once(
    text,
    """                <p className="mt-0.5 text-[8px] font-bold text-black/40">Stock: {variant.stock || '0'}</p>""",
    """                <p className="mt-0.5 flex items-center gap-1.5 text-[8px] font-bold text-black/40">Stock: {variant.stock || '0'}{variant.active === false ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[7px] font-black text-amber-700">HIDDEN</span> : null}</p>""",
    "hidden badge",
)
path.write_text(text)


# 2) Storefront: ignore rows marked active:false / hidden:true, and do not recreate them.
path = Path("lib/cartStore.ts")
text = path.read_text()
pattern = re.compile(r"export function normalizeProductVariants\(product: VariantModalProduct\): NormalizedProductVariants \{.*?\n\}\n\nfunction variantKey", re.S)
replacement = """export function normalizeProductVariants(product: VariantModalProduct): NormalizedProductVariants {
  const directRows = Array.isArray(product.variants) ? product.variants : [];
  const matrixRows = Array.isArray(product.variantMatrix) ? product.variantMatrix : [];
  const allSourceRows = matrixRows.length ? matrixRows : directRows;
  const sourceRows = allSourceRows.filter((row) => {
    const record = row as Record<string, unknown>;
    return record.active !== false && record.hidden !== true;
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
  const hasVariantMetadata = Boolean(product.hasVariants === true || colorItems.length > 0 || sizes.length > 0 || allSourceRows.length > 0);
  if (!hasVariantMetadata) return { hasVariants: false, colors: [], sizes: [], rows: [] };
  if (!colorItems.length) addColor('Standard', product.imageUrl || product.image);
  if (!sizes.length) addSize('Standard');

  const rawRows = sourceRows.map((row, index) => {
    const color = rowValue(row, 'color') || colorItems[0]?.name || 'Standard';
    const size = rowValue(row, 'size') || sizes[0] || 'Standard';
    return {
      ...row,
      id: row.id || `variant-${index}`,
      color,
      size,
      stock: Math.max(0, Number(row.stock ?? 0)),
      price: row.price == null ? Number(product.price ?? 0) : Number(row.price),
      imageUrl: rowImage(row, color, product.colorImages || {}, colorItems),
    };
  });

  if (!allSourceRows.length) {
    const rows = colorItems.flatMap((color) => sizes.map((size) => ({
      id: `variant-${encodeURIComponent(color.name)}-${encodeURIComponent(size)}`,
      color: color.name,
      size,
      stock: 0,
      price: Number(product.price ?? 0),
      imageUrl: color.imageUrl,
    })));
    return { hasVariants: true, colors: colorItems, sizes, rows };
  }

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

function variantKey"""
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit("normalizeProductVariants patch failed")
path.write_text(text)


# 3) Product detail: keep variant mode active even if all rows are temporarily hidden.
path = Path("components/product-detail/useProductDetail.ts")
text = path.read_text()
text = replace_once(
    text,
    "import { getVariantRows, useCartStore } from '@/lib/cartStore';",
    "import { normalizeProductVariants, useCartStore } from '@/lib/cartStore';",
    "detail import",
)
text = replace_once(
    text,
    "  const variantRows = useMemo(() => (product ? getVariantRows(product) : []), [product]);",
    """  const normalizedVariants = useMemo(
    () => product ? normalizeProductVariants(product) : { hasVariants: false, colors: [], sizes: [], rows: [] },
    [product],
  );
  const variantRows = normalizedVariants.rows;""",
    "detail normalized rows",
)
text = replace_once(
    text,
    "  const hasVariants = variantRows.length > 0;",
    "  const hasVariants = normalizedVariants.hasVariants;",
    "detail hasVariants",
)
path.write_text(text)


# 4) Preserve hidden state if later edited through the full Products manager.
path = Path("components/admin/products/ProductTypes.ts")
text = path.read_text()
text = replace_once(
    text,
    "export type VariantRow={id:string;color:string;size:string;stock:string;imageUrl:string};",
    "export type VariantRow={id:string;color:string;size:string;stock:string;imageUrl:string;active?:boolean;hidden?:boolean};",
    "VariantRow fields",
)
path.write_text(text)

path = Path("components/admin/products/useProductsManager.ts")
text = path.read_text()
text = replace_once(
    text,
    """          stock: old?.stock ?? (form.stock || '10'),
          imageUrl: color.imageUrl || form.images[0] || '',""",
    """          stock: old?.stock ?? (form.stock || '10'),
          imageUrl: color.imageUrl || form.images[0] || '',
          active: old?.active !== false && old?.hidden !== true,
          hidden: old?.active === false || old?.hidden === true,""",
    "manager generated visibility",
)
text = replace_once(
    text,
    """        imageUrl: row.imageUrl || colorMap[row.color] || firstImg || '',
      }))""",
    """        imageUrl: row.imageUrl || colorMap[row.color] || firstImg || '',
        active: row.active !== false && row.hidden !== true,
        hidden: row.active === false || row.hidden === true,
      }))""",
    "manager loaded visibility",
)
text = replace_once(
    text,
    "const variantMatrix = variantRows.map(row => ({ id: row.id, label: `${row.color} / ${row.size}`, color: row.color, size: row.size, stock: Math.max(0, Number(row.stock || 0)), imageUrl: row.imageUrl || colorImages[row.color] || form.images[0] || '', sku: '', price: String(salePrice), salePrice: '', active: true }));",
    "const variantMatrix = variantRows.map(row => ({ id: row.id, label: `${row.color} / ${row.size}`, color: row.color, size: row.size, stock: Math.max(0, Number(row.stock || 0)), imageUrl: row.imageUrl || colorImages[row.color] || form.images[0] || '', sku: '', price: String(salePrice), salePrice: '', active: row.active !== false && row.hidden !== true, hidden: row.active === false || row.hidden === true }));",
    "manager save visibility",
)
path.write_text(text)

# Remove temporary patch machinery before committing the real change.
for temporary in [
    ".github/workflows/temp-variant-hide-patch.yml",
    ".github/scripts/variant_hide_patch.py",
    ".github/variant-hide-trigger.txt",
]:
    temp_path = Path(temporary)
    if temp_path.exists():
        temp_path.unlink()
