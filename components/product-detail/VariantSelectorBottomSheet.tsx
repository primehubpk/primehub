'use client';

import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, X, Zap } from 'lucide-react';
import type { ProductVariantRow, ProductVariantSelection } from '@/lib/types';
import { money, titleOf, type Product } from './ProductDetailTypes';

type Props = {
  product: Product;
  rows: ProductVariantRow[];
  open: boolean;
  mode: 'cart' | 'buy';
  quantity: number;
  currentPrice: number;
  originalPrice: number;
  onClose: () => void;
  onConfirm: (selection: ProductVariantSelection, quantity: number) => void;
};

function rowStock(row?: ProductVariantRow) {
  return Math.max(0, Number(row?.stock ?? 0));
}

function swatchClassName(color: string) {
  const value = color.toLowerCase();
  if (value.includes('gold')) return 'bg-[#D4AF37]';
  if (value.includes('silver') || value.includes('grey') || value.includes('gray')) {
    return 'bg-[#C0C0C0]';
  }
  if (value.includes('white')) return 'bg-white border border-black/15';
  if (value.includes('red')) return 'bg-[#E1352B]';
  if (value.includes('blue')) return 'bg-[#315CFF]';
  if (value.includes('green')) return 'bg-[#0F6A5F]';
  return 'bg-[#14140F]';
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
  const colors = useMemo(
    () => [...new Set(rows.map((row) => String(row.color || '').trim()).filter(Boolean))],
    [rows],
  );
  const sizes = useMemo(
    () => [...new Set(rows.map((row) => String(row.size || '').trim()).filter(Boolean))],
    [rows],
  );

  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(Math.max(1, quantity));

  useEffect(() => {
    if (!open) return;
    setColor(colors[0] || '');
    setSize(sizes[0] || '');
    setQty(Math.max(1, quantity));
  }, [open, product.id, colors, sizes, quantity]);

  const selected = rows.find(
    (row) =>
      (!colors.length || row.color === color) &&
      (!sizes.length || row.size === size),
  );
  const stock = selected ? rowStock(selected) : 0;
  const selectedPrice = Number(selected?.price ?? currentPrice) || currentPrice;
  const image = String(
    selected?.imageUrl || product.imageUrl || product.images?.[0] || product.image || '',
  );
  const valid = Boolean(selected && stock > 0 && selectedPrice > 0);
  const safeQty = Math.min(Math.max(1, qty), Math.max(1, stock));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-sm transition-opacity duration-300"
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
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#F4F4F1]">
            {image ? (
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-black text-[#14140F]">
              {titleOf(product)}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm font-black text-[#E1352B]">{money(selectedPrice)}</p>
              {originalPrice > selectedPrice ? (
                <span className="text-[10px] font-bold text-black/30 line-through">
                  {money(originalPrice)}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5 transition hover:bg-black/10"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-4 pr-1">
          {colors.length > 0 ? (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">
                  Color
                </p>
                <span className="text-[9px] font-bold text-black/30">Choose one</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {colors.map((item) => {
                  const active = item === color;
                  const available = rows.some(
                    (row) =>
                      row.color === item &&
                      (!sizes.length || row.size === size) &&
                      rowStock(row) > 0,
                  );

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setColor(item)}
                      disabled={!available}
                      className={`flex items-center gap-2 rounded-full border px-3.5 py-2.5 text-xs font-black transition-all duration-200 ${
                        active
                          ? 'border-[#0F6A5F] bg-[#0F6A5F]/[0.06] text-[#0F6A5F] ring-2 ring-[#0F6A5F] ring-offset-2'
                          : 'border-black/10 bg-white text-black/65 hover:border-black/20'
                      } disabled:cursor-not-allowed disabled:opacity-30`}
                    >
                      <span className={`h-3 w-3 rounded-full ${swatchClassName(item)}`} />
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {sizes.length > 0 ? (
            <div className="mt-5 border-t border-black/7 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">
                  Size
                </p>
                <span className="text-[9px] font-bold text-black/30">Choose one</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {sizes.map((item) => {
                  const active = item === size;
                  const available = rows.some(
                    (row) =>
                      row.size === item &&
                      (!colors.length || row.color === color) &&
                      rowStock(row) > 0,
                  );

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSize(item)}
                      disabled={!available}
                      className={`min-w-16 rounded-2xl border px-4 py-2.5 text-xs font-black transition-all duration-200 ${
                        active
                          ? 'border-[#14140F] bg-[#14140F] text-white shadow-sm'
                          : 'border-black/10 bg-[#F4F4F1] text-black/65 hover:border-black/20'
                      } disabled:cursor-not-allowed disabled:opacity-30`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div
            className={`mt-5 rounded-2xl border p-3 ${
              stock > 0
                ? 'border-[#0F6A5F]/10 bg-[#0F6A5F]/[0.06]'
                : 'border-[#E1352B]/10 bg-[#E1352B]/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={`text-xs font-black ${
                  stock > 0 ? 'text-[#0F6A5F]' : 'text-[#E1352B]'
                }`}
              >
                {selected
                  ? stock > 0
                    ? `✓ In stock — ${stock} available`
                    : 'Out of stock'
                  : 'Select an available option'}
              </span>
              {selected && stock > 0 ? (
                <span className="text-[10px] font-bold text-black/35">
                  {money(selectedPrice)} each
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/8 p-2">
            <span className="pl-2 text-[10px] font-black uppercase tracking-wider text-black/40">
              Quantity
            </span>
            <div className="flex items-center rounded-xl bg-[#F4F4F1]">
              <button
                type="button"
                onClick={() => setQty((value) => Math.max(1, value - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-black/5"
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-xs font-black">{safeQty}</span>
              <button
                type="button"
                onClick={() => setQty((value) => Math.min(stock, value + 1))}
                disabled={!stock || safeQty >= stock}
                className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-black/5 disabled:opacity-30"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            onConfirm(
              { color: color || undefined, size: size || undefined },
              safeQty,
            )
          }
          className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl py-4 text-xs font-black text-white shadow-lg transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${
            mode === 'buy'
              ? 'bg-[#E1352B] shadow-[#E1352B]/20'
              : 'bg-[#14140F] shadow-black/10'
          }`}
        >
          {mode === 'buy' ? <Zap size={17} fill="currentColor" /> : <ShoppingCart size={17} />}
          {mode === 'buy' ? 'Buy Now / Proceed to Checkout' : 'Add to Cart'}
        </button>
      </section>
    </div>
  );
}
