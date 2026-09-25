"use client";

import { useEffect } from "react";

const DEVICE_KEY = "primehub-device-id-v1";
const VISIT_DAY_KEY = "primehub-counted-day-v1";
const ATTEMPT_KEY = "primehub-visit-attempt-v2";
const ATTEMPT_TTL_MS = 60_000;

function pakistanDayKey() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getDeviceId() {
  let id = window.localStorage.getItem(DEVICE_KEY);

  if (id) return id;

  id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
          .toString(36)
          .slice(2)}`;

  window.localStorage.setItem(DEVICE_KEY, id);

  return id;
}

function attemptIsFresh(day: string) {
  const raw = window.localStorage.getItem(ATTEMPT_KEY);

  if (!raw) return false;

  const [attemptDay, rawAt] = raw.split("|");
  const at = Number(rawAt);

  return (
    attemptDay === day &&
    Number.isFinite(at) &&
    Date.now() - at < ATTEMPT_TTL_MS
  );
}

function trafficSource() {
  const params = new URLSearchParams(window.location.search);

  const utm = String(params.get("utm_source") || "").toLowerCase();
  const referrer = String(document.referrer || "").toLowerCase();
  const value = `${utm} ${referrer}`;

  if (value.includes("tiktok")) return "tiktok";
  if (value.includes("instagram")) return "instagram";
  if (value.includes("facebook") || value.includes("fb.com")) return "facebook";
  if (value.includes("whatsapp") || value.includes("wa.me")) return "whatsapp";
  if (value.includes("youtube") || value.includes("youtu.be")) return "youtube";
  if (value.includes("google")) return "google";

  if (!utm && !referrer) return "direct";

  return "other";
}

export default function VisitorTracker() {
  useEffect(() => {
    try {
      const day = pakistanDayKey();

      if (window.localStorage.getItem(VISIT_DAY_KEY) === day) {
        return;
      }

      if (attemptIsFresh(day)) {
        return;
      }

      window.localStorage.setItem(
        ATTEMPT_KEY,
        `${day}|${Date.now()}`,
      );

      fetch("/api/visit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        keepalive: true,
        cache: "no-store",
        body: JSON.stringify({
          deviceId: getDeviceId(),
          source: trafficSource(),
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Visitor count request failed.");
          }

          window.localStorage.setItem(VISIT_DAY_KEY, day);
          window.localStorage.removeItem(ATTEMPT_KEY);
        })
        .catch(() => {
          try {
            window.localStorage.removeItem(ATTEMPT_KEY);
          } catch {}
        });
    } catch {}
  }, []);

  return null;
}
