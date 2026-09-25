"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Package, ShoppingCart } from "lucide-react";
import FastProductLink from "@/components/FastProductLink";
import HomeHeading from "@/components/home/HomeHeading";
import { useSettings } from "@/lib/useSettings";
import { useCartStore } from "@/lib/cartStore";
import {
  availableStockOf,
  imageOf,
  originalOf,
  productHasVariants,
  titleOf,
  type Product,
} from "@/components/shop/ShopTypes";
import { isDirectStorefrontImage } from "@/lib/imageUrl";
import { getEffectivePrice } from "@/lib/dealPricing";
import { isWholesaleProduct } from "@/lib/wholesale";
import {
  isWholesalePriceBucket,
  matchesPriceBucket,
  matchesSaleMelaBucket,
  saleMelaBucketLabel,
  saleMelaPriceRange,
  sortPriceBuckets,
} from "@/lib/priceBucketUtils";

export function homePrice(product: Product) {
  return getEffectivePrice({
    price: Number(product.normalPrice || product.price || 0),
    dealPrice: Number(product.dealPrice || 0),
    dealDay: String(product.dealDay || ""),
  });
}

function productTime(product: Product) {
  const value = product.createdAt || product.updatedAt;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function seededUnit(seed: number, key: string) {
  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 4294967295;
}

function shuffleWithNewArrivalPriority(products: Product[], seed: number) {
  if (products.length < 2 || seed === 0) return [...products];

  const newest = [...products].sort(
    (a, b) => productTime(b) - productTime(a) || b.id.localeCompare(a.id),
  );
  const timestamped = newest.filter((product) => productTime(product) > 0);
  const freshnessRank = new Map<string, number>();
  timestamped.forEach((product, index) => {
    const denominator = Math.max(1, timestamped.length - 1);
    freshnessRank.set(product.id, 1 - index / denominator);
  });

  return [...products].sort((a, b) => {
    const aFreshness = freshnessRank.get(a.id) ?? 0;
    const bFreshness = freshnessRank.get(b.id) ?? 0;
    const aScore = seededUnit(seed, a.id) * 0.55 + aFreshness * 0.9;
    const bScore = seededUnit(seed, b.id) * 0.55 + bFreshness * 0.9;
    return bScore - aScore || b.id.localeCompare(a.id);
  });
}

function isKidsWholesaleProduct(product: Product) {
  const searchable = `${titleOf(product)} ${product.packDescription || ""}`.toLowerCase();
  return /\bkids?\b/.test(searchable);
}

export function HomeProductCard({
  product,
  horizontal = false,
  pack = false,
  badgeText,
  cropImageEdges = false,
}: {
  product: Product;
  horizontal?: boolean;
  pack?: boolean;
  badgeText?: string;
  cropImageEdges?: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const openVariantModal = useCartStore((s) => s.openVariantModal);
  const [added, setAdded] = useState(false);
  const price = homePrice(product);
  const src = imageOf(product);
  const available = availableStockOf(product) > 0 && price > 0;

  function add() {
    if (!available) return;
    if (
      productHasVariants(product) &&
      openVariantModal({ ...product, price, image: src, imageUrl: src }, "cart")
    )
      return;

    addItem({
      id: product.id,
      name: titleOf(product),
      price,
      originalPrice: originalOf(product) || price,
      image: src,
      imageUrl: src,
      dealDay: product.dealDay,
    });
    setAdded(true);
  }

  return (
    <article
      className={`home-product ${horizontal ? "home-product-horizontal" : ""}`}
    >
      <FastProductLink
        product={product}
        className="home-product-image"
        aria-label={`View ${titleOf(product)}`}
      >
        {src ? (
          <Image
            src={src}
            alt={titleOf(product)}
            fill
            unoptimized={isDirectStorefrontImage(src)}
            sizes="(max-width: 600px) 40vw, 300px"
            className="object-cover"
            style={cropImageEdges ? { transform: "scale(1.08)" } : undefined}
          />
        ) : (
          <Package aria-label="Image unavailable" />
        )}
        {badgeText ? (
          <span className="home-product-badge home-product-badge-new">
            <span aria-hidden="true">✦</span>
            {badgeText}
          </span>
        ) : null}
      </FastProductLink>
      <div className="home-product-info">
        <FastProductLink product={product} className="home-product-title">
          {titleOf(product)}
        </FastProductLink>
        {pack && (
          <span className="home-pack-description">
            {product.packDescription || "Wholesale collection"}
          </span>
        )}
        <strong className="home-price">
          Rs. {price.toLocaleString("en-PK")}
        </strong>
        {pack ? (
          <FastProductLink product={product} className="home-add">
            View Pack
          </FastProductLink>
        ) : (
          <button
            className="home-add"
            onClick={add}
            disabled={!available}
            aria-label={`${available ? "Add to cart:" : "Sold out:"} ${titleOf(product)}`}
          >
            <span aria-live="polite">
              {!available ? "Sold out" : added ? "Add another" : "Add to cart"}
            </span>
            <ShoppingCart size={15} />
          </button>
        )}
      </div>
    </article>
  );
}

function bucketAnchor(amount: number | null, wholesale: boolean) {
  return wholesale ? "bucket-wholesale" : `bucket-${Number(amount)}`;
}

function bucketHref(amount: number | null, wholesale: boolean) {
  return `/primehubmall/salemela#${bucketAnchor(amount, wholesale)}`;
}

function sortBySalePrice(products: Product[]) {
  return [...products].sort(
    (a, b) => homePrice(a) - homePrice(b) || a.id.localeCompare(b.id),
  );
}

const standaloneGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "6px",
  overflow: "visible",
  paddingBottom: "3px",
  scrollSnapType: "none",
} as const;

export default function HomeCollections({
  products,
  standalone = false,
}: {
  products: Product[];
  standalone?: boolean;
  onSelect?: (amount: number | null) => void;
  onWholesaleSelect?: () => void;
}) {
  const { settings } = useSettings();
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const catalog = products.filter((p) => p.published !== false);
  const buckets = sortPriceBuckets(
    (settings.priceBuckets || []).filter((b) => b.active),
  );
  const packs = catalog.filter(isWholesaleProduct);
  const kidsPacks = packs.filter(isKidsWholesaleProduct);
  const regularPacks = packs.filter((product) => !isKidsWholesaleProduct(product));

  useEffect(() => {
    const values = new Uint32Array(1);
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(values);
      setShuffleSeed(values[0] || Date.now());
      return;
    }
    setShuffleSeed((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  }, []);

  return (
    <>
      {buckets.length > 0 && (
        <section className="home-sale" aria-label="PrimeHubMall Sale Mela">
          <HomeHeading
            href={standalone ? undefined : "/primehubmall/salemela"}
            actionLabel={standalone ? undefined : "Open"}
            title={standalone ? undefined : "Open PrimeHubMall Sale Mela"}
          >
            <>
              PrimeHubMall <span className="text-[#d60707]">Sale Mela</span>
            </>
          </HomeHeading>

          {buckets.map((bucket) => {
            const wholesale = isWholesalePriceBucket(bucket);
            const amount = Number(bucket.amount || 0);
            const anchor = bucketAnchor(bucket.amount ?? null, wholesale);
            const href = standalone
              ? `#${anchor}`
              : bucketHref(bucket.amount ?? null, wholesale);
            const saleRange = saleMelaPriceRange(amount);
            const packSource = standalone && wholesale ? regularPacks : packs;
            const baseMatches = wholesale
              ? sortBySalePrice(packSource)
              : sortBySalePrice(
                  catalog.filter((product) => {
                    if (isWholesaleProduct(product)) return false;
                    const price = homePrice(product);
                    return saleRange
                      ? matchesSaleMelaBucket(price, amount)
                      : matchesPriceBucket(price, buckets, amount);
                  }),
                );
            const matches = standalone && !wholesale
              ? baseMatches
              : shuffleWithNewArrivalPriority(baseMatches, shuffleSeed);
            const kidsMatches = standalone && wholesale
              ? shuffleWithNewArrivalPriority(
                  sortBySalePrice(kidsPacks),
                  (shuffleSeed ^ 0x9e3779b9) >>> 0,
                )
              : [];

            const budgetLink = (
              <Link
                className="home-budget"
                href={href}
                prefetch={!standalone}
                style={standalone ? {
                  width: "clamp(96px, 23vw, 145px)",
                  padding: "0",
                  marginBottom: "12px",
                } : undefined}
                aria-label={`Browse ${bucket.title} in PrimeHubMall Sale Mela`}
              >
                <span className="home-budget-medallion">
                  {wholesale ? (
                    <Package size={42} />
                  ) : (
                    <>
                      <small>Rs.</small>
                      <b>{amount.toLocaleString("en-PK")}</b>
                    </>
                  )}
                </span>
                <span className="home-budget-label">
                  {standalone && !wholesale ? saleMelaBucketLabel(amount) : !wholesale && amount === 99 ? "Rs. 99–298" : !wholesale && amount === 299 ? "Rs. 299–998" : !wholesale && amount === 999 ? "Rs. 999+" : bucket.title}
                </span>
              </Link>
            );

            return (
              <div
                id={anchor}
                className={`home-sale-row scroll-mt-24 ${wholesale ? "home-sale-wholesale" : ""}`}
                style={standalone ? { display: "block", marginBottom: "28px" } : undefined}
                key={bucket.id}
              >
                {standalone && wholesale && kidsPacks.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                    aria-label="Wholesale collection shortcuts"
                  >
                    {budgetLink}
                    <Link
                      className="home-budget"
                      href="#bucket-kids-metal-wholesale"
                      style={{
                        width: "clamp(96px, 23vw, 145px)",
                        padding: "0",
                        marginBottom: "12px",
                      }}
                      aria-label="Jump to Kids Metal Wholesale"
                    >
                      <span className="home-budget-medallion">
                        <Package size={34} />
                        <small style={{ marginTop: "2px", fontWeight: 900 }}>KIDS</small>
                      </span>
                      <span className="home-budget-label">Kids Metal Wholesale</span>
                    </Link>
                  </div>
                ) : budgetLink}

                <div
                  className="home-sale-products [scrollbar-width:none]"
                  style={standalone ? standaloneGridStyle : {
                    display: "flex",
                    gridTemplateColumns: "none",
                    gap: "6px",
                    overflowX: "auto",
                    overscrollBehaviorX: "contain",
                    paddingBottom: "3px",
                    scrollSnapType: "x mandatory",
                  }}
                  aria-label={`${bucket.title} products`}
                >
                  {matches.length ? (
                    matches.map((product) => (
                      <div
                        key={product.id}
                        style={standalone ? {
                          minWidth: 0,
                        } : {
                          flex: "0 0 calc((100% - 12px) / 3)",
                          minWidth: 0,
                          scrollSnapAlign: "start",
                        }}
                      >
                        <HomeProductCard
                          product={product}
                          pack={wholesale}
                          cropImageEdges={standalone && wholesale}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="home-empty">
                      New offers are on their way.{" "}
                      <Link href={href} prefetch={!standalone}>
                        Browse collection <ChevronRight size={14} />
                      </Link>
                    </p>
                  )}
                </div>

                {standalone && wholesale && kidsPacks.length > 0 ? (
                  <section
                    id="bucket-kids-metal-wholesale"
                    className="scroll-mt-24"
                    style={{ marginTop: "30px" }}
                    aria-label="Kids Metal Wholesale"
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span
                          className="home-budget-medallion"
                          style={{ width: "58px", height: "58px", flex: "0 0 58px" }}
                          aria-hidden="true"
                        >
                          <Package size={27} />
                        </span>
                        <div>
                          <p style={{ fontSize: "18px", fontWeight: 900, lineHeight: 1.1 }}>
                            Kids Metal Wholesale
                          </p>
                          <p style={{ marginTop: "4px", fontSize: "12px", color: "rgba(0,0,0,.55)" }}>
                            Kids wholesale packs
                          </p>
                        </div>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "rgba(0,0,0,.48)" }}>
                        {kidsMatches.length} packs
                      </span>
                    </div>

                    <div
                      className="home-sale-products [scrollbar-width:none]"
                      style={standaloneGridStyle}
                    >
                      {kidsMatches.map((product) => (
                        <div key={product.id} style={{ minWidth: 0 }}>
                          <HomeProductCard product={product} pack cropImageEdges />
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
