'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  LockKeyhole,
  MessageCircle,
  Minus,
  PackageCheck,
  Play,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import { WEEKDAY_LABELS, WEEKDAY_ORDER, countdownParts, dealTiming } from '@/lib/weeklyDealUtils';
import type { Product as SharedProduct, WeeklyDeal } from '@/lib/types';
import RecentlyViewed, { rememberProduct } from '@/components/RecentlyViewed';
import ReviewsSection from '@/components/ReviewsSection';
import MobileLiveDealBanner from '@/components/MobileLiveDealBanner';
import WeeklyDealCalendar from '@/components/WeeklyDealCalendar';

type Product = SharedProduct & {
  name?: string;
  compareAtPrice?: number;
  originalPrice?: number;
  image?: string;
  images?: string[];
  categoryId?: string;
  quantity?: number;
  inventory?: number;
  stock?: number;
  reelUrl?: string;
  description?: string;
  rating?: number;
  reviews?: number;
  [key: string]: any;
};

function titleOf(p: Product) {
  return p.title || p.name || 'PrimeHub Deal';
}

function regularPriceOf(p: Product) {
  return Number(p.price || 0);
}

function originalPriceOf(p: Product) {
  return Number(p.compareAtPrice ?? p.originalPrice ?? p.price ?? 0);
}

function imagesOf(p: Product) {
  const list = [...(Array.isArray(p.images) ? p.images : []), p.imageUrl, p.image].filter(Boolean) as string[];
  return [...new Set(list)];
}

function videoOf(p: Product) {
  return p.videoUrl || p.reelUrl || '';
}

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

