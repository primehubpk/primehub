"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/useSettings";
import { normalizeImageUrl } from "@/lib/imageUrl";
import {
  bigDealConfiguredSlotCount,
  bigDealRotationIndex,
} from "@/lib/bigDealRotation";
import "./BigDealRotationFix.css";

type BigDeal = NonNullable<ReturnType<typeof useSettings>["settings"]["dailyDeal"]>;

type DealSlot = {
  productId: string;
  title: string;
  imageUrl: string;
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
  const imageUrls = Array.isArray(deal.imageUrls) ? deal.imageUrls : [];
  const originalPrices = Array.isArray(deal.originalPrices) ? deal.originalPrices : [];
  const dealPrices = Array.isArray(deal.dealPrices) ? deal.dealPrices : [];

  return {
    productId: String(productIds[index] || deal.productId || productIds[0] || "").trim(),
    title: cleanDealTitle(titles[index] || deal.title || titles[0] || "Big Deal"),
    imageUrl: normalizeImageUrl(String(imageUrls[index] || deal.imageUrl || imageUrls[0] || "")),
    originalPrice: Math.max(0, Number(originalPrices[index] ?? deal.originalPrice ?? 0) || 0),
    dealPrice: Math.max(0, Number(dealPrices[index] ?? deal.dealPrice ?? 0) || 0),
  };
}

function pakistanUnlockCountdown(now: Date, daysAhead: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value || 0);
  const month = Number(parts.find((part) => part.type === "month")?.value || 1);
  const day = Number(parts.find((part) => part.type === "day")?.value || 1);
  const offset = Math.max(1, Math.floor(daysAhead || 1));
  const unlockAt = new Date(Date.UTC(year, month - 1, day + offset, -5, 0, 0));
  const total = Math.max(0, Math.floor((unlockAt.getTime() - now.getTime()) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function removeGeneratedCards(section: HTMLElement) {
  section
    .querySelectorAll<HTMLElement>('[data-generated-big-deal-preview="true"]')
    .forEach((card) => card.remove());
}

export default function BigDealNextPreviewSync() {
  const { settings } = useSettings();
  const bigDeal = settings.dailyDeal;

  useEffect(() => {
    if (!bigDeal?.active) return;

    const section = document.querySelector<HTMLElement>(".home-big-deal");
    if (!section) return;

    const grid = section.querySelector<HTMLElement>(".home-big-grid");
    const firstNextCard = section.querySelector<HTMLElement>(".home-next-deal");
    const prices = section.querySelector<HTMLElement>(".home-big-prices");
    if (!grid || !firstNextCard) return;

    removeGeneratedCards(section);
    firstNextCard.dataset.slotOffset = "1";

    let timer: number | null = null;
    let observer: IntersectionObserver | null = null;

    const stopTimer = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const ensurePreviewCards = (slotCount: number) => {
      const neededLockedCards = Math.max(0, slotCount - 1);
      const existingGenerated = Array.from(
        section.querySelectorAll<HTMLElement>('[data-generated-big-deal-preview="true"]'),
      );

      existingGenerated.forEach((card) => {
        const offset = Number(card.dataset.slotOffset || 0);
        if (offset < 2 || offset > neededLockedCards) card.remove();
      });

      for (let offset = 2; offset <= neededLockedCards; offset += 1) {
        const existing = section.querySelector<HTMLElement>(
          `.home-next-deal[data-slot-offset="${offset}"]`,
        );
        if (existing) continue;

        const clone = firstNextCard.cloneNode(true) as HTMLElement;
        clone.dataset.generatedBigDealPreview = "true";
        clone.dataset.slotOffset = String(offset);
        clone.dataset.locked = "true";
        clone.dataset.synced = "true";
        grid.appendChild(clone);
      }

      firstNextCard.hidden = neededLockedCards < 1;
      return Array.from(
        section.querySelectorAll<HTMLElement>(".home-next-deal[data-slot-offset]"),
      ).sort(
        (a, b) => Number(a.dataset.slotOffset || 0) - Number(b.dataset.slotOffset || 0),
      );
    };

    const syncLockedCard = (
      card: HTMLElement,
      nextDeal: DealSlot,
      countdown: string,
    ) => {
      card.hidden = false;
      card.setAttribute(
        "aria-label",
        `Big Deal locked: ${nextDeal.title}, ${money(nextDeal.dealPrice)}, unlocks in ${countdown}`,
      );
      card.setAttribute("aria-disabled", "true");
      card.dataset.locked = "true";
      card.dataset.synced = "true";
      if (nextDeal.productId) card.dataset.nextProductId = nextDeal.productId;
      else delete card.dataset.nextProductId;

      const image = card.querySelector<HTMLImageElement>(":scope > img");
      if (image) {
        if (nextDeal.imageUrl) {
          image.removeAttribute("srcset");
          image.removeAttribute("sizes");
          image.src = nextDeal.imageUrl;
          image.style.display = "block";
        } else {
          image.style.display = "none";
        }
      }

      const badge = card.querySelector<HTMLElement>(":scope > span");
      if (!badge) return;
      badge.dataset.countdown = `Unlocks in ${countdown}`;

      const lockLabel = badge.querySelector<HTMLElement>("b");
      if (lockLabel) lockLabel.textContent = "LOCKED";

      const smalls = Array.from(badge.querySelectorAll<HTMLElement>("small"));
      const titleSmall = smalls[0] || document.createElement("small");
      titleSmall.textContent = nextDeal.title;
      if (!smalls[0]) badge.appendChild(titleSmall);
      smalls.slice(1).forEach((small) => small.remove());

      const price = badge.querySelector<HTMLElement>("strong");
      if (price) {
        price.textContent = money(nextDeal.dealPrice);
        price.dataset.regular =
          nextDeal.originalPrice > nextDeal.dealPrice
            ? money(nextDeal.originalPrice)
            : "";
      }

      const saved = Math.max(0, nextDeal.originalPrice - nextDeal.dealPrice);
      const savingSmall = document.createElement("small");
      savingSmall.textContent = saved > 0 ? `Save ${money(saved)}` : "Upcoming deal";
      badge.appendChild(savingSmall);
    };

    const applyDealCards = () => {
      const now = new Date();
      const slotCount = bigDealConfiguredSlotCount(bigDeal);
      const currentIndex = bigDealRotationIndex(
        bigDeal.rotationStartedAt,
        now,
        slotCount,
      );
      const liveCountdown = pakistanUnlockCountdown(now, 1);
      if (prices) prices.dataset.countdown = `Ends in ${liveCountdown}`;

      const previewCards = ensurePreviewCards(slotCount);
      previewCards.forEach((card) => {
        const offset = Math.max(1, Number(card.dataset.slotOffset || 1));
        const slotIndex = (currentIndex + offset) % slotCount;
        const nextDeal = slotAt(bigDeal, slotIndex);
        syncLockedCard(card, nextDeal, pakistanUnlockCountdown(now, offset));
      });
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
      removeGeneratedCards(section);
      delete firstNextCard.dataset.slotOffset;
    };
  }, [bigDeal]);

  return null;
}
