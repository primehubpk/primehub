"use client";

import { useLayoutEffect, useMemo } from "react";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { useSettings } from "@/lib/useSettings";
import {
  bigDealConfiguredSlotCount,
  bigDealRotationIndex,
  nextBigDealRotationIndex,
} from "@/lib/bigDealRotation";
import "./BigDealRotationFix.css";

type BigDeal = NonNullable<ReturnType<typeof useSettings>["settings"]["dailyDeal"]>;

type DealSlot = {
  imageUrl: string;
  productId: string;
  title: string;
  originalPrice: number;
  dealPrice: number;
};

function money(value: number) {
  return `Rs. ${Math.max(0, Math.round(value)).toLocaleString("en-PK")}`;
}

function cleanDealTitle(value: unknown) {
  const title = String(value || "Big Deal").trim() || "Big Deal";
  return (
    title
      .replace(/\b(?:rs\.?\s*)?\d{3,6}\b/gi, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.:;-])/g, "$1")
      .replace(/-\s*-/g, "-")
      .trim() || "Big Deal"
  );
}

function slotAt(deal: BigDeal, index: number): DealSlot {
  const images = Array.isArray(deal.imageUrls) ? deal.imageUrls : [];
  const productIds = Array.isArray(deal.productIds) ? deal.productIds : [];
  const titles = Array.isArray(deal.titles) ? deal.titles : [];
  const originalPrices = Array.isArray(deal.originalPrices) ? deal.originalPrices : [];
  const dealPrices = Array.isArray(deal.dealPrices) ? deal.dealPrices : [];

  return {
    imageUrl: normalizeImageUrl(String(images[index] || deal.imageUrl || images[0] || "")),
    productId: String(productIds[index] || deal.productId || productIds[0] || "").trim(),
    title: cleanDealTitle(titles[index] || deal.title || titles[0] || "Big Deal"),
    originalPrice: Math.max(0, Number(originalPrices[index] ?? deal.originalPrice ?? 0) || 0),
    dealPrice: Math.max(0, Number(dealPrices[index] ?? deal.dealPrice ?? 0) || 0),
  };
}

function pakistanMidnightCountdown(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value || 0);
  const month = Number(parts.find((part) => part.type === "month")?.value || 1);
  const day = Number(parts.find((part) => part.type === "day")?.value || 1);
  const nextMidnight = new Date(Date.UTC(year, month - 1, day + 1, -5, 0, 0));
  const total = Math.max(0, Math.floor((nextMidnight.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function nextSlot(deal: BigDeal, now: Date) {
  const slotCount = bigDealConfiguredSlotCount(deal);
  return slotAt(
    deal,
    nextBigDealRotationIndex(deal.rotationStartedAt, now, slotCount),
  );
}

export default function BigDealNextPreviewSync() {
  const { settings } = useSettings();
  const bigDeal = settings.dailyDeal;

  const instantNextDeal = useMemo(() => {
    if (!bigDeal?.active) return null;
    return nextSlot(bigDeal, new Date());
  }, [bigDeal]);

  useLayoutEffect(() => {
    if (!bigDeal?.active) return;

    const applyDealCards = () => {
      const now = new Date();
      const slotCount = bigDealConfiguredSlotCount(bigDeal);
      const currentIndex = bigDealRotationIndex(bigDeal.rotationStartedAt, now, slotCount);
      const nextIndex = nextBigDealRotationIndex(bigDeal.rotationStartedAt, now, slotCount);
      const currentDeal = slotAt(bigDeal, currentIndex);
      const nextDeal = slotAt(bigDeal, nextIndex);
      const countdown = pakistanMidnightCountdown(now);

      const currentCard = document.querySelector<HTMLElement>(".home-big-card");
      if (currentCard) {
        const imageLink = currentCard.querySelector<HTMLAnchorElement>(".home-big-image");
        const info = currentCard.querySelector<HTMLElement>(".home-big-info");
        const titleLink = info?.querySelector<HTMLAnchorElement>(":scope > a") || null;
        const prices = info?.querySelector<HTMLElement>(".home-big-prices") || null;
        const href = currentDeal.productId ? `/product/${currentDeal.productId}?deal=big` : "/deals/big";

        // Preserve scoped Big Deal navigation and rotating text/prices, but do
        // not replace the Next/Image src/srcset after hydration. That rewrite
        // was forcing the live watch image to load a second time.
        if (imageLink) imageLink.href = href;
        if (titleLink) {
          titleLink.href = href;
          titleLink.textContent = currentDeal.title;
        }

        const currentPrice = prices?.querySelector<HTMLElement>("strong") || null;
        const regularPrice = prices?.querySelector<HTMLElement>("s") || null;
        const saving = prices?.querySelector<HTMLElement>("em") || null;
        const saved = Math.max(0, currentDeal.originalPrice - currentDeal.dealPrice);
        if (currentPrice) currentPrice.textContent = money(currentDeal.dealPrice);
        if (regularPrice) regularPrice.textContent = money(currentDeal.originalPrice);
        if (saving) saving.textContent = saved > 0 ? `Save ${money(saved)}` : "";
        if (info) info.dataset.countdown = `Ends in ${countdown}`;
      }

      const nextCard = document.querySelector<HTMLElement>(".home-next-deal");
      const badge = nextCard?.querySelector<HTMLElement>(":scope > span") || null;
      if (!nextCard || !badge) return;

      const nextBackground = nextDeal.imageUrl
        ? `url(${JSON.stringify(nextDeal.imageUrl)})`
        : "none";
      if (nextCard.style.backgroundImage !== nextBackground) {
        nextCard.style.backgroundImage = nextBackground;
      }
      nextCard.style.backgroundSize = "cover";
      nextCard.style.backgroundPosition = "center";
      nextCard.setAttribute("aria-label", `Next Big Deal locked until tomorrow: ${nextDeal.title}, ${money(nextDeal.dealPrice)}`);
      nextCard.setAttribute("aria-disabled", "true");
      nextCard.dataset.locked = "true";
      nextCard.dataset.synced = "true";
      if (nextDeal.productId) nextCard.dataset.nextProductId = nextDeal.productId;

      const smalls = badge.querySelectorAll<HTMLElement>("small");
      const price = badge.querySelector<HTMLElement>("strong");
      if (smalls[0]) smalls[0].textContent = nextDeal.title;
      if (price) {
        price.textContent = money(nextDeal.dealPrice);
        price.dataset.regular = nextDeal.originalPrice > nextDeal.dealPrice ? money(nextDeal.originalPrice) : "";
      }
      const saved = Math.max(0, nextDeal.originalPrice - nextDeal.dealPrice);
      if (smalls[1]) smalls[1].textContent = saved > 0 ? `Save ${money(saved)}` : "Tomorrow's deal";
      badge.dataset.countdown = `Unlocks in ${countdown}`;
    };

    applyDealCards();
    const timer = window.setInterval(applyDealCards, 1000);
    return () => window.clearInterval(timer);
  }, [bigDeal]);

  if (!instantNextDeal?.imageUrl) return null;

  return (
    <>
      <link rel="preload" as="image" href={instantNextDeal.imageUrl} />
      <style>{`.home-storefront .home-next-deal{background-image:url(${JSON.stringify(instantNextDeal.imageUrl)});background-size:cover;background-position:center;}`}</style>
    </>
  );
}