function dealDiscount(dealPrice: number, regularPrice: number) {
  if (regularPrice <= 0 || dealPrice <= 0 || dealPrice >= regularPrice) return 0;
  return Math.round(((regularPrice - dealPrice) / regularPrice) * 100);
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id || '');
  const { settings } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [product, setProduct] = useState<Product | null>(null);
  const [weeklyProducts, setWeeklyProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [wished, setWished] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [nowTick, setNowTick] = useState<number | null>(null);

  useEffect(() => {
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const [productSnap, productsSnap] = await Promise.all([
          getDoc(doc(db, 'products', id)),
          getDocs(collection(db, 'products')),
        ]);
        if (cancelled) return;
        if (!productSnap.exists()) {
          setProduct(null);
          setFailed(true);
        } else {
          const nextProduct = { id: productSnap.id, ...productSnap.data() } as Product;
          setProduct(nextProduct);
          rememberProduct(productSnap.id);
        }
        const nextProducts: Record<string, Product> = {};
        productsSnap.forEach((item) => {
          nextProducts[item.id] = { id: item.id, ...item.data() } as Product;
        });
        setWeeklyProducts(nextProducts);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const images = useMemo(() => (product ? imagesOf(product) : []), [product]);
  const regularPrice = product ? regularPriceOf(product) : 0;
  const productOriginal = product ? originalPriceOf(product) : 0;
  const stock = Number(product?.stock ?? product?.quantity ?? product?.inventory ?? 10);
  const rating = Number(product?.rating || 0);
  const reviews = Number(product?.reviews || 0);

  const weeklyDeals = useMemo(
    () => ((settings.weeklyDeals || []) as WeeklyDeal[])
      .filter((deal) => deal.active !== false && deal.productId && Number(deal.dealPrice) > 0)
      .sort((a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day)),
    [settings.weeklyDeals]
  );
  const currentDeal = useMemo(() => weeklyDeals.find((deal) => deal.productId === id), [weeklyDeals, id]);
  const timing = currentDeal && nowTick !== null ? dealTiming(currentDeal.day, new Date(nowTick)) : null;
  const liveDeal = Boolean(currentDeal && timing?.isLive);
  const dealPrice = currentDeal ? Number(currentDeal.dealPrice || 0) : 0;
  const normalForDeal = currentDeal ? Number(weeklyProducts[id]?.price || currentDeal.originalPrice || regularPrice) : productOriginal;
  const savingsAmount = currentDeal && dealPrice > 0 && normalForDeal > dealPrice ? normalForDeal - dealPrice : 0;
  const savingsPercent = dealDiscount(dealPrice, normalForDeal);
  const countdown = timing && nowTick !== null ? countdownParts(timing.unlockAt.getTime() - nowTick) : null;
  const currentPrice = liveDeal && dealPrice > 0 ? dealPrice : regularPrice;
  const displayImage = images[activeImage] || '';
  const whatsappNumber = String(settings.whatsappNumber || '').replace(/\D/g, '');
  const maxQuantity = stock > 0 ? stock : undefined;
  const stockProgress = Math.max(0, Math.min(100, (stock / Math.max(stock, 50)) * 100));

  useEffect(() => {
    if (!liveDeal || !confettiCanvasRef.current || typeof window === 'undefined') return;
    const canvas = confettiCanvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    let animationFrame = 0;
    const startedAt = performance.now();
    const duration = 3000;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; rotation: number; rotationSpeed: number; gravity: number; drag: number; color: string; shape: number }> = [];
    const colors = ['#FFD166', '#FFB020', '#E1352B', '#0F6A5F', '#FFFFFF', '#FF6B35'];
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const burst = (originX: number, direction: number) => {
      for (let i = 0; i < 85; i += 1) {
        const angle = (-Math.PI / 2) + direction * (Math.random() * 0.95 - 0.48);
        const speed = 7 + Math.random() * 11;
        particles.push({ x: originX + (Math.random() - 0.5) * 16, y: window.innerHeight - 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 4 + Math.random() * 6, rotation: Math.random() * Math.PI, rotationSpeed: (Math.random() - 0.5) * 0.28, gravity: 0.2 + Math.random() * 0.12, drag: 0.985, color: colors[Math.floor(Math.random() * colors.length)], shape: Math.random() });
      }
    };
    resize();
    burst(window.innerWidth * 0.07, 1);
    burst(window.innerWidth * 0.93, -1);
    window.addEventListener('resize', resize);
    const draw = (now: number) => {
      const elapsed = now - startedAt;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.forEach((particle) => {
        particle.vx *= particle.drag;
        particle.vy += particle.gravity;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.rotationSpeed;
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.globalAlpha = Math.max(0, Math.min(1, 1 - Math.max(0, elapsed - 1700) / 1300));
        context.fillStyle = particle.color;
        if (particle.shape > 0.5) context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.62);
        else { context.beginPath(); context.arc(0, 0, particle.size / 2, 0, Math.PI * 2); context.fill(); }
        context.restore();
      });
      if (elapsed < duration) animationFrame = window.requestAnimationFrame(draw);
      else context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationFrame);
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
  }, [liveDeal]);

  const addProduct = () => {
    if (!product || currentPrice <= 0 || stock === 0) return;
    const image = images[0] || product.imageUrl || product.image || '';
    const cartItem = { id: product.id, name: titleOf(product), price: currentPrice, originalPrice: liveDeal && savingsAmount > 0 ? normalForDeal : productOriginal || currentPrice, image, imageUrl: image, dealDay: liveDeal && currentDeal ? currentDeal.day : undefined };
    for (let i = 0; i < quantity; i += 1) addItem(cartItem);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  const orderNow = () => {
    if (!product || currentPrice <= 0 || stock === 0) return;
    addProduct();
    router.push('/checkout');
  };

  const buyWhatsApp = () => {
    if (!product || currentPrice <= 0 || stock === 0) return;
    const text = ['🛍️ PrimeHub Deals — Product Order', '', `Product: ${titleOf(product)}`, `Quantity: ${quantity}`, `Price: ${money(currentPrice)}`, `Total: ${money(currentPrice * quantity)}`, currentDeal ? `Weekly Deal: ${WEEKDAY_LABELS[currentDeal.day]}${liveDeal ? ' — LIVE' : ' — locked'}` : '', `Product ID: ${product.id}`, '', 'I want to order this product.'].filter(Boolean).join('\n');
    const target = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-4"><div className="mx-auto max-w-6xl"><div className="mb-4 h-10 w-10 animate-pulse rounded-full bg-black/8" /><div className="grid gap-4 md:grid-cols-[1.05fr_.95fr]"><div className="aspect-square animate-pulse rounded-[30px] bg-white md:aspect-[4/3]" /><div className="rounded-[30px] bg-white p-6"><div className="h-8 w-4/5 animate-pulse rounded bg-black/8" /><div className="mt-5 h-16 w-1/2 animate-pulse rounded bg-black/8" /><div className="mt-5 h-28 animate-pulse rounded-2xl bg-black/8" /></div></div></div></main>;
  }

  if (failed || !product) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-5"><div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5"><ShoppingBag size={22} className="text-black/35" /></div><h1 className="mt-4 text-lg font-black">Product not found</h1><p className="mt-1 text-xs leading-5 text-black/45">This deal may have been removed or is no longer available.</p><Link href="/" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-[10px] font-black text-white">Back to Deals</Link></div></main>;
  }

const bannerCountdown = countdown
  ? (liveDeal
      ? `${countdown.hours.toString().padStart(2, '0')}:${countdown.minutes.toString().padStart(2, '0')}:${countdown.seconds.toString().padStart(2, '0')}`
      : `${countdown.days}d ${countdown.hours.toString().padStart(2, '0')}:${countdown.minutes.toString().padStart(2, '0')}:${countdown.seconds.toString().padStart(2, '0')}`)
  : '—';
  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      {liveDeal && <canvas ref={confettiCanvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[200] h-full w-full" />}
      <div className="mx-auto max-w-6xl">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-[#F4F4F1]/92 px-3 py-3 backdrop-blur md:px-5"><Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" aria-label="Back to home"><ArrowLeft size={17} /></Link><span className="text-[10px] font-black uppercase tracking-[0.24em] text-black/40">PrimeHub Product</span><button type="button" onClick={() => setWished((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}><Heart size={17} className={wished ? 'text-[#E1352B]' : 'text-[#14140F]'} fill={wished ? 'currentColor' : 'none'} /></button></header>

        <MobileLiveDealBanner live={liveDeal} countdown={countdown} />

        <div className="grid gap-5 px-3 md:grid-cols-[1.04fr_.96fr] md:px-5 md:pt-3">
          <section className="overflow-hidden rounded-[30px] border border-black/7 bg-white shadow-sm md:sticky md:top-[66px] md:self-start">
            <div className="relative aspect-square overflow-hidden bg-[#F4F4F1] md:aspect-[4/3]">{displayImage ? <img src={displayImage} alt={titleOf(product)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm font-bold text-black/25">No product image</div>}<div className="absolute left-3 top-3 flex flex-wrap gap-1.5">{savingsPercent > 0 && <span className="rounded-full bg-[#E1352B] px-2.5 py-1.5 text-[10px] font-black text-white">SAVE {savingsPercent}%</span>}{liveDeal && <span className="flex items-center gap-1 rounded-full bg-[#0F6A5F] px-2.5 py-1.5 text-[10px] font-black text-white"><Sparkles size={10} />LIVE TODAY</span>}</div>{images.length > 1 && <><button type="button" onClick={() => setActiveImage((i) => (i - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 shadow-md" aria-label="Previous image"><ChevronLeft size={18} /></button><button type="button" onClick={() => setActiveImage((i) => (i + 1) % images.length)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 shadow-md" aria-label="Next image"><ChevronRight size={18} /></button></>}{videoOf(product) && <button type="button" onClick={() => setVideoOpen(true)} className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-[10px] font-black shadow-md"><Play size={11} fill="currentColor" />Watch Reel</button>}</div>
            {images.length > 1 && <div className="flex gap-2 overflow-x-auto p-3">{images.map((image, index) => <button type="button" key={`${image}-${index}`} onClick={() => setActiveImage(index)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${index === activeImage ? 'border-[#E1352B]' : 'border-transparent'}`} aria-label={`View image ${index + 1}`}><img src={image} alt="" className="h-full w-full object-cover" /></button>)}</div>}
          </section>

          <section className="rounded-[30px] border border-black/7 bg-white p-4 shadow-sm sm:p-6 md:p-7">
            {currentDeal && timing && nowTick !== null && (liveDeal ? <div className="live-deal-celebration relative overflow-hidden rounded-[24px] bg-gradient-to-r from-[#8a4b00] via-[#FFD166] to-[#0F6A5F] p-[2px] shadow-lg"><div className="rounded-[22px] bg-gradient-to-br from-[#2b1600] via-[#14140F] to-[#063b35] p-4 text-white sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#FFD166]">🎉 MEGA CELEBRATION SALE — LOWEST PRICE EVER!</div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/80"><span className="h-2 w-2 animate-pulse rounded-full bg-[#FFB020]" />Live Deal <span aria-hidden="true">🎉 🎆 💥</span></div><p className="mt-1 text-xl font-black sm:text-2xl">⚡ LIVE TODAY'S DEAL</p></div><div className="rounded-2xl bg-white/10 px-4 py-3 text-center ring-1 ring-[#FFD166]/30"><p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/60">Ends in</p><p className="mt-1 font-[family-name:var(--font-mono)] text-xl font-black tracking-tight">{bannerCountdown}</p></div></div></div></div> : <div className="rounded-[24px] border border-black/8 bg-[#F4F4F1] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#0F6A5F]"><LockKeyhole size={13} />Weekly Deal</div><p className="mt-1 text-xl font-black sm:text-2xl">🔒 {WEEKDAY_LABELS[currentDeal.day]} DEAL</p></div><div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm"><p className="text-[8px] font-black uppercase tracking-[0.18em] text-black/40">Unlocks in</p><p className="mt-1 font-[family-name:var(--font-mono)] text-lg font-black">{bannerCountdown}</p></div></div><p className="mt-4 text-[10px] font-bold leading-5 text-black/50">Special deal price unlocks on {WEEKDAY_LABELS[currentDeal.day]}. You can buy now or wait for the deal!</p></div>)}

            <div className="mt-5 flex flex-wrap items-center gap-2">{product.category && <span className="rounded-full bg-[#0F6A5F]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#0F6A5F]">{product.category}</span>}{product.isFlashSale && <span className="flex items-center gap-1 rounded-full bg-[#14140F] px-2.5 py-1 text-[9px] font-black text-white"><Zap size={10} />Flash Sale</span>}</div>
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-[#14140F] sm:text-3xl md:text-[34px]">{titleOf(product)}</h1>
            {(rating > 0 || reviews > 0) && <div className="mt-3 flex items-center gap-2"><span className="flex items-center gap-1 rounded-full bg-[#FFB020]/15 px-2.5 py-1.5 text-[10px] font-black"><Star size={11} fill="currentColor" />{rating ? rating.toFixed(1) : 'New'}</span>{reviews > 0 && <span className="text-[10px] font-bold text-black/40">{reviews.toLocaleString()} reviews</span>}</div>}

            <div className="mt-5 rounded-[24px] border border-black/7 bg-[#FCFCFA] p-4 sm:p-5"><div className="flex flex-wrap items-end gap-x-3 gap-y-1"><div><p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#E1352B]">{liveDeal ? "Today's deal price" : currentDeal ? 'Deal price when unlocked' : 'Current price'}</p><span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#E1352B] sm:text-4xl">{money(currentDeal ? dealPrice : regularPrice)}</span>{liveDeal && <span className="ml-2 inline-flex animate-pulse items-center rounded-full bg-[#14140F] px-2 py-1 align-middle text-[8px] font-black text-white">💣 LOOT DEAL!</span>}</div>{currentDeal && normalForDeal > dealPrice && <span className="mb-1 text-sm font-bold text-black/35 line-through">{money(normalForDeal)}</span>}{!currentDeal && productOriginal > regularPrice && <span className="mb-1 text-sm font-bold text-black/35 line-through">{money(productOriginal)}</span>}</div>{currentDeal && savingsPercent > 0 && <div className="mt-3 flex flex-wrap items-center gap-2"><span className="animate-pulse-glow rounded-full bg-[#0F6A5F] px-3 py-1.5 text-[9px] font-black text-white">SAVE {savingsPercent}%</span><span className="text-[10px] font-black text-[#0F6A5F]">You save {money(savingsAmount)}</span></div>}{!liveDeal && currentDeal && <p className="mt-3 text-[9px] font-bold leading-4 text-black/40">Buy now at {money(regularPrice)} or wait until the {WEEKDAY_LABELS[currentDeal.day]} unlock for the special deal price.</p>}</div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-[#E1352B]/15 bg-[#E1352B]/[0.04]"><div className="flex items-center justify-between gap-3 px-3 py-2.5"><span className="flex items-center gap-2 text-[10px] font-black text-[#E1352B]"><Zap size={13} fill="currentColor" />{stock > 0 ? `🔥 Selling Fast! Only ${stock || 10} left in stock.` : 'Stock is limited — check availability before ordering.'}</span><span className="shrink-0 text-[8px] font-black uppercase tracking-wider text-black/35">Limited</span></div>{stock > 0 && <div className="h-1.5 bg-black/5"><div className="h-full rounded-full bg-[#E1352B] transition-[width] duration-500" style={{ width: `${stockProgress}%` }} /></div>}</div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[{ icon: <PackageCheck size={16} />, label: 'Cash on Delivery' }, { icon: <Truck size={16} />, label: 'Fast Delivery' }, { icon: <ShieldCheck size={16} />, label: '100% Quality Guaranteed' }, { icon: <RefreshCcw size={16} />, label: 'Easy Returns' }].map((badge) => <div key={badge.label} className="flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl bg-[#F4F4F1] px-2 text-center"><span className="text-[#0F6A5F]">{badge.icon}</span><span className="text-[8px] font-black leading-3 text-black/55">{badge.label}</span></div>)}</div>
            {product.description && <div className="mt-5"><h2 className="text-xs font-black uppercase tracking-[0.15em]">About this product</h2><p className="mt-2 whitespace-pre-line text-xs leading-5 text-black/55">{product.description}</p></div>}

            <div className="mt-5 flex items-center justify-between rounded-2xl border border-black/8 p-2"><span className="pl-2 text-[10px] font-black uppercase tracking-wider text-black/40">Quantity</span><div className="flex items-center rounded-xl bg-[#F4F4F1]"><button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex h-10 w-10 items-center justify-center" aria-label="Decrease quantity"><Minus size={14} /></button><span className="w-8 text-center text-xs font-black">{quantity}</span><button type="button" onClick={() => setQuantity((q) => maxQuantity ? Math.min(maxQuantity, q + 1) : q + 1)} className="flex h-10 w-10 items-center justify-center" aria-label="Increase quantity"><Plus size={14} /></button></div></div>
            <div className="mt-4 grid gap-2.5"><button type="button" onClick={orderNow} disabled={stock === 0 || currentPrice <= 0} className={`live-deal-cta flex items-center justify-center gap-2 rounded-2xl bg-[#E1352B] py-4 text-xs font-black text-white shadow-lg shadow-[#E1352B]/20 transition hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 ${liveDeal ? 'live-deal-cta-glow' : ''}`}><Zap size={16} fill="currentColor" />{stock === 0 ? 'Out of Stock' : liveDeal ? '🎉 CLAIM DEAL NOW' : 'BUY NOW / ORDER NOW'}</button><button type="button" onClick={addProduct} disabled={stock === 0 || currentPrice <= 0} className="flex items-center justify-center gap-2 rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white transition hover:bg-[#0F6A5F] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45">{added ? <Check size={16} /> : <ShoppingCart size={16} />}{added ? 'Added to Cart' : 'ADD TO CART'}</button><button type="button" onClick={buyWhatsApp} disabled={stock === 0 || currentPrice <= 0} className="flex items-center justify-center gap-2 rounded-2xl border border-[#0F6A5F]/20 bg-[#0F6A5F]/8 py-4 text-xs font-black text-[#0F6A5F] transition hover:bg-[#0F6A5F]/15 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"><MessageCircle size={16} />Order on WhatsApp</button></div>
            <p className="mt-3 text-center text-[9px] font-bold leading-4 text-black/35">Secure checkout • Cash on Delivery • Fast delivery options available</p>
          </section>
        </div>
      </div>

      <WeeklyDealCalendar weeklyDeals={weeklyDeals} weeklyProducts={weeklyProducts} nowTick={nowTick} />

      <RecentlyViewed excludeId={id} />
      <ReviewsSection productId={id} />
      {videoOpen && videoOf(product) && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setVideoOpen(false)}><div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}><button type="button" onClick={() => setVideoOpen(false)} className="absolute -right-1 -top-12 flex h-9 w-9 items-center justify-center rounded-full bg-white" aria-label="Close video"><X size={16} /></button><video src={videoOf(product)} controls autoPlay playsInline className="max-h-[78vh] w-full rounded-3xl bg-black" /></div></div>}
    </main>
  );
}
