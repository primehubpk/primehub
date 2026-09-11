"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/useSettings";
import {
  bigDealConfiguredSlotCount,
  nextBigDealRotationIndex,
} from "@/lib/bigDealRotation";
import "./BigDealRotationFix.css";

type BigDeal = NonNullable<ReturnType<typeof useSettings>["settings"]["dailyDeal"]>;

type DealSlot = {
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
  const productIds = Array.isArray(deal.productIds) ? deal.productIds : [];
  const titles = Array.isArray(deal.titles) ? deal.titles : [];
  const originalPrices = Array.isArray(deal.originalPrices) ? deal.originalPrices : [];
  const dealPrices = Array.isArray(deal.dealPrices) ? deal.dealPrices : [];

  return {
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

export default function BigDealNextPreviewSync() {
  const { settings } = useSettings();
  const bigDeal = settings.dailyDeal;

  useEffect(() => {
    if (!bigDeal?.active) return;

    const section = document.querySelector<HTMLElement>(".home-big-deal");
    if (!section) return;

    let timer: number | null = null;
    let observer: IntersectionObserver | null = null;
    let lastNextIndex = -1;

    const prices = section.querySelector<HTMLElement>(".home-big-prices");
    const nextCard = section.querySelector<HTMLElement>(".home-next-deal");
    const badge = nextCard?.querySelector<HTMLElement>(":scope > span") || null;
    const smalls = badge?.querySelectorAll<HTMLElement>("small") || null;
    const price = badge?.querySelector<HTMLElement>("strong") || null;

    const stopTimer = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const applyDealCards = () => {
      const now = new Date();
      const countdown = pakistanMidnightCountdown(now);
      if (prices) prices.dataset.countdown = `Ends in ${countdown}`;
      if (badge) badge.dataset.countdown = `Unlocks in ${countdown}`;
      if (!nextCard || !badge) return;

      const slotCount = bigDealConfiguredSlotCount(bigDeal);
      const nextIndex = nextBigDealRotationIndex(bigDeal.rotationStartedAt, now, slotCount);
      if (nextIndex === lastNextIndex) return;
      lastNextIndex = nextIndex;

      const nextDeal = slotAt(bigDeal, nextIndex);
      nextCard.setAttribute(
        "aria-label",
        `Next Big Deal locked until tomorrow: ${nextDeal.title}, ${money(nextDeal.dealPrice)}`,
      );
      nextCard.setAttribute("aria-disabled", "true");
      nextCard.dataset.locked = "true";
      nextCard.dataset.synced = "true";
      if (nextDeal.productId) nextCard.dataset.nextProductId = nextDeal.productId;
      else delete nextCard.dataset.nextProductId;

      if (smalls?.[0]) smalls[0].textContent = nextDeal.title;
      if (price) {
        price.textContent = money(nextDeal.dealPrice);
        price.dataset.regular =
          nextDeal.originalPrice > nextDeal.dealPrice
            ? money(nextDeal.originalPrice)
            : "";
      }
      const saved = Math.max(0, nextDeal.originalPrice - nextDeal.dealPrice);
      if (smalls?.[1]) {
        smalls[1].textContent = saved > 0 ? `Save ${money(saved)}` : "Tomorrow's deal";
      }
    };

    const startTimer = () => {
      if (timer !== null) return;
      applyDealCards();
      timer = window.setInterval(applyDealCards, 1000);
    };

    if (typeof IntersectionObserver === "undefined") {
      startTimer();
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          const nearViewport = entries.some((entry) => entry.isIntersecting);
          if (nearViewport) startTimer();
          else stopTimer();
        },
        { rootMargin: "300px 0px" },
      );
      observer.observe(section);
    }

    return () => {
      observer?.disconnect();
      stopTimer();
    };
  }, [bigDeal]);

  return null;
}
