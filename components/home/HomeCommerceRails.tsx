"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Play, PlayCircle, Sparkles } from "lucide-react";
import HomeHeading from "./HomeHeading";
import { useSettings } from "@/lib/useSettings";
import { PRIME_SKILLS_SEED } from "@/lib/primeSkillsSeed";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { thumbnailOf, type WholesaleVideo } from "@/lib/wholesaleVideos";

type SkillPackage = {
  id?: string;
  name?: string;
  price?: number;
  description?: string;
  active?: boolean;
};

type PrimeSkillHomeItem = {
  id: string;
  title: string;
  subtitle?: string;
  price?: number;
  thumbnailUrl?: string;
  imageUrl?: string;
  whatsapp?: string;
  buttonText?: string;
  active?: boolean;
  sortOrder?: number;
  packages?: SkillPackage[];
};

function cleanWhatsApp(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function whatsappHref(number: string, message: string) {
  const clean = cleanWhatsApp(number);
  if (!clean) return "";
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

function money(value: number) {
  return `Rs. ${Math.max(0, Math.round(value)).toLocaleString("en-PK")}`;
}

function skillDisplayPrice(item: PrimeSkillHomeItem) {
  const packagePrices = (Array.isArray(item.packages) ? item.packages : [])
    .filter((pkg) => pkg.active !== false && Number(pkg.price || 0) > 0)
    .map((pkg) => Number(pkg.price || 0));
  if (packagePrices.length) {
    return { value: Math.min(...packagePrices), prefix: "From " };
  }
  const base = Number(item.price || 0);
  return { value: base > 0 ? base : 0, prefix: "" };
}

export function HomeWholesaleVideos() {
  const { settings, contact } = useSettings();
  const videos = (
    (settings as typeof settings & { wholesaleVideos?: WholesaleVideo[] })
      .wholesaleVideos || []
  ).filter((video) => video.active !== false);

  const storeWhatsApp =
    cleanWhatsApp(contact?.whatsappNumber) ||
    cleanWhatsApp(settings.whatsappNumber) ||
    "923238878009";

  if (!videos.length) return null;

  return (
    <section className="home-video-packages home-commerce-section">
      <HomeHeading>Wholesale Packages</HomeHeading>
      <div className="home-commerce-rail-wrap">
        <div
          className="home-two-row-rail home-commerce-rail"
          aria-label="Wholesale packages. Four are visible as a 2 by 2 preview when available; swipe horizontally for more."
        >
          {videos.map((video, index) => {
            const thumbnail = normalizeImageUrl(thumbnailOf(video));
            const price = Number(video.price || 0);
            const orderHref = whatsappHref(
              storeWhatsApp,
              `Assalam o Alaikum, mujhe PrimeHub wholesale package “${video.title}” order karna hai${price > 0 ? ` — ${money(price)}` : ""}.`,
            );
            return (
              <article className="home-commerce-card" key={video.id}>
                <a
                  className="home-commerce-media"
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${video.title}`}
                >
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={video.title}
                      loading={index < 4 ? "eager" : "lazy"}
                    />
                  ) : (
                    <span className="home-commerce-placeholder">
                      <PlayCircle size={32} />
                    </span>
                  )}
                  <i className="home-commerce-play" aria-hidden="true">
                    <Play fill="currentColor" />
                  </i>
                </a>
                <div className="home-commerce-info">
                  <a
                    className="home-commerce-title"
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {video.title}
                  </a>
                  {price > 0 ? (
                    <strong className="home-commerce-price">{money(price)}</strong>
                  ) : null}
                  {video.description ? (
                    <p className="home-commerce-description">{video.description}</p>
                  ) : null}
                  {orderHref ? (
                    <a
                      className="home-commerce-order"
                      href={orderHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle size={13} /> Order Now
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HomePrimeSkills() {
  const { settings, contact } = useSettings();
  const [items, setItems] = useState<PrimeSkillHomeItem[]>(
    PRIME_SKILLS_SEED as PrimeSkillHomeItem[],
  );

  useEffect(() => {
    fetch("/api/storefront/read?type=skills", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (Array.isArray(data?.skills) && data.skills.length) {
          setItems(data.skills as PrimeSkillHomeItem[]);
        }
      })
      .catch(() => undefined);
  }, []);

  const skills = useMemo(
    () =>
      items
        .filter((item) => item.active !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [items],
  );

  const storeWhatsApp =
    cleanWhatsApp(contact?.whatsappNumber) ||
    cleanWhatsApp(settings.whatsappNumber) ||
    "923238878009";

  if (!skills.length) return null;

  return (
    <section className="home-prime-skills home-commerce-section">
      <HomeHeading>Prime Skills</HomeHeading>
      <div className="home-commerce-rail-wrap">
        <div
          className="home-two-row-rail home-commerce-rail"
          aria-label="Prime Skills. Swipe horizontally for more."
        >
          {skills.map((item, index) => {
            const thumbnail = normalizeImageUrl(
              String(item.thumbnailUrl || item.imageUrl || ""),
            );
            const displayPrice = skillDisplayPrice(item);
            const detailHref = `/skills/${item.id}`;
            const orderNumber = cleanWhatsApp(item.whatsapp) || storeWhatsApp;
            const orderHref = whatsappHref(
              orderNumber,
              `Assalam o Alaikum, mujhe Prime Skills ki “${item.title}” service chahiye${displayPrice.value > 0 ? ` — ${displayPrice.prefix}${money(displayPrice.value)}` : ""}.`,
            );

            return (
              <article className="home-commerce-card" key={item.id}>
                <Link
                  className={index === 0 ? "home-commerce-media home-prime-skill-first-media" : "home-commerce-media"}
                  href={detailHref}
                  aria-label={`Open ${item.title}`}
                >
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={item.title || "Prime Skill"}
                      loading={index < 2 ? "eager" : "lazy"}
                      className={index === 0 ? "home-prime-skill-first-image" : undefined}
                    />
                  ) : (
                    <span className="home-commerce-placeholder">
                      <Sparkles size={30} />
                    </span>
                  )}
                </Link>
                <div className="home-commerce-info">
                  <Link className="home-commerce-title" href={detailHref}>
                    {item.title || "Prime Skill"}
                  </Link>
                  {displayPrice.value > 0 ? (
                    <strong className="home-commerce-price">
                      {displayPrice.prefix}
                      {money(displayPrice.value)}
                    </strong>
                  ) : null}
                  {item.subtitle ? (
                    <p className="home-commerce-description">{item.subtitle}</p>
                  ) : null}
                  {orderHref ? (
                    <a
                      className="home-commerce-order"
                      href={orderHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle size={13} /> Order WhatsApp
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
