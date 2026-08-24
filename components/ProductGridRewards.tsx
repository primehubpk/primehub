'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ArrowDownUp,
  Check,
  Heart,
  LogIn,
  Play,
  Plus,
  ShoppingBag,
  X,
  Zap,
  Gift,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { ProductUrgencyBadges } from '@/components/ProductCard';

type Product = {
  id: string;
  title?: string;
  name?: string;
  price?: number | string;
  dealPrice?: number | string;
  normalPrice?: number | string;
  compareAtPrice?: number;
  originalPrice?: number;
  imageUrl?: string;
  image?: string;
  images?: Array<string | { url?: string }>;
  category?: string;
  stock?: number;
  quantity?: number;
  isFlashSale?: boolean;
  priceBucketIds?: string[];
  priceBuckets?: Array<string | { id?: string; name?: string; title?: string }>;
  buckets?: Array<string | { id?: string; name?: string; title?: string }>;
  videoUrl?: string;
  reelUrl?: string;
  [key: string]: any;
};

type Reward = {
  id: string;
  productId?: string;
  pointsCost?: number;
  active?: boolean;
  stock?: number;
  imageUrl?: string;
  title?: string;
};

type Sort = 'featured' | 'low' | 'high' | 'discount';

const GUEST_KEY = 'phdeals-guest-rewards';

const title = (p: Product) => p.title || p.name || 'Untitled Product';

const image = (p: Product) => {
  const first = p.images?.[0];
  return (typeof first === 'object' ? first?.url : first) || p.imageUrl || p.image || '';
};

const safeNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const effectivePrice = (p: Product) =>
  safeNumber(p.dealPrice || p.normalPrice || p.price || 0);

const original = (p: Product) =>
  safeNumber(p.compareAtPrice ?? p.originalPrice ?? 0);

const discount = (p: Product) => {
  const o = original(p);
  const v = effectivePrice(p);
  return o > v ? Math.round(((o - v) / o) * 100) : 0;
};

const sameImage = (a: string, b: string) => Boolean(a && b && a.trim() === b.trim());

function getModalProduct(p: Product): Product {
  const rawOptions = Array.isArray(p.options) ? p.options : [];
  const existingVariantOptions = Array.isArray(p.variantOptions) ? p.variantOptions : [];

  const normalizedOptions = rawOptions
    .map((option: any, index: number) => {
      if (!option || typeof option !== 'object') return null;
      const id = String(option.id ?? option.name ?? option.label ?? `option-${index}`);
      const values = Array.isArray(option.values)
        ? option.values.map((value: unknown) => String(value)).filter(Boolean)
        : Array.isArray(option.options)
          ? option.options.map((value: unknown) => String(value)).filter(Boolean)
          : [];
      return values.length > 0 ? { id, values } : null;
    })
    .filter((option): option is { id: string; values: string[] } => Boolean(option));

  if (!normalizedOptions.length || existingVariantOptions.length > 0) {
    return p;
  }

  return {
    ...p,
    variantOptions: normalizedOptions,
  };
}

