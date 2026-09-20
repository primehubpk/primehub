# TikTok dynamic catalog feeds

PrimeHubMall exposes two public, scheduled-feed URLs:

- Physical products: `https://www.primehubmall.com/api/tiktok/catalog/products.csv`
- Prime Skills / services: `https://www.primehubmall.com/api/tiktok/catalog/skills.csv`

## Product feed

The product feed reads the complete live product payload from the same dual
Supabase/Firebase catalog layer used by the storefront. It intentionally does
not maintain a second hardcoded product list. New published products therefore
appear automatically.

The feed sends the PrimeHub product document ID as TikTok `sku_id`. This is the
same ID used as `content_id` by Pixel + Events API, which keeps catalog matching
and retargeting aligned.

Pricing mirrors the storefront:

- Normal product discounts use `originalPrice` as `price` and the live
  storefront `price` as `sale_price`.
- Today's Pakistan-time Weekly Deal is published as the live sale price.
- Future Weekly Deals stay locked and keep their normal storefront price.
- The active Big Deal rotation slot is published at its current deal price and
  links to the product with `?deal=big`; locked rotation slots are not given the
  future deal price.
- Sale Mela labels use the same non-overlapping live-price buckets used by the
  shop.
- Wholesale/retail and category labels are generated from live product data.

`custom_label_4` is deliberately generic: saved price-bucket names, truthy
feature flags, and tag/label/badge/collection/campaign/feature fields are
collected dynamically. New feature flags or tags can therefore flow into the
feed without adding another hardcoded product list.

Only products that are not hidden/unpublished and that have a valid title,
image and price are emitted. Stock is calculated from active variants when
variant stock exists.

If a product later gains an explicit weight field, the feed automatically emits
`shipping_weight` when the value includes a supported unit (kg, g, lb, oz), or
when the field name itself identifies the unit. No fake/default package weight
is invented.

## Prime Skills feed

Prime Skills remain separate from the ecommerce product catalog. The Skills
feed uses each live `prime_skills` listing as one Generic Catalog item and uses
its minimum active package price when packages exist. If the saved Skills
collection is empty, it mirrors the same starter listings the public Skills page
uses.

## Image compatibility

Catalog feed image URLs point to PrimeHub's own JPEG conversion endpoint. This
keeps existing R2/WebP product and Skills artwork compatible with TikTok's
catalog image requirements without changing the storefront source images.

## TikTok Catalog Manager

Use **Data feed upload / scheduled feed**, not manual product upload. The
physical product URL belongs in **PrimeHubMall Product Catalog**. Create a
separate **Other products and services / Generic Catalog** for the Prime Skills
URL.
