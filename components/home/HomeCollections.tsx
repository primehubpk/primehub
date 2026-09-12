"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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
import { getEffectivePrice } from "@/lib/dealPricing";
import { isWholesaleProduct } from "@/lib/wholesale";
import {
  isWholesalePriceBucket,
  matchesPriceBucket,
  matchesSaleMelaBucket,
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

export function HomeProductCard({
  product,
  horizontal = false,
  pack = false,
}: {
  product: Product;
  horizontal?: boolean;
  pack?: boolean;
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
            sizes="(max-width: 600px) 40vw, 300px"
            className="object-cover"
          />
        ) : (
          <Package aria-label="Image unavailable" />
        )}
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
  const catalog = products.filter((p) => p.published !== false);
  const buckets = sortPriceBuckets(
    (settings.priceBuckets || []).filter((b) => b.active),
  );
  const packs = catalog.filter(isWholesaleProduct);

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
            const matches = wholesale
              ? sortBySalePrice(packs)
              : sortBySalePrice(
                  catalog.filter((product) => {
                    if (isWholesaleProduct(product)) return false;
                    const price = homePrice(product);
                    return saleRange
                      ? matchesSaleMelaBucket(price, amount)
                      : matchesPriceBucket(price, buckets, amount);
                  }),
                );

            return (
              <div
                id={anchor}
                className={`home-sale-row scroll-mt-24 ${wholesale ? "home-sale-wholesale" : ""}`}
                key={bucket.id}
              >
                <Link
                  className="home-budget"
                  href={href}
                  prefetch={!standalone}
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
                  <span className="home-budget-label">{bucket.title}</span>
                </Link>

                <div
                  className="home-sale-products [scrollbar-width:none]"
                  style={{
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
                        style={{
                          flex: "0 0 calc((100% - 12px) / 3)",
                          minWidth: 0,
                          scrollSnapAlign: "start",
                        }}
                      >
                        <HomeProductCard
                          product={product}
                          pack={wholesale}
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
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
