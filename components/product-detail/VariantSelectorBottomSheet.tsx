'use client';

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

function rowStock(row?: ProductVariantRow) { return Math.max(0, Number(row?.stock ?? 0)); }

export default function VariantSelectorBottomSheet({ product, rows, open, mode, quantity, currentPrice, originalPrice, onClose, onConfirm }: Props) {
  const colors = [...new Set(rows.map((row) => String(row.color || '').trim()).filter(Boolean))];
  const sizes = [...new Set(rows.map((row) => String(row.size || '').trim()).filter(Boolean))];
  const [color, setColor] = useStateValue(colors[0] || '');
  const [size, setSize] = useStateValue(sizes[0] || '');
  const [qty, setQty] = useStateValue(Math.max(1, quantity));
  const selected = rows.find((row) => (!colors.length || row.color === color) && (!sizes.length || row.size === size));
  const stock = selected ? rowStock(selected) : 0;
  const selectedPrice = Number(selected?.price ?? currentPrice) || currentPrice;
  const image = String(selected?.imageUrl || product.imageUrl || product.images?.[0] || product.image || '');
  const valid = Boolean(selected && stock > 0 && selectedPrice > 0);

  if (!open) return null;

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Choose product options" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="w-full max-w-2xl animate-in slide-in-from-bottom duration-200 rounded-t-[28px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
      <div className="mx-auto h-1.5 w-12 rounded-full bg-black/12" />
      <div className="mt-3 flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#F4F4F1]"><img src={image} alt="" className="h-full w-full object-cover" /></div>
        <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-black">{titleOf(product)}</p><p className="mt-1 text-sm font-black text-[#E1352B]">{money(selectedPrice)}{originalPrice > selectedPrice && <span className="ml-2 text-[10px] font-bold text-black/30 line-through">{money(originalPrice)}</span>}</p></div>
        <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5" aria-label="Close"><X size={17} /></button>
      </div>
      <div className="mt-4 max-h-[48vh] overflow-y-auto pr-1">
        {colors.length > 0 && <div><p className="text-[9px] font-black uppercase tracking-[.18em] text-black/40">Color</p><div className="mt-2 flex flex-wrap gap-2">{colors.map((item) => { const active = item === color; const available = rows.some((row) => row.color === item && (!sizes.length || row.size === size) && rowStock(row) > 0); return <button key={item} type="button" onClick={() => setColor(item)} disabled={!available} className={`rounded-full border px-4 py-2.5 text-xs font-black transition ${active ? 'border-[#0F6A5F] bg-[#0F6A5F]/8 text-[#0F6A5F] ring-2 ring-[#0F6A5F]/20' : 'border-black/10 bg-white text-black/65'} disabled:cursor-not-allowed disabled:opacity-30`}>{item}</button>; })}</div></div>}
        {sizes.length > 0 && <div className="mt-4"><p className="text-[9px] font-black uppercase tracking-[.18em] text-black/40">Size</p><div className="mt-2 flex flex-wrap gap-2">{sizes.map((item) => { const active = item === size; const available = rows.some((row) => row.size === item && (!colors.length || row.color === color) && rowStock(row) > 0); return <button key={item} type="button" onClick={() => setSize(item)} disabled={!available} className={`rounded-xl border px-4 py-2.5 text-xs font-black transition ${active ? 'border-[#14140F] bg-[#14140F] text-white' : 'border-black/10 bg-[#F4F4F1] text-black/65'} disabled:cursor-not-allowed disabled:opacity-30`}>{item}</button>; })}</div></div>}
        <div className={`mt-4 rounded-2xl p-3 text-xs font-black ${stock > 0 ? 'bg-[#0F6A5F]/8 text-[#0F6A5F]' : 'bg-[#E1352B]/8 text-[#E1352B]'}`}>{selected ? (stock > 0 ? `✓ In stock — ${stock} available` : 'Out of stock') : 'Select an available option'}</div>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/8 p-2"><span className="pl-2 text-[10px] font-black uppercase tracking-wider text-black/40">Quantity</span><div className="flex items-center rounded-xl bg-[#F4F4F1]"><button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-10 w-10 items-center justify-center" aria-label="Decrease quantity"><Minus size={14} /></button><span className="w-8 text-center text-xs font-black">{qty}</span><button type="button" onClick={() => setQty(Math.min(stock || qty + 1, qty + 1))} disabled={!stock || qty >= stock} className="flex h-10 w-10 items-center justify-center disabled:opacity-30" aria-label="Increase quantity"><Plus size={14} /></button></div></div>
      </div>
      <button type="button" disabled={!valid} onClick={() => onConfirm({ color: color || undefined, size: size || undefined }, Math.min(qty, stock))} className={`mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl py-4 text-xs font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-40 ${mode === 'buy' ? 'bg-[#E1352B] shadow-[#E1352B]/20' : 'bg-[#14140F] shadow-black/10'}`}>{mode === 'buy' ? <Zap size={17} fill="currentColor" /> : <ShoppingCart size={17} />}{mode === 'buy' ? 'Buy Now / Proceed to Checkout' : 'Add to Cart'}</button>
    </section>
  </div>;
}

function useStateValue<T>(initial: T): [T, (value: T) => void] {
  const React = require('react') as typeof import('react');
  return React.useState<T>(initial);
}
