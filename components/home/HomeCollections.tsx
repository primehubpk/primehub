"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Package, ShoppingCart } from "lucide-react";
import HomeHeading from "./HomeHeading";
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
      <Link
        href={`/product/${product.id}`}
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
      </Link>
      <div className="home-product-info">
        <Link href={`/product/${product.id}`} className="home-product-title">
          {titleOf(product)}
        </Link>
        {pack && (
          <span className="home-pack-description">
            {product.packDescription || "Wholesale collection"}
          </span>
        )}
        <strong className="home-price">
          Rs. {price.toLocaleString("en-PK")}
        </strong>
        {pack ? (
          <Link href={`/product/${product.id}`} className="home-add">
            View Pack
          </Link>
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

export default function HomeCollections({
  products,
  onSelect,
  onWholesaleSelect,
}: {
  products: Product[];
  onSelect: (amount: number | null) => void;
  onWholesaleSelect: () => void;
}) {
  const { settings } = useSettings();
  const catalog = products.filter((p) => p.published !== false);
  const buckets = sortPriceBuckets(
    (settings.priceBuckets || []).filter((b) => b.active),
  );
  const packs = catalog.filter(isWholesaleProduct);
  function select(amount: number | null, wholesale = false) {
    window.location.href = wholesale
      ? "/shop?wholesale=1"
      : `/shop?max=${Number(amount)}`;
  }
  return (
    <>
      {buckets.length > 0 && (
        <section className="home-sale" aria-labelledby="home-sale-title">
          <h2 id="home-sale-title">
            PrimeHubMall <span>Sale Mela</span>
          </h2>
          {buckets.map((bucket) => {
            const wholesale = isWholesalePriceBucket(bucket);
            const matches = (
              wholesale
                ? packs
                : catalog.filter(
                    (p) =>
                      !isWholesaleProduct(p) &&
                      homePrice(p) > 0 &&
                      homePrice(p) <= Number(bucket.amount),
                  )
            ).slice(0, 3);
            return (
              <div
                className={`home-sale-row ${wholesale ? "home-sale-wholesale" : ""}`}
                key={bucket.id}
              >
                <button
                  className="home-budget"
                  onClick={() => select(bucket.amount ?? null, wholesale)}
                  aria-label={`Browse ${bucket.title}`}
                >
                  {
                    <span className="home-budget-medallion">
                      {wholesale ? (
                        <Package size={42} />
                      ) : (
                        <>
                          <small>Rs.</small>
                          <b>{Number(bucket.amount).toLocaleString("en-PK")}</b>
                        </>
                      )}
                    </span>
                  }
                  <span className="home-budget-label">{bucket.title}</span>
                </button>
                <div className="home-sale-products">
                  {matches.length ? (
                    matches.map((p) => (
                      <HomeProductCard
                        product={p}
                        key={p.id}
                        pack={wholesale}
                      />
                    ))
                  ) : (
                    <p className="home-empty">
                      New offers are on their way.{" "}
                      <button
                        onClick={() => select(bucket.amount ?? null, wholesale)}
                      >
                        Browse collection <ChevronRight size={14} />
                      </button>
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
