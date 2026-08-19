'use client';
import { Edit3, Trash2 } from 'lucide-react';
import { imageOf, type ProductRowProps } from './ProductTypes';
export default function ProductRow({product,onEdit,onDelete}: ProductRowProps) {
  return <article className="rounded-2xl bg-white p-3 shadow-sm">{imageOf(product)&&<img src={imageOf(product)} alt={product.title} className="h-32 w-full rounded-xl object-cover"/>}<p className="mt-2 font-black">{product.title}</p><p className="text-xs text-[#E1352B]">Rs. {Number(product.price).toLocaleString()} · Stock {product.stock}</p><p className="mt-1 text-[11px] text-black/45">{String(product.category||'')}</p><div className="mt-3 flex gap-2"><button type="button" onClick={()=>onEdit(product)} className="rounded-lg bg-black/5 p-2"><Edit3 size={14}/></button><button type="button" onClick={()=>onDelete(product)} className="rounded-lg bg-red-50 p-2 text-[#E1352B]"><Trash2 size={14}/></button></div></article>;
}
