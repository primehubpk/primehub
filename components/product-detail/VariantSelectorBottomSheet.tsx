'use client';

import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, X, Zap } from 'lucide-react';
import type { ProductVariantRow, ProductVariantSelection } from '@/lib/types';
import { getVariantRows, type VariantModalProduct } from '@/lib/cartStore';
import { money, titleOf } from './ProductDetailTypes';

type Props = { product: VariantModalProduct; rows: ProductVariantRow[]; open:boolean; mode:'cart'|'buy'; quantity:number; currentPrice:number; originalPrice:number; onClose:()=>void; onConfirm:(selection:ProductVariantSelection,quantity:number)=>void; };
function stockOf(row?:ProductVariantRow){return Math.max(0,Number(row?.stock??0));}
function swatch(color:string){const v=color.toLowerCase();if(v.includes('gold'))return'bg-[#D4AF37]';if(v.includes('silver')||v.includes('grey')||v.includes('gray'))return'bg-[#C0C0C0]';if(v.includes('red'))return'bg-[#E1352B]';if(v.includes('blue'))return'bg-[#315CFF]';if(v.includes('green'))return'bg-[#0F6A5F]';if(v.includes('white'))return'bg-white border border-black/15';return'bg-[#14140F]';}

export default function VariantSelectorBottomSheet({product,rows,open,mode,quantity,currentPrice,originalPrice,onClose,onConfirm}:Props){
 const effectiveRows=useMemo(()=>rows.length?rows:getVariantRows(product),[rows,product]);
 const colors=useMemo(()=>[...new Set(effectiveRows.map(r=>String(r.color||'').trim()).filter(Boolean))],[effectiveRows]);
 const sizes=useMemo(()=>[...new Set(effectiveRows.map(r=>String(r.size||'').trim()).filter(Boolean))],[effectiveRows]);
 const [color,setColor]=useState('');const [size,setSize]=useState('');const [qty,setQty]=useState(Math.max(1,quantity));
 useEffect(()=>{if(!open)return;setColor(colors[0]||'');setSize(sizes[0]||'');setQty(Math.max(1,quantity));},[open,product.id,colors,sizes,quantity]);
 const selected=effectiveRows.find(r=>(!colors.length||r.color===color)&&(!sizes.length||r.size===size));
 const stock=stockOf(selected);const selectedPrice=Number(selected?.price??currentPrice)||currentPrice;const image=String(selected?.imageUrl||product.imageUrl||product.image||product.images?.[0]||'');const valid=Boolean(selected&&stock>0&&selectedPrice>0);const safeQty=Math.min(Math.max(1,qty),Math.max(1,stock));
 if(!open)return null;
 return(
  <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 backdrop-blur-sm transition-opacity duration-300" role="dialog" aria-modal="true" aria-label="Choose product options" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
   <section className="w-full max-w-2xl animate-in slide-in-from-bottom duration-300 rounded-t-[28px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
    <div className="mx-auto my-2 h-1.5 w-12 rounded-full bg-black/20" />
    <div className="flex items-center gap-3 border-b border-black/7 pb-4">
     <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#F4F4F1]">{image?<img src={image} alt="" className="h-full w-full object-cover"/>:null}</div>
     <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-black">{titleOf(product as any)}</p><div className="mt-1 flex items-center gap-2"><p className="text-sm font-black text-[#E1352B]">{money(selectedPrice)}</p>{originalPrice>selectedPrice&&<span className="text-[10px] font-bold text-black/30 line-through">{money(originalPrice)}</span>}</div></div>
     <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5" aria-label="Close"><X size={17}/></button>
    </div>
    <div className="max-h-[52vh] overflow-y-auto py-4 pr-1">
     {colors.length>0&&<div><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">Color</p><span className="text-[9px] font-bold text-black/30">Choose one</span></div><div className="mt-2.5 flex flex-wrap gap-2.5">{colors.map(item=>{const active=item===color;const available=effectiveRows.some(r=>r.color===item&&(!sizes.length||r.size===size)&&stockOf(r)>0);return <button key={item} type="button" onClick={()=>setColor(item)} disabled={!available} className={`flex items-center gap-2 rounded-full border px-3.5 py-2.5 text-xs font-black transition-all duration-200 ${active?'border-[#0F6A5F] bg-[#0F6A5F]/[0.06] text-[#0F6A5F] ring-2 ring-[#0F6A5F] ring-offset-2':'border-black/10 bg-white text-black/65'} disabled:cursor-not-allowed disabled:opacity-30`}><span className={`h-3 w-3 rounded-full ${swatch(item)}`}/>{item}</button>})}</div></div>}
     {sizes.length>0&&<div className="mt-5 border-t border-black/7 pt-4"><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">Size</p><span className="text-[9px] font-bold text-black/30">Choose one</span></div><div className="mt-2.5 flex flex-wrap gap-2.5">{sizes.map(item=>{const active=item===size;const available=effectiveRows.some(r=>r.size===item&&(!colors.length||r.color===color)&&stockOf(r)>0);return <button key={item} type="button" onClick={()=>setSize(item)} disabled={!available} className={`min-w-16 rounded-2xl border px-4 py-2.5 text-xs font-black transition-all duration-200 ${active?'border-[#14140F] bg-[#14140F] text-white':'border-black/10 bg-[#F4F4F1] text-black/65'} disabled:cursor-not-allowed disabled:opacity-30`}>{item}</button>})}</div></div>}
     {effectiveRows.length===0&&<div className="rounded-2xl border border-dashed border-black/10 bg-[#F4F4F1] p-4 text-center text-xs font-bold text-black/45">This item has no selectable variants.</div>}
     <div className={`mt-5 rounded-2xl border p-3 ${stock>0?'border-[#0F6A5F]/10 bg-[#0F6A5F]/[0.06]':'border-[#E1352B]/10 bg-[#E1352B]/[0.06]'}`}><div className="flex items-center justify-between gap-3"><span className={`text-xs font-black ${stock>0?'text-[#0F6A5F]':'text-[#E1352B]'}`}>{selected?(stock>0?`✓ In stock — ${stock} available`:'Out of stock'):'Select an available option'}</span>{selected&&stock>0?<span className="text-[10px] font-bold text-black/35">{money(selectedPrice)} each</span>:null}</div></div>
     <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/8 p-2"><span className="pl-2 text-[10px] font-black uppercase tracking-wider text-black/40">Quantity</span><div className="flex items-center rounded-xl bg-[#F4F4F1]"><button type="button" onClick={()=>setQty(v=>Math.max(1,v-1))} className="flex h-10 w-10 items-center justify-center rounded-xl" aria-label="Decrease quantity"><Minus size={14}/></button><span className="w-8 text-center text-xs font-black">{safeQty}</span><button type="button" onClick={()=>setQty(v=>Math.min(stock,v+1))} disabled={!stock||safeQty>=stock} className="flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-30" aria-label="Increase quantity"><Plus size={14}/></button></div></div>
    </div>
    <button type="button" disabled={!valid} onClick={()=>onConfirm({color:color||undefined,size:size||undefined},safeQty)} className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl py-4 text-xs font-black text-white shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-40 ${mode==='buy'?'bg-[#E1352B]':'bg-[#14140F]'}`}>{mode==='buy'?<Zap size={17} fill="currentColor"/>:<ShoppingCart size={17}/>} {mode==='buy'?'Buy Now / Proceed to Checkout':'Add to Cart'}</button>
   </section>
  </div>
 );
}
