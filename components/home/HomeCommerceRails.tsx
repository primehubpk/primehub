"use client";

import { fetchPublicStorefront } from '@/lib/storefrontClient';
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowRight, LayoutGrid, MessageCircle, Package, Play, PlayCircle, Sparkles, Tags } from "lucide-react";
import { CollectionBannerActions } from "./CollectionBannerContent";
import { useVisitBannerImages } from "@/lib/useVisitBannerImages";
import HomeRailFrame from './HomeRailFrame';
import { useSettings } from "@/lib/useSettings";
import { PRIME_SKILLS_SEED } from "@/lib/primeSkillsSeed";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { thumbnailOf, type WholesaleVideo } from "@/lib/wholesaleVideos";
import WholesaleVideoPlayer from "@/components/WholesaleVideoPlayer";

type SkillPackage = {
  id?: string;
  name?: string;
  price?: number;
  description?: string;
  active?: boolean;
};

type PrimeSkillHomeItem = {
  id: string;
  title?: string;
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

export function Commerce3DBanner({ kind, title, href, images, railRef, onMove, iconImage }: {
  kind: 'wholesale' | 'skills' | 'sale' | 'category';
  title: string;
  href: '/wholesale-video-hub' | '/skills' | '/primehubmall/salemela' | `/category/${string}`;
  images: string[];
  railRef?: RefObject<HTMLDivElement | null>;
  onMove?: (direction: number) => void;
  iconImage?: string;
}) {
  const previews = useVisitBannerImages(images, href);
  const Symbol = kind === 'wholesale' ? Package : kind === 'skills' ? Sparkles : kind === 'sale' ? Tags : LayoutGrid;
  const move = (direction: number) => {
    if (onMove) { onMove(direction); return; }
    const rail = railRef?.current;
    rail?.dispatchEvent(new Event('click'));
    rail?.scrollBy({ left: direction * Math.max(140, rail.clientWidth * 0.82), behavior: 'smooth' });
  };
  return <div className={`home-commerce-banner home-commerce-banner--${kind}`}>
    <span className="home-commerce-banner__emblem" aria-hidden="true">
      {iconImage ? <img className="home-commerce-banner__emblem-image" src={iconImage} alt="" loading="lazy"/> : <Symbol size={29} strokeWidth={1.8}/>}
    </span>
    <div className="home-commerce-banner__copy">
      <span className="home-commerce-banner__eyebrow">PRIMEHUB COLLECTION</span>
      <h2>{title}</h2>
      <span className="home-commerce-banner__cta">
        {kind === 'wholesale' ? 'Explore wholesale packs' : kind === 'skills' ? 'Explore digital skills' : kind === 'sale' ? 'Explore Sale Mela deals' : 'Browse this category'}
        <ArrowRight size={13}/>
      </span>
    </div>
    <div className="home-commerce-banner__photos" aria-hidden="true">
      {previews.length ? previews.map((src, index) =>
        <span className="home-commerce-banner__photo" key={src}>
          <Symbol size={17}/>
          <img src={src} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }}/>
        </span>,
      ) : <span className="home-commerce-banner__photo home-commerce-banner__photo--empty">
        <Symbol size={25}/>
      </span>}
    </div>
    <Link href={href} prefetch={false} className="home-commerce-banner__link" aria-label={`Explore ${title}`}>
      <span className="sr-only">Browse all {title}</span>
    </Link>
    <CollectionBannerActions path={href} title={title}
      onPrevious={() => move(-1)} onNext={() => move(1)}
      className="home-commerce-banner__controls" shareClassName="home-commerce-banner__share"/>
  </div>;
}