export default function ProductGridRewards({
  selectedMaxPrice = null,
  wholesaleSelected = false,
}: {
  selectedMaxPrice?: number | null;
  wholesaleSelected?: boolean;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [gifts, setGifts] = useState<Reward[]>([]);
  const [points, setPoints] = useState(0);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>('featured');
  const [wish, setWish] = useState<string[]>([]);
  const [video, setVideo] = useState<Product | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const addItem = useCartStore((s) => s.addItem);
  const openVariantModal = useCartStore((s) => s.openVariantModal);

  useEffect(() => {
    const unsubscribeProducts = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        setProducts(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );

    const unsubscribeGifts = onSnapshot(collection(db, 'reward_gifts'), (snapshot) => {
      setGifts(
        snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Reward)
          .filter((gift) => gift.active !== false && Number(gift.pointsCost) > 0),
      );
    });

    return () => {
      unsubscribeProducts();
      unsubscribeGifts();
    };
  }, []);

  const rewards = useMemo(() => {
    const map: Record<string, { id: string; points: number; stock: number }> = {};

    for (const gift of gifts) {
      let productId = gift.productId;
      const rewardImage = gift.imageUrl;

      if (!productId && rewardImage) {
        const match = products.find(
          (product) =>
            sameImage(image(product), rewardImage) ||
            (Array.isArray(product.images) &&
              product.images.some((item) =>
                sameImage(
                  typeof item === 'object' ? item.url || '' : item,
                  rewardImage,
                ),
              )),
        );

        if (match) {
          productId = match.id;
        }
      }

      if (productId) {
        map[productId] = {
          id: gift.id,
          points: Number(gift.pointsCost),
          stock: Number(gift.stock ?? 1),
        };
      }
    }

    return map;
  }, [gifts, products]);

  useEffect(() => {
    let unsubscribeUserRewards = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeUserRewards();
      setUid(user?.uid || null);

      if (user) {
        unsubscribeUserRewards = onSnapshot(
          doc(db, 'user_rewards', user.uid),
          (snapshot) => setPoints(Number(snapshot.data()?.points || 0)),
        );
      } else {
        try {
          setPoints(
            Number(JSON.parse(localStorage.getItem(GUEST_KEY) || '{}')?.points || 0),
          );
        } catch {
          setPoints(0);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUserRewards();
    };
  }, []);

  const visible = useMemo(() => {
    const hasNumericBudget = selectedMaxPrice !== null;
    const hasSelectedFilter = wholesaleSelected || hasNumericBudget;

    const filtered = products.filter((product) => {
      if (wholesaleSelected) {
        return product.isWholesale === true;
      }

      if (hasNumericBudget) {
        return effectivePrice(product) <= Number(selectedMaxPrice);
      }

      return true;
    });

    if (process.env.NODE_ENV === 'development' && hasSelectedFilter) {
      console.log('Filtered Price Bucket Products:', {
        wholesaleSelected,
        selectedMaxPrice,
        filtered,
      });
    }

    if (hasNumericBudget && !wholesaleSelected) {
      filtered.sort((a, b) => effectivePrice(b) - effectivePrice(a));
    } else {
      filtered.sort((a, b) => {
        if (sort === 'low') return effectivePrice(a) - effectivePrice(b);
        if (sort === 'high') return effectivePrice(b) - effectivePrice(a);
        if (sort === 'discount') return discount(b) - discount(a);
        return Number(Boolean(b.isFlashSale)) - Number(Boolean(a.isFlashSale));
      });
    }

    return filtered;
  }, [
    products,
    selectedMaxPrice,
    wholesaleSelected,
    sort,
  ]);

  function add(p: Product) {
    const img = image(p);
    const modalProduct = getModalProduct(p);
    const hasVariants = Boolean(
      (Array.isArray(modalProduct.variants) && modalProduct.variants.length > 0) ||
      (Array.isArray(modalProduct.variantMatrix) && modalProduct.variantMatrix.length > 0) ||
      (Array.isArray(modalProduct.variantColors) && modalProduct.variantColors.length > 0) ||
      (Array.isArray(modalProduct.variantSizes) && modalProduct.variantSizes.length > 0) ||
      (Array.isArray(modalProduct.variantOptions) && modalProduct.variantOptions.length > 0) ||
      (Array.isArray(modalProduct.options) && modalProduct.options.length > 0) ||
      modalProduct.hasVariants === true,
    );

    if (hasVariants && typeof openVariantModal === 'function') {
      const opened = openVariantModal(modalProduct as any, 'cart');
      if (opened) return;
    }

    addItem({
      id: p.id,
      name: title(p),
      price: effectivePrice(p),
      originalPrice: original(p) || effectivePrice(p),
      image: img,
      imageUrl: img,
    });

    setAdded(p.id);
    setTimeout(() => setAdded(null), 1100);
  }

  async function redeem(
    p: Product,
    r: { id: string; points: number; stock: number },
  ) {
    if (!uid) {
      window.location.href = '/login?redirect=/rewards#redeem-rewards';
      return;
    }

    setNotice('');
    setRedeeming(p.id);

    try {
      await runTransaction(db, async (tx) => {
        const wallet = doc(db, 'user_rewards', uid);
        const redemption = doc(collection(db, 'reward_redemptions'));
        const snapshot = await tx.get(wallet);
        const current = Number(snapshot.data()?.points || 0);

        if (current < r.points) {
          throw new Error(`You need ${r.points - current} more points.`);
        }

        if (r.stock < 1) {
          throw new Error('This reward is out of stock.');
        }

        tx.set(
          wallet,
          { points: current - r.points, updatedAt: serverTimestamp() },
          { merge: true },
        );

        tx.set(redemption, {
          userId: uid,
          giftId: r.id,
          productId: p.id,
          pointsCost: r.points,
          status: 'pending',
          fulfillment: 'reward',
          freeDelivery: true,
          deliveryFee: 0,
          createdAt: serverTimestamp(),
        });
      });

      setPoints((current) => Math.max(0, current - r.points));
      setNotice(
        `${title(p)} reward claimed. ${r.points} points deducted and FREE DELIVERY included.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Redemption failed. Please try again.',
      );
    } finally {
      setRedeeming(null);
    }
  }

  if (loading) {
    return (
      <section className="mt-8 px-4">
        <div className="mb-4 h-7 w-44 animate-pulse rounded-lg bg-black/8" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[.8] animate-pulse rounded-[22px] bg-white"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 px-4 pb-40">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[#E1352B]">
            <ShoppingBag size={14} />
            <span className="text-[10px] font-black uppercase tracking-[.2em]">
              PrimeHub picks
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Discover deals</h2>
          <p className="mt-1 text-xs text-black/45">
            {visible.length} product{visible.length === 1 ? '' : 's'} to explore
          </p>
        </div>

        <Link
          href="/rewards#redeem-rewards"
          className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#14140F] px-3 py-2.5 text-[9px] font-black text-white"
        >
          <Gift size={13} className="text-[#FFB020]" />
          Redeem Rewards
        </Link>

        <label className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-black/8 bg-white px-2.5 py-2.5">
          <ArrowDownUp size={14} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="max-w-[90px] bg-transparent text-[10px] font-black outline-none"
          >
            <option value="featured">Featured</option>
            <option value="discount">Best deal</option>
            <option value="low">Low price</option>
            <option value="high">High price</option>
          </select>
        </label>
      </div>

      {notice && (
        <p className="mb-3 rounded-xl bg-[#0F6A5F] p-3 text-center text-[10px] font-black text-white">
          {notice}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-black/10 bg-white px-5 py-12 text-center">
          <p className="text-sm font-black">No products found</p>
          <p className="mt-1 text-xs text-black/45">
            {wholesaleSelected
              ? 'There are no wholesale products available right now.'
              : 'There are no products matching this filter right now.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((p) => {
            const r = rewards[p.id];
            const pts = points;
            const need = r ? Math.max(0, r.points - pts) : 0;
            const can = Boolean(r && pts >= r.points && r.stock > 0);
            const wished = wish.includes(p.id);
            const img = image(p);
            const stock = Number(p.stock ?? p.quantity ?? 0);

            return (
              <article
                key={p.id}
                className="overflow-hidden rounded-[24px] border border-black/7 bg-white shadow-sm"
              >
                <div className="relative aspect-square overflow-hidden bg-[#F4F4F1]">
                  {img ? (
                    <Link href={`/product/${p.id}`} className="block h-full w-full">
                      <Image
                        src={img}
                        alt={title(p)}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 50vw, 320px"
                        className="object-cover"
                        onError={(event) => {
                          event.currentTarget.src = '/placeholder.png';
                        }}
                      />
                    </Link>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-black/30">
                      No image
                    </div>
                  )}

                  {discount(p) > 0 && (
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-[#E1352B] px-2 py-1 text-[9px] font-black text-white">
                      -{discount(p)}%
                    </span>
                  )}

                  {r && (
                    <span className="absolute left-2.5 top-10 inline-flex items-center gap-1 rounded-full bg-[#0F6A5F] px-2.5 py-1.5 text-[9px] font-black text-white">
                      <Gift size={10} />
                      FREE GIFT · {r.points} PTS
                    </span>
                  )}

                  {p.isFlashSale && (
                    <span className="absolute left-2.5 top-[4.25rem] inline-flex items-center gap-1 rounded-full bg-[#14140F] px-2 py-1 text-[9px] font-black text-white">
                      <Zap size={9} />
                      FLASH
                    </span>
                  )}

                  <div className="absolute right-2.5 top-2.5 flex gap-1.5">
                    {(p.videoUrl || p.reelUrl) && (
                      <button
                        type="button"
                        onClick={() => setVideo(p)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90"
                      >
                        <Play size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setWish((current) =>
                          current.includes(p.id)
                            ? current.filter((id) => id !== p.id)
                            : [...current, p.id],
                        )
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90"
                    >
                      <Heart
                        size={14}
                        className={wished ? 'text-[#E1352B]' : 'text-[#14140F]'}
                        fill={wished ? 'currentColor' : 'none'}
                      />
                    </button>
                  </div>

                  {stock > 0 && stock <= 5 && (
                    <span className="absolute bottom-2.5 left-2.5 rounded-full bg-[#FFB020] px-2 py-1 text-[9px] font-black">
                      Only {stock} left
                    </span>
                  )}

                  <ProductUrgencyBadges stock={stock} productId={p.id} />
                </div>

                <div className="p-3">
                  <Link href={`/product/${p.id}`} className="block">
                    <p className="line-clamp-2 min-h-[32px] text-[12px] font-extrabold leading-4">
                      {title(p)}
                    </p>
                    <div className="mt-2 flex items-end gap-1.5">
                      <span className="text-[16px] font-black text-[#E1352B]">
                        Rs. {effectivePrice(p).toLocaleString()}
                      </span>
                      {original(p) > effectivePrice(p) && (
                        <span className="text-[9px] text-black/35 line-through">
                          Rs. {original(p).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {r && (
                      <div className="mt-2 rounded-xl bg-[#F7F7F2] p-2">
                        <p className="text-[10px] font-black text-[#0F6A5F]">
                          FREE with {r.points} points
                        </p>
                        <p className="mt-0.5 text-[9px] font-bold text-black/45">
                          You have {pts} points
                        </p>
                        {need > 0 ? (
                          <>
                            <p className="text-[9px] font-bold text-black/45">
                              Need {need} more points
                            </p>
                            <Link
                              href="/rewards"
                              className="mt-1 inline-flex text-[9px] font-black text-[#E1352B]"
                            >
                              Earn More Points →
                            </Link>
                          </>
                        ) : (
                          <p className="mt-0.5 text-[9px] font-black text-[#0F6A5F]">
                            ✓ You have enough points to redeem
                          </p>
                        )}
                      </div>
                    )}
                  </Link>

                  {r ? (
                    <button
                      type="button"
                      onClick={() => redeem(p, r)}
                      disabled={redeeming === p.id || Boolean(uid && !can)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#E1352B] py-2.5 text-[10px] font-black text-white disabled:opacity-50"
                    >
                      {!uid ? (
                        <>
                          <LogIn size={12} />
                          Login to redeem
                        </>
                      ) : redeeming === p.id ? (
                        'Submitting...'
                      ) : can ? (
                        'Redeem for FREE'
                      ) : (
                        'Need ' + need + ' more points'
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => add(p)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#14140F] py-2.5 text-[10px] font-black text-white"
                    >
                      {added === p.id ? (
                        <>
                          <Check size={13} />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus size={13} />
                          Add to cart
                        </>
                      )}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center text-[9px] font-bold text-black/35">
        Reward badges appear on products linked to a reward image or product in the admin Reward Store.
      </div>

      {video && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setVideo(null)}
        >
          <div
            className="relative w-full max-w-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setVideo(null)}
              className="absolute -right-1 -top-12 h-9 w-9 rounded-full bg-white"
            >
              <X size={16} className="mx-auto" />
            </button>
            <video
              src={video.videoUrl || video.reelUrl || ''}
              controls
              playsInline
              autoPlay
              className="max-h-[78vh] w-full rounded-3xl bg-black"
            />
          </div>
        </div>
      )}
    </section>
  );
}
