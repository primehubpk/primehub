'use client';
import { X } from 'lucide-react';
import { videoOf, type Product } from './ProductDetailTypes';
type Props = { product: Product; open: boolean; onClose: () => void };
export default function ProductVideoModal({ product, open, onClose }: Props) { const src = videoOf(product); if (!open || !src) return null; return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}><div className="relative w-full max-w-lg" onClick={(event) => event.stopPropagation()}><button type="button" onClick={onClose} className="absolute -right-1 -top-12 flex h-9 w-9 items-center justify-center rounded-full bg-white" aria-label="Close video"><X size={16} /></button><video src={src} controls autoPlay playsInline className="max-h-[78vh] w-full rounded-3xl bg-black" /></div></div>; }
