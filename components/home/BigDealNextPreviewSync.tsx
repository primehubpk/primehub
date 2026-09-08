"use client";

import { useEffect, useMemo } from "react";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { useSettings } from "@/lib/useSettings";
import { WEEKDAY_ORDER, pakistanNowWeekday } from "@/lib/weeklyDealUtils";

export default function BigDealNextPreviewSync() {
  const { settings } = useSettings();
  const bigDeal = settings.dailyDeal;

  const nextImage = useMemo(() => {
    const images = Array.isArray(bigDeal?.imageUrls) ? bigDeal.imageUrls : [];
    if (!images.length) return "";

    const today = pakistanNowWeekday(new Date());
    const todayIndex = WEEKDAY_ORDER.indexOf(today);
    const nextIndex = todayIndex >= 0 ? (todayIndex + 1) % WEEKDAY_ORDER.length : 0;

    return normalizeImageUrl(images[nextIndex] || "");
  }, [bigDeal?.imageUrls]);

  useEffect(() => {
    if (!nextImage) return;

    const applyNextImage = () => {
      const image = document.querySelector<HTMLImageElement>(
        ".home-next-deal > img",
      );
      if (!image) return false;

      image.src = nextImage;
      image.removeAttribute("srcset");
      image.removeAttribute("sizes");
      image.style.filter = "none";
      image.style.opacity = "1";
      image.style.objectFit = "cover";
      return true;
    };

    if (applyNextImage()) return;

    const observer = new MutationObserver(() => {
      if (applyNextImage()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [nextImage]);

  return null;
}
