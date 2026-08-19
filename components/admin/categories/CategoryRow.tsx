'use client';
import { Edit3, ImagePlus, Trash2 } from 'lucide-react';
import type { CategoryRowProps } from './CategoryTypes';
import { slugify } from './CategoryTypes';
export default function CategoryRow({ category, index, total, onMove, onToggleActive, onEdit, onRemove }: CategoryRowProps) {
  return <article className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3 ${category.active === false ? 'border-dashed opacity-55' : 'border-black/10'}`}>
    {category.iconUrl ? <img src={category.iconUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/5 text-black/35"><ImagePlus className="h-5 w-5" /></div>}
    <div className="min-w-[160px] flex-1"><p className="truncate text-sm font-bold">{category.title}</p><p className="truncate text-xs text-black/45">/{category.slug || slugify(category.title)}</p></div>
    <span className="rounded-full bg-[#0F6A5F]/10 px-2 py-1 text-[9px] font-black uppercase text-[#0F6A5F]">{category.active === false ? 'Hidden' : 'Live'}</span>
    <div className="flex items-center gap-1"><button type="button" disabled={index === 0} onClick={() => onMove(category, -1)} className="rounded-lg border border-black/10 px-2 py-1 text-xs disabled:opacity-25">↑</button><button type="button" disabled={index === total - 1} onClick={() => onMove(category, 1)} className="rounded-lg border border-black/10 px-2 py-1 text-xs disabled:opacity-25">↓</button><button type="button" onClick={() => onToggleActive(category)} className="rounded-lg border border-black/10 px-2 py-1 text-[10px] font-bold">{category.active === false ? 'Show' : 'Hide'}</button><button type="button" onClick={() => onEdit(category)} className="rounded-lg p-2 text-[#0F6A5F]"><Edit3 size={15} /></button><button type="button" onClick={() => onRemove(category)} className="rounded-lg p-2 text-[#E1352B]"><Trash2 size={15} /></button></div>
  </article>;
}
