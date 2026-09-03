'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Play, X, ZoomIn } from 'lucide-react';
import { money, titleOf, videoOf, type Product } from './ProductDetailTypes';
type Props = { product: Product; images: string[]; activeImage: number; savingsAmount: number; liveDeal: boolean; onImageChange: (updater: (index: number) => number) => void; onVideoOpen: () => void };
export default function ProductHero({ product, images, activeImage, savingsAmount, liveDeal, onImageChange, onVideoOpen }: Props) {
  const displayImage = images[activeImage] || '';
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(false);
      if (event.key === 'ArrowLeft' && images.length > 1) onImageChange((index) => (index - 1 + images.length) % images.length);
      if (event.key === 'ArrowRight' && images.length > 1) onImageChange((index) => (index + 1) % images.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [zoomed, images.length, onImageChange]);

  return <>
    <section className="overflow-hidden rounded-[30px] border border-black/7 bg-white shadow-sm md:sticky md:top-[66px] md:self-start">
      <div className="relative aspect-square overflow-hidden bg-[#F4F4F1] md:aspect-[4/3]">
        {displayImage ? <button type="button" onClick={() => setZoomed(true)} className="absolute inset-0 cursor-zoom-in" aria-label={`Enlarge ${titleOf(product)} image`}><Image src={displayImage} alt={titleOf(product)} fill priority sizes="(max-width: 768px) 100vw, 52vw" className="object-cover" unoptimized/></button> : <div className="flex h-full items-center justify-center text-sm font-bold text-black/25">No product image</div>}
        {displayImage && <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1.5 text-[9px] font-black text-white"><ZoomIn size={11}/>Tap to enlarge</span>}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">{savingsAmount > 0 && <span className="rounded-full bg-[#E1352B] px-2.5 py-1.5 text-[10px] font-black text-white">SAVE {money(savingsAmount)}</span>}{liveDeal && <span className="flex items-center gap-1 rounded-full bg-[#0F6A5F] px-2.5 py-1.5 text-[10px] font-black text-white"><Sparkles size={10} />LIVE TODAY</span>}</div>
        {images.length > 1 && <><button type="button" onClick={() => onImageChange((i) => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 shadow-md" aria-label="Previous image"><ChevronLeft size={18} /></button><button type="button" onClick={() => onImageChange((i) => (i + 1) % images.length)} className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 shadow-md" aria-label="Next image"><ChevronRight size={18} /></button></>}
        {videoOf(product) && <button type="button" onClick={onVideoOpen} className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-[10px] font-black shadow-md"><Play size={11} fill="currentColor" />Watch Reel</button>}
      </div>
      {images.length > 1 && <div className="flex gap-2 overflow-x-auto p-3">{images.map((image, index) => <button type="button" key={`${image}-${index}`} onClick={() => onImageChange(() => index)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${index === activeImage ? 'border-[#E1352B]' : 'border-transparent'}`} aria-label={`View image ${index + 1}`}><Image src={image} alt="" fill sizes="64px" className="object-cover" unoptimized/></button>)}</div>}
    </section>
    {zoomed && displayImage && <div role="dialog" aria-modal="true" aria-label={`${titleOf(product)} enlarged image`} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-3 sm:p-8" onClick={() => setZoomed(false)}>
      <button type="button" onClick={() => setZoomed(false)} className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-lg" aria-label="Close enlarged image"><X size={20}/></button>
      <div className="relative h-full w-full max-w-6xl" onClick={(event) => event.stopPropagation()}><Image src={displayImage} alt={`${titleOf(product)} enlarged`} fill priority sizes="100vw" className="object-contain" unoptimized/></div>
      {images.length > 1 && <><button type="button" onClick={(event) => { event.stopPropagation(); onImageChange((index) => (index - 1 + images.length) % images.length); }} className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg sm:left-6" aria-label="Previous enlarged image"><ChevronLeft size={21}/></button><button type="button" onClick={(event) => { event.stopPropagation(); onImageChange((index) => (index + 1) % images.length); }} className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg sm:right-6" aria-label="Next enlarged image"><ChevronRight size={21}/></button></>}
      <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-black text-white">{activeImage + 1} / {images.length}</span>
    </div>}
  </>;
}
