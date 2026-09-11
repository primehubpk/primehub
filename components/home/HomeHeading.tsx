"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

const CLICKABLE_HEADINGS: Record<string, { href: string; title: string }> = {
  "PrimeHubMall Weekly Deals": {
    href: "/weekly-deals",
    title: "Open all weekly deals",
  },
  "New Arrivals": {
    href: "/new-arrivals",
    title: "Open all new arrivals",
  },
};

export default function HomeHeading({ children }: { children: ReactNode }) {
  const pressStartedAt = useRef(0);
  const headingText = typeof children === "string" ? children : "";
  const destination = CLICKABLE_HEADINGS[headingText];

  const openDestination = () => {
    if (destination) window.location.assign(destination.href);
  };

  const handlePointerDown = (_event: PointerEvent<HTMLSpanElement>) => {
    pressStartedAt.current = Date.now();
  };

  const handlePointerUp = (_event: PointerEvent<HTMLSpanElement>) => {
    const pressDuration = Date.now() - pressStartedAt.current;
    pressStartedAt.current = 0;
    if (destination && pressDuration > 0 && pressDuration < 350) openDestination();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (destination && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openDestination();
    }
  };

  if (destination) {
    return (
      <h2 className="home-heading relative">
        <span>
          <span aria-hidden="true">❧</span>
          <Link
            href={destination.href}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-[#FFFCF7] px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#8A651F] no-underline sm:text-[9px]"
          >
            View all
          </Link>
        </span>
        <span
          role="link"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
          className="cursor-pointer select-text"
          style={{ WebkitUserSelect: "text", userSelect: "text" }}
          title={destination.title}
        >
          {children}
        </span>
        <span aria-hidden="true">❧</span>
      </h2>
    );
  }

  return (
    <h2 className="home-heading">
      <span aria-hidden="true">❧</span>
      <span>{children}</span>
      <span aria-hidden="true">❧</span>
    </h2>
  );
}