export function HomeWholesaleVideos() {
  const { settings, contact } = useSettings();
  const [playingVideo, setPlayingVideo] = useState<WholesaleVideo | null>(null);
  const wholesaleRailRef = useRef<HTMLDivElement>(null);
  const videos = ((settings as typeof settings & { wholesaleVideos?: WholesaleVideo[] })
    .wholesaleVideos || []).filter((video) => video.active !== false);

  const storeWhatsApp =
    cleanWhatsApp(contact?.whatsappNumber) ||
    cleanWhatsApp(settings.whatsappNumber) ||
    "923238878009";

  if (!videos.length) return null;

  return (
    <section className="home-video-packages home-commerce-section">
      <HomeRailFrame title="Wholesale Packages" href="/wholesale-video-hub" hideHeader className="home-commerce-frame">
      <Commerce3DBanner kind="wholesale" title="Wholesale Packages" href="/wholesale-video-hub"
        images={videos.map(video => normalizeImageUrl(thumbnailOf(video)))}
        railRef={wholesaleRailRef}/>
      <div className="home-commerce-rail-wrap">
        <div
          className="home-two-row-rail home-commerce-rail"
          ref={wholesaleRailRef}
          aria-label="Wholesale packages. Swipe horizontally for more."
        >
          {videos.map((video) => {
            const thumbnail = normalizeImageUrl(thumbnailOf(video));
            const price = Number(video.price || 0);
            const orderHref = whatsappHref(
              storeWhatsApp,
              `Assalam o Alaikum, mujhe PrimeHub wholesale package “${video.title}” order karna hai${price > 0 ? ` — ${money(price)}` : ""}.`,
            );
            return (
              <article className="home-commerce-card" key={video.id}>
                <button
                  type="button"
                  className="home-commerce-media"
                  onClick={() => setPlayingVideo(video)}
                  aria-label={`Play ${video.title} inside PrimeHubMall`}
                >
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={video.title}
                      loading="lazy"
                    />
                  ) : (
                    <span className="home-commerce-placeholder">
                      <PlayCircle size={32} />
                    </span>
                  )}
                  <i className="home-commerce-play" aria-hidden="true">
                    <Play fill="currentColor" />
                  </i>
                </button>
                <div className="home-commerce-info">
                  <button type="button" className="home-commerce-title" onClick={() => setPlayingVideo(video)}>{video.title}</button>
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
      </HomeRailFrame>
      <WholesaleVideoPlayer video={playingVideo} onClose={() => setPlayingVideo(null)} />
    </section>
  );
}

export function HomePrimeSkills({ initialItems = [] }: { initialItems?: PrimeSkillHomeItem[] }) {
  const { settings, contact } = useSettings();
  const sectionRef = useRef<HTMLElement | null>(null);
  const skillsRailRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<PrimeSkillHomeItem[]>(
    () => initialItems.length ? initialItems : PRIME_SKILLS_SEED as PrimeSkillHomeItem[],
  );

  useEffect(() => {
    if (initialItems.length) {
      setItems(initialItems);
      return;
    }

    let cancelled = false;
    let started = false;

    const loadSkills = () => {
      if (started) return;
      started = true;
      fetchPublicStorefront('skills')
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!cancelled && Array.isArray(data?.skills) && data.skills.length) {
            setItems(data.skills as PrimeSkillHomeItem[]);
          }
        })
        .catch(() => undefined);
    };

    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      loadSkills();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          loadSkills();
        }
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [initialItems]);

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
    <section ref={sectionRef} className="home-prime-skills home-commerce-section">
      <HomeRailFrame title="Prime Skills" href="/skills" hideHeader className="home-commerce-frame">
      <Commerce3DBanner kind="skills" title="Prime Skills" href="/skills"
        images={skills.map(item => normalizeImageUrl(item.thumbnailUrl || item.imageUrl || ''))}
        railRef={skillsRailRef}/>
      <div className="home-commerce-rail-wrap">
        <div
          className="home-two-row-rail home-commerce-rail"
          ref={skillsRailRef}
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
                  prefetch={false}
                  aria-label={`Open ${item.title}`}
                >
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={item.title || "Prime Skill"}
                      loading="lazy"
                      className={index === 0 ? "home-prime-skill-first-image" : undefined}
                    />
                  ) : (
                    <span className="home-commerce-placeholder">
                      <Sparkles size={30} />
                    </span>
                  )}
                </Link>
                <div className="home-commerce-info">
                  <Link className="home-commerce-title" href={detailHref} prefetch={false}>
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
      </HomeRailFrame>
    </section>
  );
}
