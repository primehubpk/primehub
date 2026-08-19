'use client';

import { ImagePlus, Loader2, Search, Star, Trash2, X } from 'lucide-react';
import type { ProductGalleryProps } from './ProductTypes';

export default function ProductGallery({
  form,
  busy,
  uploadingSlot,
  showGallery,
  gallerySearch,
  gallery,
  onUpload,
  onSetMainImage,
  onRemoveImage,
  onGallerySearchChange,
  onToggleGallery,
  onChangeImages,
}: ProductGalleryProps) {
  return <>
    <div className="rounded-2xl border border-black/10 bg-[#FAFAF7] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm font-black">6-image product gallery</p><p className="text-[11px] text-black/45">Upload up to 6 images. First image is the main cover.</p></div>
        <label className={`inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-4 py-2.5 text-xs font-black text-white ${busy || form.images.length >= 6 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}><ImagePlus size={14}/> {busy ? 'Processing…' : `Upload ${6 - form.images.length} slot${6 - form.images.length === 1 ? '' : 's'}`}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={onUpload} className="hidden" disabled={busy || form.images.length >= 6}/></label>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => {
          const url = form.images[index];
          return <div key={index} className="relative aspect-square overflow-hidden rounded-xl border border-black/8 bg-white">
            {url ? <><img src={url} alt={`Product image ${index + 1}`} className="h-full w-full object-cover"/>{index === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/75 px-2 py-1 text-[8px] font-black text-white">MAIN / COVER</span>}{index !== 0 && <button type="button" onClick={() => onSetMainImage(index)} className="absolute bottom-1.5 left-1.5 rounded-full bg-white/95 px-2 py-1 text-[8px] font-black shadow">Set as Main</button>}<button type="button" onClick={() => onRemoveImage(index)} className="absolute right-1.5 top-1.5 rounded-full bg-red-600 p-1.5 text-white"><Trash2 size={11}/></button></> : uploadingSlot === index ? <div className="flex h-full flex-col items-center justify-center gap-2 text-[#0F6A5F]"><Loader2 size={18} className="animate-spin"/><span className="text-[8px] font-black">Uploading…</span></div> : <div className="flex h-full flex-col items-center justify-center gap-1 text-black/20"><ImagePlus size={19}/><span className="text-[8px] font-black">Image {index + 1}</span></div>}
          </div>;
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-black/40"><Star size={12}/> Images are compressed before upload.</div>
    </div>

    {showGallery && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-3xl bg-[#F4F4F1] p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xl font-black">Choose from Media Gallery</h3><p className="text-xs text-black/45">Select up to 6 images.</p></div><button type="button" onClick={onToggleGallery} className="rounded-full bg-white p-2"><X/></button></div><div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2"><Search size={15}/><input value={gallerySearch} onChange={e => onGallerySearchChange(e.target.value)} placeholder="Search gallery" className="w-full bg-transparent text-sm outline-none"/></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{gallery.map(asset => { const selected = form.images.includes(asset.url); return <button key={asset.id} type="button" disabled={!selected && form.images.length >= 6} onClick={() => selected ? onChangeImages(form.images.filter(url => url !== asset.url)) : onChangeImages([...form.images, asset.url])} className={`overflow-hidden rounded-xl border-2 bg-white text-left disabled:opacity-40 ${selected ? 'border-[#0F6A5F]' : 'border-transparent'}`}><img src={asset.url} alt={asset.name || 'Media'} className="aspect-square w-full object-cover"/><span className="block truncate p-2 text-[10px] font-bold">{selected ? '✓ Selected' : asset.name || 'Image'}</span></button>; })}</div><div className="mt-4 flex justify-end"><button type="button" onClick={onToggleGallery} className="rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white">Done</button></div></div></div>}
  </>;
}
