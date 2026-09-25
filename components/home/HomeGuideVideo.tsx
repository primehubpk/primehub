"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { useSettings } from "@/lib/useSettings";

const SESSION_KEY = "primehub-guide-intro-seen-v1";
const FLIGHT_MS = 850;

function youtubeId(value: string) {
  try {
    const url = new URL(value);

    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1).split("/")[0] || "";
    }

    if (
      url.hostname === "youtube.com" ||
      url.hostname === "www.youtube.com" ||
      url.hostname === "m.youtube.com"
    ) {
      if (url.pathname === "/watch") return url.searchParams.get("v") || "";
      if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2] || "";
      if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || "";
    }
  } catch {}

  return "";
}

type IntroState = "hidden" | "visible" | "flying";

export default function HomeGuideVideo({
  mode,
}: {
  mode: "intro" | "menu";
}) {
  const { settings } = useSettings();

  const guideUrl = String(settings.youtubeGuideUrl || "").trim();
  const title =
    String(settings.youtubeGuideTitle || "").trim() ||
    "PrimeHubMall Se Order Kaise Karein?";

  const seconds = Math.min(
    30,
    Math.max(1, Number(settings.youtubeGuidePreviewSeconds || 5)),
  );

  const videoId = useMemo(() => youtubeId(guideUrl), [guideUrl]);

  const [introState, setIntroState] = useState<IntroState>("hidden");
  const [flightTransform, setFlightTransform] = useState(
    "translate3d(0, 0, 0) scale(1)",
  );
  const [menuPlaying, setMenuPlaying] = useState(false);

  const introCardRef = useRef<HTMLElement>(null);
  const menuRootRef = useRef<HTMLElement>(null);
  const flightTimerRef = useRef<number | null>(null);

  const pulseMenuButton = useCallback((target: HTMLElement) => {
    try {
      target.animate(
        [
          { boxShadow: "0 0 0 0 rgba(225,53,43,0)" },
          { boxShadow: "0 0 0 9px rgba(225,53,43,0.24)" },
          { boxShadow: "0 0 0 0 rgba(225,53,43,0)" },
        ],
        {
          duration: 750,
          easing: "ease-out",
        },
      );
    } catch {}
  }, []);

  const flyToMenu = useCallback(() => {
    if (mode !== "intro" || introState !== "visible") return;

    const card = introCardRef.current;
    const target = document.getElementById("primehub-menu-button");

    if (!card || !target) {
      setIntroState("hidden");
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      setIntroState("hidden");
      pulseMenuButton(target);
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const cardX = cardRect.left + cardRect.width / 2;
    const cardY = cardRect.top + cardRect.height / 2;

    const targetX = Math.min(
      window.innerWidth - 20,
      Math.max(20, targetRect.left + targetRect.width / 2),
    );

    const targetY = Math.min(
      window.innerHeight - 20,
      Math.max(20, targetRect.top + targetRect.height / 2),
    );

    const dx = targetX - cardX;
    const dy = targetY - cardY;

    setFlightTransform(
      `translate3d(${dx}px, ${dy}px, 0) scale(0.08)`,
    );
    setIntroState("flying");

    if (flightTimerRef.current) {
      window.clearTimeout(flightTimerRef.current);
    }

    flightTimerRef.current = window.setTimeout(() => {
      setIntroState("hidden");
      setFlightTransform("translate3d(0, 0, 0) scale(1)");
      pulseMenuButton(target);
    }, FLIGHT_MS);
  }, [introState, mode, pulseMenuButton]);

  useEffect(() => {
    if (mode !== "intro" || !videoId) return;

    let alreadySeen = false;

    try {
      alreadySeen = window.sessionStorage.getItem(SESSION_KEY) === "1";

      if (!alreadySeen) {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      }
    } catch {}

    if (!alreadySeen) {
      setIntroState("visible");
    }
  }, [mode, videoId]);

  useEffect(() => {
    if (mode !== "intro" || introState !== "visible") return;

    const timer = window.setTimeout(() => {
      flyToMenu();
    }, seconds * 1000);

    return () => window.clearTimeout(timer);
  }, [flyToMenu, introState, mode, seconds]);

  useEffect(() => {
    return () => {
      if (flightTimerRef.current) {
        window.clearTimeout(flightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== "menu") return;

    const dialog = menuRootRef.current?.closest("dialog");
    if (!dialog) return;

    const stopVideo = () => setMenuPlaying(false);

    dialog.addEventListener("close", stopVideo);

    return () => {
      dialog.removeEventListener("close", stopVideo);
    };
  }, [mode]);

  if (!videoId) return null;

  const introEmbedUrl =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` +
    "?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&controls=0";

  const menuEmbedUrl =
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` +
    "?autoplay=0&mute=0&playsinline=1&rel=0&modestbranding=1&controls=1";

  if (mode === "menu") {
    return (
      <section
        ref={menuRootRef}
        className="mx-2 mb-3 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"
      >
        {!menuPlaying ? (
          <button
            type="button"
            onClick={() => setMenuPlaying(true)}
            className="group block w-full overflow-hidden text-left"
            aria-label={`Watch guide: ${title}`}
          >
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <img
                src={`https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`}
                alt={title}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />

              <span
                className="absolute inset-0 bg-black/10"
                aria-hidden="true"
              />

              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E1352B] text-white shadow-lg">
                  <Play size={20} fill="currentColor" />
                </span>
              </span>
            </div>

            <span className="block px-3 py-2.5">
              <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-[#E1352B]">
                Watch Guide
              </span>

              <span className="mt-0.5 block text-xs font-black leading-snug text-[#14140F]">
                {title}
              </span>

              <span className="mt-1 block text-[10px] font-semibold text-black/45">
                Tap thumbnail to watch full video
              </span>
            </span>
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#E1352B]">
                  Watch Guide
                </p>
                <p className="truncate text-xs font-black text-[#14140F]">
                  {title}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMenuPlaying(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5"
                aria-label="Close guide video"
              >
                <X size={15} />
              </button>
            </div>

            <div className="aspect-video w-full overflow-hidden bg-black">
              <iframe
                className="h-full w-full"
                src={menuEmbedUrl}
                title={title}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </>
        )}
      </section>
    );
  }

  if (introState === "hidden") return null;

  return (
    <section
      ref={introCardRef}
      className="fixed bottom-24 right-3 z-[90] w-[min(78vw,300px)] sm:bottom-6 sm:right-6 sm:w-[360px]"
      style={{
        transform:
          introState === "flying"
            ? flightTransform
            : "translate3d(0, 0, 0) scale(1)",
        transformOrigin: "center center",
        opacity: introState === "flying" ? 0.15 : 1,
        transition:
          introState === "flying"
            ? `transform ${FLIGHT_MS}ms cubic-bezier(0.22,1,0.36,1), opacity ${FLIGHT_MS}ms ease`
            : "none",
        pointerEvents: introState === "flying" ? "none" : "auto",
      }}
    >
      <div className="overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-[0_14px_45px_rgba(20,20,15,0.22)]">
        <div className="flex items-start justify-between gap-2 px-3 pb-2 pt-3">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#E1352B]">
              Quick Guide
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs font-black leading-snug text-[#14140F]">
              {title}
            </p>
          </div>

          <button
            type="button"
            onClick={flyToMenu}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5"
            aria-label="Move guide to menu"
          >
            <X size={14} />
          </button>
        </div>

        <div className="aspect-video w-full overflow-hidden bg-black">
          <iframe
            className="h-full w-full"
            src={introEmbedUrl}
            title={title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="px-3 py-2 text-center text-[9px] font-semibold text-black/45">
          Guide preview ke baad â˜° menu mein mil jayegi.
        </div>
      </div>
    </section>
  );
}