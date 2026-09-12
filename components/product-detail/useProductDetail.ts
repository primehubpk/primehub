import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getVariantRows, useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import { WEEKDAY_LABELS, WEEKDAY_ORDER, countdownParts, dealTiming } from '@/lib/weeklyDealUtils';
import { bigDealConfiguredSlotCount, bigDealRotationIndex } from '@/lib/bigDealRotation';
import { cacheProductForNavigation, loadProductsForNavigation, readCachedProduct } from '@/lib/productNavigationCache';
import { normalizeImageUrl } from '@/lib/imageUrl';
import { rememberProduct } from '@/lib/recentlyViewedHistory';
import type { ProductVariantSelection, WeeklyDeal } from '@/lib/types';
import { dealDiscount, imagesOf, originalPriceOf, regularPriceOf, titleOf, type Product, type ProductDetailModel, money } from './ProductDetailTypes';

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function dealIsActive(deal: any, now: number): boolean {
  if (!deal || deal.active === false) return false;
  const start = deal.startAt ? new Date(deal.startAt).getTime() : 0;
  const end = deal.endAt ? new Date(deal.endAt).getTime() : 0;
  return (!start || Number.isNaN(start) || now >= start) && (!end || Number.isNaN(end) || now < end);
}

function currentBigDealForProduct(deal: any, productId: string, now: number, regularPrice: number) {
  if (!deal || !dealIsActive(deal, now)) return null;

  const slotCount = bigDealConfiguredSlotCount(deal);
  const slotIndex = bigDealRotationIndex(deal.rotationStartedAt, new Date(now), slotCount);
  const productIds = Array.isArray(deal.productIds) ? deal.productIds : [];
  const dealPrices = Array.isArray(deal.dealPrices) ? deal.dealPrices : [];
  const originalPrices = Array.isArray(deal.originalPrices) ? deal.originalPrices : [];
  const imageUrls = Array.isArray(deal.imageUrls) ? deal.imageUrls : [];
  const activeProductId = String(productIds[slotIndex] || deal.productId || productIds[0] || '').trim();
  if (!activeProductId || activeProductId !== productId) return null;

  const activeDealPrice = Number(dealPrices[slotIndex] ?? deal.dealPrice ?? deal.price ?? 0);
  if (activeDealPrice <= 0) return null;

  const activeOriginalPrice = Number(
    originalPrices[slotIndex] ?? deal.normalPrice ?? deal.originalPrice ?? regularPrice ?? activeDealPrice,
  );
  const activeImageUrl = normalizeImageUrl(
    String(imageUrls[slotIndex] || deal.imageUrl || imageUrls[0] || ''),
  );

  return {
    ...deal,
    productId: activeProductId,
    dealPrice: activeDealPrice,
    originalPrice: activeOriginalPrice,
    normalPrice: activeOriginalPrice,
    imageUrl: activeImageUrl || deal.imageUrl,
  };
}

function stableUrgencyProgress(product: Product | null, stock: number) {
  if (!product || stock <= 0) return 0;
  const key = String(product.id || product.slug || product.title || 'primehub');
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return 38 + (hash % 53);
}

