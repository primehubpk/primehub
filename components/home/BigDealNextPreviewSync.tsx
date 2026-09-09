"use client";

import { useEffect, useMemo } from "react";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { useSettings } from "@/lib/useSettings";
import { WEEKDAY_ORDER, pakistanNowWeekday } from "@/lib/weeklyDealUtils";

function money(value: number) {
  return `Rs. ${Math.max(0, Math.round(value)).toLocaleString("en-PK")}`;
}

export default function BigDealNextPreviewSync() {
  const { settings } = useSettings();
  const bigDeal = settings.dailyDeal;

  const nextDeal = useMemo(() => {
    const images = Array.isArray(bigDeal?.imageUrls) ? bigDeal.imageUrls : [];
    const originalPrices = Array.isArray(bigDeal?.originalPrices) ? bigDeal.originalPrices : [];
    const dealPrices = Array.isArray(bigDeal?.dealPrices) ? bigDeal.dealPrices : [];
    if (!images.length && !dealPrices.length && !originalPrices.length) return null;

    const today = pakistanNowWeekday(new Date());
    const todayIndex = WEEKDAY_ORDER.indexOf(today);
    const nextIndex = todayIndex >= 0 ? (todayIndex + 1) % WEEKDAY_ORDER.length : 0;
    const imageUrl = normalizeImageUrl(images[nextIndex] || bigDeal?.imageUrl || "");
    const price = Number(dealPrices[nextIndex] ?? bigDeal?.dealPrice ?? 0);
    const originalPrice = Number(originalPrices[nextIndex] ?? bigDeal?.originalPrice ?? price);

    return {
      imageUrl,
      price: Number.isFinite(price) ? price : 0,
      originalPrice: Number.isFinite(originalPrice) ? originalPrice : 0,
      title: String(bigDeal?.title || "Next Big Deal").trim() || "Next Big Deal",
    };
  }, [bigDeal]);

  useEffect(() => {
    if (!nextDeal) return;

    const applyNextDeal = () => {
      const card = document.querySelector<HTMLElement>(".home-next-deal");
      const image = card?.querySelector<HTMLImageElement>(":scope > img");
      const badge = card?.querySelector<HTMLElement>(":scope > span");
      if (!card || !badge) return false;

      if (image && nextDeal.imageUrl) {
        image.src = nextDeal.imageUrl;
        image.removeAttribute("srcset");
        image.removeAttribute("sizes");
        image.style.filter = "none";
        image.style.opacity = "1";
        image.style.objectFit = "cover";
      }

      const smalls = badge.querySelectorAll<HTMLElement>("small");
      const price = badge.querySelector<HTMLElement>("strong");
      if (smalls[0]) smalls[0].textContent = nextDeal.title;
      if (price) price.textContent = money(nextDeal.price);
      const saved = Math.max(0, nextDeal.originalPrice - nextDeal.price);
      if (smalls[1]) smalls[1].textContent = saved > 0 ? `Save ${money(saved)}` : "Tomorrow’s deal";
      return true;
    };

    if (applyNextDeal()) return;

    const observer = new MutationObserver(() => {
      if (applyNextDeal()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [nextDeal]);

  return null;
}
