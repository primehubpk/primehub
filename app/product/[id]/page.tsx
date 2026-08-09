'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Minus,
  Plus,
  Play,
  ShoppingBag,
  Star,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';

type Product = {
  id: string;
  title?: string;
  name?: string;
  price?: number;
  compareAtPrice?: number;
  originalPrice?: number;
  imageUrl?: string;
  image?: string;
  images?: string[];
  category?: string;
  categoryId?: string;
  stock?: number;
  quantity?: number;
  isFlashSale?: boolean;
  videoUrl?: string;
  reelUrl?: string;
  description?: string;
  rating?: number;
  reviews?: number;
  [key: string]: any;
};

function titleOf(p: Product) {
  return p.title || p.name || 'PrimeHub Deal';
}

function priceOf(p: Product) {
  return Number(p.price || 0);
}

function originalOf(p: Product) {
  return Number(p.compareAtPrice ?? p.originalPrice ?? 0);
}

function imagesOf(p: Product) {
  const list = [
    ...(Array.isArray(p.images) ? p.images : []),
    p.imageUrl,
    p.image,
  ].filter(Boolean) as string[];
  return [...new Set(list)];
}

function videoOf(p: Product) {
  return p.videoUrl || p.reelUrl || '';
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [wished, setWished] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const addItem = useCartStore((state) => state.addItem);
  const openDrawer = useCartStore((state: any) => state.openDrawer);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'products', id));
        if (cancelled) return;

        if (!snap.exists()) {
          setProduct(null);
          setFailed(true);
        } else {
          setProduct({ id: snap.id, ...snap.data() } as Product);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const images = useMemo(() => (product ? imagesOf(product) : []), [product]);
  const price = product ? priceOf(product) : 0;
  const original = product ? originalOf(product) : 0;
  const discount =
    original > price && price > 0
      ? Math.round(((original - price) / original) * 100)
      : 0;

  const stock = Number(product?.stock ?? product?.quantity ?? 0);
  const lowStock = stock > 0 && stock <= 5;
  const rating = Number(product?.rating || 0);
  const reviews = Number(product?.reviews || 0);

  const addProduct = () => {
    if (!product) return;

    const cartItem = {
      id: product.id,
      name: titleOf(product),
      price,
      originalPrice: original || price,
    };
    for (let i = 0; i < quantity; i += 1) addItem(cartItem);

    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  const buyWhatsApp = () => {
    if (!product) return;

    const text = [
      '🛍️ PrimeHub Deals — Product Order',
      '',
      `Product: ${titleOf(product)}`,
      `Quantity: ${quantity}`,
      `Price: Rs. ${price.toLocaleString()}`,
      `Total: Rs. ${(price * quantity).toLocaleString()}`,
      `Product ID: ${product.id}`,
      '',
      'I want to order this product.',
    ].join('\n');

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 h-10 w-10 animate-pulse rounded-full bg-black/8" />
          <div className="overflow-hidden rounded-[28px] bg-white">
            <div className="aspect-square animate-pulse bg-black/8 md:aspect-[4/3]" />
            <div className="space-y-4 p-5">
              <div className="h-7 w-4/5 animate-pulse rounded bg-black/8" />
              <div className="h-6 w-1/3 animate-pulse rounded bg-black/8" />
              <div className="h-20 w-full animate-pulse rounded bg-black/8" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (failed || !product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-5">
        <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5">
            <ShoppingBag size={22} className="text-black/35" />
          </div>
          <h1 className="mt-4 text-lg font-black">Product not found</h1>
          <p className="mt-1 text-xs leading-5 text-black/45">
            This deal may have been removed or is no longer available.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-[10px] font-black text-white"
          >
            Back to Deals
          </Link>
        </div>
      </main>
    );
  }

  const active = images[activeImage] || '';

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      <div className="mx-auto max-w-5xl">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-[#F4F4F1]/92 px-4 py-3 backdrop-blur">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
            aria-label="Back to home"
          >
            <ArrowLeft size={17} />
          </Link>

          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-black/40">
            Product
          </span>

          <button
            type="button"
            onClick={() => setWished((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
            aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart
              size={17}
              className={wished ? 'text-[#E1352B]' : 'text-[#14140F]'}
              fill={wished ? 'currentColor' : 'none'}
            />
          </button>
        </header>

        <div className="grid gap-4 px-3 md:grid-cols-[1.05fr_.95fr] md:px-5 md:pt-3">
          <section className="overflow-hidden rounded-[28px] border border-black/7 bg-white shadow-sm">
            <div className="relative aspect-square overflow-hidden bg-[#F4F4F1] md:aspect-[4/3]">
              {active ? (
                <img
                  src={active}
                  alt={titleOf(product)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-bold text-black/25">
                  No product image
                </div>
              )}

              <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                {discount > 0 && (
                  <span className="rounded-full bg-[#E1352B] px-2.5 py-1.5 text-[10px] font-black text-white">
                    SAVE {discount}%
                  </span>
                )}
                {product.isFlashSale && (
                  <span className="flex items-center gap-1 rounded-full bg-[#14140F] px-2.5 py-1.5 text-[10px] font-black text-white">
                    <Zap size={10} />
                    FLASH DEAL
                  </span>
                )}
              </div>

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveImage((i) => (i - 1 + images.length) % images.length)
                    }
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveImage((i) => (i + 1) % images.length)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-md"
                    aria-label="Next image"
                  >
                    <ChevronRight size={17} />
                  </button>
                </>
              )}

              {videoOf(product) && (
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-[10px] font-black shadow-md"
                >
                  <Play size={11} fill="currentColor" />
                  Watch Reel
                </button>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {images.map((image, index) => (
                  <button
                    type="button"
                    key={`${image}-${index}`}
                    onClick={() => setActiveImage(index)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${
                      index === activeImage ? 'border-[#E1352B]' : 'border-transparent'
                    }`}
                    aria-label={`View image ${index + 1}`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-black/7 bg-white p-5 shadow-sm md:p-7">
            <div className="flex flex-wrap items-center gap-2">
              {product.category && (
                <span className="rounded-full bg-[#0F6A5F]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#0F6A5F]">
                  {product.category}
                </span>
              )}
              {lowStock && (
                <span className="rounded-full bg-[#FFB020]/20 px-2.5 py-1 text-[9px] font-black text-[#8a5a00]">
                  Only {stock} left
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-[#14140F] md:text-3xl">
              {titleOf(product)}
            </h1>

            {(rating > 0 || reviews > 0) && (
              <div className="mt-3 flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-[#FFB020]/15 px-2 py-1 text-[10px] font-black">
                  <Star size={11} fill="currentColor" />
                  {rating ? rating.toFixed(1) : 'New'}
                </span>
                {reviews > 0 && (
                  <span className="text-[10px] font-bold text-black/40">
                    {reviews.toLocaleString()} reviews
                  </span>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-end gap-2">
              <span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#E1352B]">
                Rs. {price.toLocaleString()}
              </span>
              {original > price && (
                <span className="mb-1 text-sm text-black/35 line-through">
                  Rs. {original.toLocaleString()}
                </span>
              )}
            </div>

            {discount > 0 && (
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#0F6A5F]">
                You save Rs. {(original - price).toLocaleString()}
              </p>
            )}

            <div className="my-5 h-px bg-black/8" />

            <div className="flex items-start gap-3 rounded-2xl bg-[#F4F4F1] p-3">
              <Truck size={17} className="mt-0.5 shrink-0 text-[#0F6A5F]" />
              <div>
                <p className="text-[11px] font-black">Worldwide delivery available</p>
                <p className="mt-0.5 text-[10px] leading-4 text-black/45">
                  Delivery options and final charges can be confirmed at checkout.
                </p>
              </div>
            </div>

            {product.description && (
              <div className="mt-5">
                <h2 className="text-xs font-black uppercase tracking-[0.15em]">
                  About this deal
                </h2>
                <p className="mt-2 whitespace-pre-line text-xs leading-5 text-black/55">
                  {product.description}
                </p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-black/8 p-2">
              <span className="pl-2 text-[10px] font-black uppercase tracking-wider text-black/40">
                Quantity
              </span>
              <div className="flex items-center rounded-xl bg-[#F4F4F1]">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-xs font-black">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-10 w-10 items-center justify-center"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  addProduct();
                  if (typeof openDrawer === 'function') openDrawer();
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white transition hover:bg-[#E1352B] active:scale-[0.99]"
              >
                {added ? <Zap size={15} /> : <ShoppingBag size={15} />}
                {added ? 'Added to Cart' : 'Add to Cart'}
              </button>

              <button
                type="button"
                onClick={buyWhatsApp}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#0F6A5F] py-4 text-xs font-black text-white"
              >
                <MessageCircle size={15} />
                Order This on WhatsApp
              </button>
            </div>

            <p className="mt-3 text-center text-[9px] font-bold leading-4 text-black/35">
              Secure your deal first. Customer details and website checkout will be added in
              the checkout step.
            </p>
          </section>
        </div>
      </div>

      {videoOpen && videoOf(product) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setVideoOpen(false)}
        >
          <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              className="absolute -right-1 -top-12 flex h-9 w-9 items-center justify-center rounded-full bg-white"
              aria-label="Close video"
            >
              <X size={16} />
            </button>
            <video
              src={videoOf(product)}
              controls
              autoPlay
              playsInline
              className="max-h-[78vh] w-full rounded-3xl bg-black"
            />
          </div>
        </div>
      )}
    </main>
  );
}