export function useProductDetail(): ProductDetailModel {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = String(params?.id || '');
  const { settings } = useSettings();
  const addItem = useCartStore((state) => state.addItem);
  const bigDealRequested = searchParams.get('deal') === 'big';

  const cachedAtStart = readCachedProduct<Product>(id);
  const [product, setProduct] = useState<Product | null>(cachedAtStart);
  const [weeklyProducts, setWeeklyProducts] = useState<Record<string, Product>>(
    cachedAtStart ? { [id]: cachedAtStart } : {},
  );
  const [loading, setLoading] = useState(!cachedAtStart);
  const [failed, setFailed] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [wished, setWished] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [variantMode, setVariantMode] = useState<'cart' | 'buy'>('cart');
  const [variantSelection, setVariantSelection] = useState<ProductVariantSelection | undefined>();

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFreshProduct() {
      try {
        const response = await fetch(`/api/storefront/read?type=product&id=${encodeURIComponent(id)}`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`product read ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        const nextProduct =
          data?.product && typeof data.product === 'object'
            ? ({ ...data.product, id: String(data.product.id || id) } as Product)
            : null;
        if (!nextProduct) {
          setProduct(null);
          setFailed(true);
          return;
        }
        setProduct(nextProduct);
        setWeeklyProducts({ [id]: nextProduct });
        cacheProductForNavigation(nextProduct);
        rememberProduct(id);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!id) return () => { cancelled = true; };

    const cached = readCachedProduct<Product>(id);
    if (cached) {
      setProduct((current) => (current?.id === cached.id ? current : cached));
      setWeeklyProducts((current) => (current[id] === cached ? current : { [id]: cached }));
      setLoading(false);
      setFailed(false);
      rememberProduct(id);
      void loadFreshProduct();
    } else {
      setProduct(null);
      setWeeklyProducts({});
      setLoading(true);
      setFailed(false);
      void loadFreshProduct();
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  const regularPrice = product ? regularPriceOf(product) : 0;
  const productOriginal = product ? originalPriceOf(product) : 0;
  const stock = Number(product?.stock ?? product?.quantity ?? product?.inventory ?? 10);
  const rating = Number(product?.rating || 0);
  const reviews = Number(product?.reviews || 0);
  const variantRows = useMemo(() => (product ? getVariantRows(product) : []), [product]);
  const weeklyDeals = useMemo(
    () =>
      ((settings.weeklyDeals || []) as WeeklyDeal[])
        .filter((deal) => deal.active !== false && deal.productId && Number(deal.dealPrice) > 0)
        .sort((a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day)),
    [settings.weeklyDeals],
  );

  useEffect(() => {
    let cancelled = false;
    const browser = window as IdleWindow;
    let idleId: number | null = null;
    let fallbackTimer: number | null = null;
    const ids = Array.from(
      new Set(weeklyDeals.map((deal) => deal.productId).filter((productId) => Boolean(productId) && productId !== id)),
    );
    if (!ids.length) return () => { cancelled = true; };

    const loadWeeklyProducts = () => {
      void loadProductsForNavigation<Product>(ids)
        .then((loaded) => {
          if (cancelled) return;
          setWeeklyProducts((current) => ({
            ...current,
            ...loaded,
            ...(product ? { [product.id]: product } : {}),
          }));
        })
        .catch(() => undefined);
    };

    if (browser.requestIdleCallback) {
      idleId = browser.requestIdleCallback(loadWeeklyProducts, { timeout: 1800 });
    } else {
      fallbackTimer = window.setTimeout(loadWeeklyProducts, 900);
    }

    return () => {
      cancelled = true;
      if (idleId != null) browser.cancelIdleCallback?.(idleId);
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
    };
  }, [weeklyDeals, product, id]);

  const currentDeal = useMemo(() => weeklyDeals.find((deal) => deal.productId === id), [weeklyDeals, id]);
  const timing = currentDeal ? dealTiming(currentDeal.day, new Date(nowTick)) : null;
  const liveDeal = Boolean(currentDeal && timing?.isLive);
  const dealPrice = currentDeal ? Number(currentDeal.dealPrice || 0) : 0;
  const normalForDeal = currentDeal
    ? Number(weeklyProducts[id]?.price || currentDeal.originalPrice || regularPrice)
    : productOriginal;
  const savingsAmount =
    currentDeal && dealPrice > 0 && normalForDeal > dealPrice ? normalForDeal - dealPrice : 0;
  const savingsPercent = dealDiscount(dealPrice, normalForDeal);
  const countdown = timing ? countdownParts(timing.unlockAt.getTime() - nowTick) : null;

  const activeAdminDeal = useMemo(() => {
    if (!product || !bigDealRequested) return null;
    const now = nowTick;
    const candidates = [(settings as any).dailyDeal, (settings as any).bigDeal].filter(Boolean);
    for (const deal of candidates) {
      const resolved = currentBigDealForProduct(deal, product.id, now, regularPrice);
      if (resolved) return resolved;
    }
    return null;
  }, [product, settings, nowTick, regularPrice, bigDealRequested]);

  const images = useMemo(() => {
    const productImages = product ? imagesOf(product) : [];
    const bigDealImage = bigDealRequested
      ? normalizeImageUrl(String(activeAdminDeal?.imageUrl || ''))
      : '';
    const weeklyDealImage = currentDeal
      ? normalizeImageUrl(String(currentDeal.imageUrl || ''))
      : '';
    const preferredDealImage = bigDealImage || weeklyDealImage;
    return preferredDealImage
      ? [preferredDealImage, ...productImages.filter((image) => image !== preferredDealImage)]
      : productImages;
  }, [product, bigDealRequested, activeAdminDeal?.imageUrl, currentDeal?.imageUrl]);

  const bigDealActive = Boolean(activeAdminDeal);
  const activeDealPrice = activeAdminDeal
    ? Number(activeAdminDeal.dealPrice || activeAdminDeal.price || 0)
    : null;
  const activeDealNormalPrice = activeAdminDeal
    ? Number(activeAdminDeal.normalPrice || activeAdminDeal.originalPrice || regularPrice)
    : 0;
  const effectiveCurrentPrice =
    activeDealPrice && activeDealPrice > 0
      ? activeDealPrice
      : liveDeal && dealPrice > 0
        ? dealPrice
        : regularPrice;
  const effectiveNormalPrice = activeAdminDeal
    ? activeDealNormalPrice
    : liveDeal && normalForDeal > effectiveCurrentPrice
      ? normalForDeal
      : productOriginal || regularPrice;
  const effectiveSavings =
    effectiveNormalPrice > effectiveCurrentPrice ? effectiveNormalPrice - effectiveCurrentPrice : 0;
  const effectiveSavingsPercent = dealDiscount(effectiveCurrentPrice, effectiveNormalPrice);
  const effectiveLiveDeal = Boolean(activeAdminDeal || liveDeal);
  const effectiveDealPrice = activeDealPrice && activeDealPrice > 0 ? activeDealPrice : dealPrice;
  const currentPrice = effectiveCurrentPrice;
  const whatsappNumber = String(settings.whatsappNumber || '').replace(/\D/g, '');
  const maxQuantity = stock > 0 ? stock : undefined;
  const stockProgress = stableUrgencyProgress(product, stock);
  const bannerCountdown = countdown
    ? liveDeal
      ? `${countdown.hours.toString().padStart(2, '0')}:${countdown.minutes.toString().padStart(2, '0')}:${countdown.seconds.toString().padStart(2, '0')}`
      : `${countdown.days}d ${countdown.hours.toString().padStart(2, '0')}:${countdown.minutes.toString().padStart(2, '0')}:${countdown.seconds.toString().padStart(2, '0')}`
    : '—';
  const hasVariants = variantRows.length > 0;

  const addResolved = (selection: ProductVariantSelection | undefined, qty: number) => {
    if (!product || currentPrice <= 0 || stock === 0) return;
    const row =
      selection && variantRows.length
        ? variantRows.find(
            (candidate) =>
              (!selection.color || candidate.color === selection.color) &&
              (!selection.size || candidate.size === selection.size),
          )
        : undefined;
    const selectedStock = row ? Number(row.stock ?? 0) : stock;
    if (selectedStock <= 0) return;
    const price =
      activeDealPrice && activeDealPrice > 0
        ? activeDealPrice
        : liveDeal
          ? currentPrice
          : Number(row?.price ?? currentPrice) || currentPrice;
    const image = String(row?.imageUrl || images[0] || product.imageUrl || product.image || '');
    const cartItem = {
      id:
        selection && Object.values(selection).some(Boolean)
          ? `${product.id}:${Object.entries(selection)
              .filter(([, value]) => value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => `${key}-${value}`)
              .join('|')}`
          : product.id,
      productId: product.id,
      name: titleOf(product),
      price,
      originalPrice: effectiveNormalPrice || productOriginal || price,
      image,
      imageUrl: image,
      dealDay: !activeAdminDeal && liveDeal && currentDeal ? currentDeal.day : undefined,
      variant: selection,
    };
    for (let index = 0; index < Math.min(qty, selectedStock); index += 1) addItem(cartItem);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  const addProduct = () => {
    if (hasVariants) {
      setVariantMode('cart');
      setVariantModalOpen(true);
      return;
    }
    addResolved(undefined, quantity);
  };

  const orderNow = () => {
    if (hasVariants) {
      setVariantMode('buy');
      setVariantModalOpen(true);
      return;
    }
    if (!product || currentPrice <= 0 || stock === 0) return;
    addResolved(undefined, quantity);
    router.push('/checkout');
  };

  const openVariantSelector = (mode: 'cart' | 'buy') => {
    if (!hasVariants) {
      if (mode === 'buy') orderNow();
      else addProduct();
      return;
    }
    setVariantMode(mode);
    setVariantModalOpen(true);
  };

  const closeVariantSelector = () => setVariantModalOpen(false);

  const confirmVariant = (selection: ProductVariantSelection, qty: number) => {
    setVariantSelection(selection);
    setVariantModalOpen(false);
    addResolved(selection, qty);
    if (variantMode === 'buy') router.push('/checkout');
  };

  const buyWhatsApp = () => {
    if (!product || currentPrice <= 0 || stock === 0) return;
    const variantText =
      variantSelection && Object.values(variantSelection).some(Boolean)
        ? `Variant: ${Object.entries(variantSelection)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' / ')}`
        : '';
    const text = [
      '🛍️ PrimeHub Deals — Product Order',
      '',
      `Product: ${titleOf(product)}`,
      variantText,
      `Quantity: ${quantity}`,
      `Price: ${money(currentPrice)}`,
      `Total: ${money(currentPrice * quantity)}`,
      '',
      window.location.href,
    ]
      .filter(Boolean)
      .join('\n');
    if (!whatsappNumber) return;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return {
    product,
    weeklyProducts,
    loading,
    failed,
    activeImage,
    quantity,
    wished,
    videoOpen,
    added,
    nowTick,
    images,
    regularPrice,
    productOriginal,
    stock,
    rating,
    reviews,
    weeklyDeals,
    currentDeal,
    liveDeal,
    bigDealActive,
    activeAdminDeal,
    dealPrice: effectiveDealPrice,
    normalForDeal: effectiveNormalPrice,
    savingsAmount: effectiveSavings,
    savingsPercent: effectiveSavingsPercent,
    countdown,
    bannerCountdown,
    currentPrice,
    maxQuantity,
    stockProgress,
    variantRows,
    variantModalOpen,
    variantMode,
    variantSelection,
    setActiveImage,
    setQuantity,
    setWished,
    setVideoOpen,
    addProduct,
    orderNow,
    openVariantSelector,
    buyWhatsApp,
    closeVariantSelector,
    confirmVariant,
  };
}
