"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Gift,
  Menu,
  ReceiptText,
  Search,
  ShoppingBag,
  ShoppingCart,
  X,
} from "lucide-react";
import LiveSearchBar from "@/components/LiveSearchBar";
import HomeGuideVideo from "@/components/home/HomeGuideVideo";
import { useCartStore } from "@/lib/cartStore";
import { useSettings } from "@/lib/useSettings";
import { trackTikTokEvent } from "@/lib/tiktokPixel";
import { categoryHref } from "@/lib/categoryUtils";
import type { Category } from "@/lib/types";
import {
  buildSmartSearchHref,
  interpretSearchQuery,
} from "@/lib/aiSearchClient";

export default function HomeHeader({ categories = [] }: { categories?: Category[] }) {
  const { settings } = useSettings();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [count, setCount] = useState(0);
  const items = useCartStore((s) => s.items);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const menuCategories = [...categories]
    .filter((category) => category.active !== false && String(category.title || "").trim())
    .sort(
      (a, b) =>
        Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999) ||
        String(a.title || "").localeCompare(String(b.title || "")),
    );
  useEffect(
    () => setCount(items.reduce((sum, item) => sum + item.qty, 0)),
    [items],
  );
  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (searching) return;
    if (!query.trim()) {
      router.push("/shop");
      return;
    }
    const searchQuery = query.trim();
    trackTikTokEvent("Search", { search_string: searchQuery });
    setSearching(true);
    try {
      router.push(
        buildSmartSearchHref(await interpretSearchQuery(searchQuery)),
      );
    } catch {
      router.push(`/shop?q=${encodeURIComponent(searchQuery)}`);
    } finally {
      setSearching(false);
    }
  }
  return (
    <>
      <div className="home-announcement">
        <Gift size={19} aria-hidden="true" />
        <span title={settings.announcementText}>{settings.announcementText || "PRIMEHUB DEALS"}</span>
      </div>
      <header className="home-header">
        <div className="home-header-row">
          <button
            ref={menuButton} id="primehub-menu-button"
            className="home-icon"
            aria-label="Open menu"
            onClick={() => menu.current?.showModal()}
          >
            <Menu />
          </button>
          <Link href="/" prefetch={false} className="home-logo" aria-label="PrimeHubMall home">
            PrimeHub<span>Mall</span>
          </Link>
          <nav aria-label="Quick links" className="home-quick-links">
            <Link href="/orders" prefetch={false}>
              <ReceiptText />
              <span>My Orders</span>
            </Link>
            <Link href="/shop" prefetch={false}>
              <ShoppingBag />
              <span>Shop</span>
            </Link>
            <button onClick={openDrawer} aria-label={`Cart, ${count} items`}>
              <ShoppingCart />
              {count > 0 && <b className="home-cart-count">{count}</b>}
              <span>Cart</span>
            </button>
          </nav>
        </div>
        <form onSubmit={search} className="home-search" role="search">
          <button
            className="home-icon"
            type="submit"
            disabled={searching}
            aria-label="Search"
          >
            <Search />
          </button>
          <LiveSearchBar value={query} onChange={setQuery} placeholder="Search for bangles, jewelry & more..." />
          <button
            className="home-icon"
            type="button"
            aria-label="Search by photo with Salaar"
            onClick={() =>
              window.dispatchEvent(new Event("primehub:photo-search"))
            }
          >
            <Camera />
          </button>
        </form>
      </header>
      <dialog
        ref={menu}
        className="home-menu"
        onClose={() => menuButton.current?.focus()}
        onClick={(event) => {
          if (event.target === menu.current) menu.current.close();
        }}
      >
        <HomeGuideVideo mode="menu" />

        <div className="home-menu-top">
          <b>Shop by Category</b>
          <button
            className="home-icon"
            aria-label="Close menu"
            onClick={() => menu.current?.close()}
          >
            <X />
          </button>
        </div>

        <nav aria-label="Main menu">
          {menuCategories.map((category) => {
            const href = categoryHref(category);
            return (
              <Link
                key={category.id || category.title}
                href={href}
                prefetch={false}
                onClick={() => menu.current?.close()}
              >
                {category.title}
              </Link>
            );
          })}

          <Link
            href="/category"
            prefetch={false}
            onClick={() => menu.current?.close()}
          >
            All Categories
          </Link>

          <p className="px-2 pb-2 pt-5 text-[10px] font-black uppercase tracking-[0.18em] text-black/45">
            Explore PrimeHubMall
          </p>

          {[
            ["Weekly Deals", "/weekly-deals"],
            ["Big Deal", "/deals/big"],
            ["New Arrivals", "/new-arrivals"],
            ["Sale Mela", "/primehubmall/salemela"],
            ["Reseller Club", "/reseller"],
            ["Prime Skills", "/skills"],
            ["Shop", "/shop"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              onClick={() => menu.current?.close()}
            >
              {label}
            </Link>
          ))}
        </nav>
      </dialog>
    </>
  );
}
