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
import { useCartStore } from "@/lib/cartStore";
import { useSettings } from "@/lib/useSettings";
import {
  buildSmartSearchHref,
  interpretSearchQuery,
} from "@/lib/aiSearchClient";

export default function HomeHeader() {
  const { settings } = useSettings();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [count, setCount] = useState(0);
  const items = useCartStore((s) => s.items);
  const openDrawer = useCartStore((s) => s.openDrawer);
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
    setSearching(true);
    try {
      router.push(
        buildSmartSearchHref(await interpretSearchQuery(query.trim())),
      );
    } catch {
      router.push(`/shop?q=${encodeURIComponent(query.trim())}`);
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
            ref={menuButton}
            className="home-icon"
            aria-label="Open menu"
            onClick={() => menu.current?.showModal()}
          >
            <Menu />
          </button>
          <Link href="/" className="home-logo" aria-label="PrimeHubMall home">
            PrimeHub<span>Mall</span>
          </Link>
          <nav aria-label="Quick links" className="home-quick-links">
            <Link href="/orders">
              <ReceiptText />
              <span>My Orders</span>
            </Link>
            <Link href="/shop">
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
        <div className="home-menu-top">
          <b>Explore PrimeHubMall</b>
          <button
            className="home-icon"
            aria-label="Close menu"
            onClick={() => menu.current?.close()}
          >
            <X />
          </button>
        </div>
        <nav aria-label="Main menu">
          {[
            ["Shop all products", "/shop"],
            ["Weekly Deals", "/weekly-deals"],
            ["New Arrivals", "/new-arrivals"],
            ["Reseller Club", "/reseller"],
            ["Prime Skills", "/skills"],
            ["My Orders", "/orders"],
            ["Rewards", "/rewards"],
            ["Contact us", "/contact"],
          ].map(([label, href]) => (
            <Link key={href} href={href} onClick={() => menu.current?.close()}>
              {label}
            </Link>
          ))}
        </nav>
      </dialog>
    </>
  );
}
