"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

const WEEKLY_DEALS_TITLE = "PrimeHubMall Weekly Deals";
const WEEKLY_DEALS_HREF = "/weekly-deals";

export default function HomeHeading({ children }: { children: ReactNode }) {
  const pressStartedAt = useRef(0);
  const isWeeklyDealsHeading = children === WEEKLY_DEALS_TITLE;

  const openWeeklyDeals = () => {
    window.location.assign(WEEKLY_DEALS_HREF);
  };

  const handlePointerDown = (_event: PointerEvent<HTMLSpanElement>) => {
    pressStartedAt.current = Date.now();
  };

  const handlePointerUp = (_event: PointerEvent<HTMLSpanElement>) => {
    const pressDuration = Date.now() - pressStartedAt.current;
    pressStartedAt.current = 0;
    if (pressDuration > 0 && pressDuration < 350) openWeeklyDeals();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openWeeklyDeals();
    }
  };

  if (isWeeklyDealsHeading) {
    return (
      <h2 className="home-heading relative">
        <span>
          <span aria-hidden="true">❧</span>
          <Link
            href={WEEKLY_DEALS_HREF}
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
          title="Open all weekly deals"
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
