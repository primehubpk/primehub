import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import { WEEKDAY_LABELS, WEEKDAY_ORDER, countdownParts, dealTiming } from '@/lib/weeklyDealUtils';
import type { WeeklyDeal } from '@/lib/types';
import { rememberProduct } from '@/components/RecentlyViewed';
import { dealDiscount, imagesOf, originalPriceOf, regularPriceOf, titleOf, type Product, type ProductDetailModel, money } from './ProductDetailTypes';

export function useProductDetail(): ProductDetailModel {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id || '');
  const { settings } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
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
        const [productSnap, productsSnap] = await Promise.all([getDoc(doc(db, 'products', id)), getDocs(collection(db, 'products'))]);
        if (cancelled) return;
        if (!productSnap.exists()) { setProduct(null); setFailed(true); }
        else { const nextProduct = { id: productSnap.id, ...productSnap.data() } as Product; setProduct(nextProduct); rememberProduct(productSnap.id); }
        const nextProducts: Record<string, Product> = {};
        productsSnap.forEach((item) => { nextProducts[item.id] = { id: item.id, ...item.data() } as Product; });
        setWeeklyProducts(nextProducts);
      } catch { if (!cancelled) setFailed(true); }
      finally { if (!cancelled) setLoading(false); }
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
  const weeklyDeals = useMemo(() => ((settings.weeklyDeals || []) as WeeklyDeal[]).filter((deal) => deal.active !== false && deal.productId && Number(deal.dealPrice) > 0).sort((a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day)), [settings.weeklyDeals]);
  const currentDeal = useMemo(() => weeklyDeals.find((deal) => deal.productId === id), [weeklyDeals, id]);
  const timing = currentDeal && nowTick !== null ? dealTiming(currentDeal.day, new Date(nowTick)) : null;
  const liveDeal = Boolean(currentDeal && timing?.isLive);
  const dealPrice = currentDeal ? Number(currentDeal.dealPrice || 0) : 0;
  const normalForDeal = currentDeal ? Number(weeklyProducts[id]?.price || currentDeal.originalPrice || regularPrice) : productOriginal;
  const savingsAmount = currentDeal && dealPrice > 0 && normalForDeal > dealPrice ? normalForDeal - dealPrice : 0;
  const savingsPercent = dealDiscount(dealPrice, normalForDeal);
  const countdown = timing && nowTick !== null ? countdownParts(timing.unlockAt.getTime() - nowTick) : null;
  const currentPrice = liveDeal && dealPrice > 0 ? dealPrice : regularPrice;
  const whatsappNumber = String(settings.whatsappNumber || '').replace(/\D/g, '');
  const maxQuantity = stock > 0 ? stock : undefined;
  const stockProgress = Math.max(0, Math.min(100, (stock / Math.max(stock, 50)) * 100));
  const bannerCountdown = countdown ? (liveDeal ? `${countdown.hours.toString().padStart(2, '0')}:${countdown.minutes.toString().padStart(2, '0')}:${countdown.seconds.toString().padStart(2, '0')}` : `${countdown.days}d ${countdown.hours.toString().padStart(2, '0')}:${countdown.minutes.toString().padStart(2, '0')}:${countdown.seconds.toString().padStart(2, '0')}`) : '—';

  const addProduct = () => {
    if (!product || currentPrice <= 0 || stock === 0) return;
    const image = images[0] || product.imageUrl || product.image || '';
    const cartItem = { id: product.id, name: titleOf(product), price: currentPrice, originalPrice: liveDeal && savingsAmount > 0 ? normalForDeal : productOriginal || currentPrice, image, imageUrl: image, dealDay: liveDeal && currentDeal ? currentDeal.day : undefined };
    for (let i = 0; i < quantity; i += 1) addItem(cartItem);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };
  const orderNow = () => { if (!product || currentPrice <= 0 || stock === 0) return; addProduct(); router.push('/checkout'); };
  const buyWhatsApp = () => {
    if (!product || currentPrice <= 0 || stock === 0) return;
    const text = ['🛍️ PrimeHub Deals — Product Order', '', `Product: ${titleOf(product)}`, `Quantity: ${quantity}`, `Price: ${money(currentPrice)}`, `Total: ${money(currentPrice * quantity)}`, currentDeal ? `Weekly Deal: ${WEEKDAY_LABELS[currentDeal.day]}${liveDeal ? ' — LIVE' : ' — locked'}` : '', `Product ID: ${product.id}`, '', 'I want to order this product.'].filter(Boolean).join('\n');
    const target = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  };
  return { product, weeklyProducts, loading, failed, activeImage, quantity, wished, videoOpen, added, nowTick, images, regularPrice, productOriginal, stock, rating, reviews, weeklyDeals, currentDeal, timing, liveDeal, dealPrice, normalForDeal, savingsAmount, savingsPercent, countdown, currentPrice, whatsappNumber, maxQuantity, stockProgress, bannerCountdown, setActiveImage, setQuantity, setWished, setVideoOpen, addProduct, orderNow, buyWhatsApp };
}
