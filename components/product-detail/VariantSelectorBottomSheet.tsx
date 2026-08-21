'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, X, Zap } from 'lucide-react';
import type { ProductVariantRow, ProductVariantSelection } from '@/lib/types';
import { normalizeProductVariants, type VariantModalProduct } from '@/lib/cartStore';
import { money, titleOf } from './ProductDetailTypes';

type Props = {
  product: VariantModalProduct;
  rows: ProductVariantRow[];
  open: boolean;
  mode: 'cart' | 'buy';
  quantity: number;
  currentPrice: number;
  originalPrice: number;
  onClose: () => void;
  onConfirm: (selection: ProductVariantSelection, quantity: number) => void;
};

function stockOf(row?: ProductVariantRow) {
  return Math.max(0, Number(row?.stock ?? 0));
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function imageValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'url' in value) {
    const url = (value as { url?: unknown }).url;
    return typeof url === 'string' ? url : '';
  }
  return '';
}

export default function VariantSelectorBottomSheet({
  product,
  rows,
  open,
  mode,
  quantity,
  currentPrice,
  originalPrice,
  onClose,
  onConfirm,
}: Props) {
  const normalized = useMemo(() => normalizeProductVariants(product), [product]);
  const effectiveRows = useMemo(() => {
    if (normalized.rows.length) return normalized.rows;
    return rows;
  }, [normalized.rows, rows]);

  const colors = normalized.colors;
  const sizes = normalized.sizes;
  const colorNames = useMemo(() => colors.map((item) => item.name), [colors]);

  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(Math.max(1, quantity));

  useEffect(() => {
    if (!open) return;
    setColor(colorNames[0] || effectiveRows[0]?.color || '');
    setSize(sizes[0] || effectiveRows[0]?.size || '');
    setQty(Math.max(1, quantity));
  }, [open, product.id, colorNames, sizes, effectiveRows, quantity]);

  const selected = useMemo(
    () => effectiveRows.find(
      (row) =>
        (!color || normalize(row.color) === normalize(color)) &&
        (!size || normalize(row.size) === normalize(size)),
    ),
    [effectiveRows, color, size],
  );

  const selectedColor = colors.find((item) => normalize(item.name) === normalize(color));
  const colorRows = useMemo(
    () => effectiveRows.filter((row) => normalize(row.color) === normalize(color)),
    [effectiveRows, color],
  );
  const stock = stockOf(selected);
  const selectedPrice = Number(selected?.price ?? currentPrice) || currentPrice;
  const hasActiveDeal = currentPrice > 0 && selectedPrice > currentPrice;
  const displayPrice = hasActiveDeal ? currentPrice : selectedPrice;
  const fallbackImage = imageValue(product.imageUrl) || imageValue(product.image);
  const selectedImage = String(
    selected?.imageUrl ||
    colorRows.find((row) => stockOf(row) > 0 && imageValue(row.imageUrl))?.imageUrl ||
    selectedColor?.imageUrl ||
    fallbackImage ||
    imageValue(product.images?.[0]),
  );
  const valid = Boolean(selected && stock > 0 && displayPrice > 0);
  const safeQty = Math.min(Math.max(1, qty), Math.max(1, stock));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 backdrop-blur-sm transition-opacity duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="Choose product options"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="w-full max-w-2xl animate-in slide-in-from-bottom duration-300 rounded-t-[28px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto my-2 h-1.5 w-12 rounded-full bg-black/20" />

        <div className="flex items-center gap-3 border-b border-black/7 pb-4">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#F4F4F1]">
            {selectedImage ? (
              <Image
                src={selectedImage}
                alt=""
                fill
                priority
                loading="eager"
                sizes="56px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-black">{titleOf(product as any)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {hasActiveDeal && originalPrice > selectedPrice ? <span className="text-[10px] font-bold text-black/30 line-through">{money(originalPrice)}</span> : null}
              {hasActiveDeal ? <span className="text-[10px] font-bold text-black/35 line-through">{money(selectedPrice)}</span> : null}
              <p className="text-sm font-black text-[#E1352B]">{money(displayPrice)}</p>
              {!hasActiveDeal && originalPrice > selectedPrice ? <span className="text-[10px] font-bold text-black/30 line-through">{money(originalPrice)}</span> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5" aria-label="Close"><X size={17} /></button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto py-4 pr-1">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">Color</p>
              <span className="text-[9px] font-bold text-black/30">{color || 'Choose one'}</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {colors.map((item) => {
                const active = normalize(item.name) === normalize(color);
                const available = effectiveRows.some(
                  (row) => normalize(row.color) === normalize(item.name) && stockOf(row) > 0,
                );

                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setColor(item.name);
                      const currentSizeAvailable = effectiveRows.some(
                        (row) => normalize(row.color) === normalize(item.name) && normalize(row.size) === normalize(size) && stockOf(row) > 0,
                      );
                      if (!currentSizeAvailable) {
                        const firstAvailableSize = effectiveRows.find(
                          (row) => normalize(row.color) === normalize(item.name) && stockOf(row) > 0,
                        )?.size;
                        if (firstAvailableSize) setSize(String(firstAvailableSize).trim());
                      }
                    }}
                    disabled={!available}
                    className={`flex min-h-16 items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-all duration-200 ${active ? 'border-[#0F6A5F] bg-[#0F6A5F]/[0.06] text-[#0F6A5F] ring-2 ring-[#0F6A5F] ring-offset-2' : 'border-black/10 bg-white text-black/70'} disabled:cursor-not-allowed disabled:opacity-30`}
                  >
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-[#F4F4F1]">
                      {item.imageUrl ? <Image src={item.imageUrl} alt="" fill priority loading="eager" sizes="40px" className="object-cover" /> : <span className="block h-full w-full bg-black/10" />}
                    </span>
                    <span className="min-w-0 truncate text-xs font-black">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 border-t border-black/7 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">Size</p>
              <span className="text-[9px] font-bold text-black/30">{sizes.length} option{sizes.length === 1 ? '' : 's'}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((item) => {
                const active = normalize(item) === normalize(size);
                const available = effectiveRows.some(
                  (row) => normalize(row.size) === normalize(item) && (!color || normalize(row.color) === normalize(color)) && stockOf(row) > 0,
                );

                return (
                  <button key={item} type="button" onClick={() => setSize(item)} disabled={!available} className={`min-w-16 rounded-2xl border px-4 py-3 text-xs font-black transition-all duration-200 ${active ? 'border-[#14140F] bg-[#14140F] text-white' : 'border-black/10 bg-white text-black/65'} disabled:cursor-not-allowed disabled:opacity-30`}>
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`mt-5 rounded-2xl border p-3 ${stock > 0 ? 'border-[#0F6A5F]/10 bg-[#0F6A5F]/[0.06]' : 'border-[#E1352B]/10 bg-[#E1352B]/[0.06]'}`}>
            <div className="flex items-center justify-between gap-3">
              <span className={`text-xs font-black ${stock > 0 ? 'text-[#0F6A5F]' : 'text-[#E1352B]'}`}>
                {selected ? stock > 0 ? `✓ In stock — ${stock} available` : 'Out of stock' : 'Select an available option'}
              </span>
              {selected && stock > 0 ? <span className={`text-[10px] font-bold ${hasActiveDeal ? 'text-[#E1352B]' : 'text-black/35'}`}>{money(displayPrice)} each</span> : null}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/8 p-2">
            <span className="pl-2 text-[10px] font-black uppercase tracking-wider text-black/40">Quantity</span>
            <div className="flex items-center rounded-xl bg-[#F4F4F1]">
              <button type="button" onClick={() => setQty((value) => Math.max(1, value - 1))} className="flex h-10 w-10 items-center justify-center rounded-xl" aria-label="Decrease quantity"><Minus size={14} /></button>
              <span className="w-8 text-center text-xs font-black">{safeQty}</span>
              <button type="button" onClick={() => setQty((value) => Math.min(stock, value + 1))} disabled={!stock || safeQty >= stock} className="flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-30" aria-label="Increase quantity"><Plus size={14} /></button>
            </div>
          </div>
        </div>

        <button type="button" disabled={!valid} onClick={() => onConfirm({ color: color || undefined, size: size || undefined }, safeQty)} className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl py-4 text-xs font-black text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-40 ${mode === 'buy' ? 'bg-[#E1352B]' : 'bg-[#14140F]'}`}>
          {mode === 'buy' ? <Zap size={17} fill="currentColor" /> : <ShoppingCart size={17} />}
          {mode === 'buy' ? 'Buy Now / Proceed to Checkout' : 'Add to Cart'}
        </button>
      </section>
    </div>
  );
}
