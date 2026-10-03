"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { visitorTrafficSource } from "@/lib/visitorPolicy";

const DEVICE_KEY = "primehub-device-id-v1";
const VISIT_DAY_KEY = "primehub-counted-day-v1";
const ATTEMPT_KEY = "primehub-visit-attempt-v2";
const MEMBER_LINK_KEY = "primehub-visit-member-link-v1";
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

export default function VisitorTracker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || navigator.webdriver ||
        !['primehubmall.com', 'www.primehubmall.com'].includes(location.hostname)) return;
    let unsubscribe = () => {};
    let started = false;
    const source = visitorTrafficSource(location.search, document.referrer, location.origin);
    const start = (event: Event) => {
      if (started || !event.isTrusted || document.visibilityState !== 'visible' || location.pathname.startsWith('/admin')) return;
      started = true;

      try {
        const day = pakistanDayKey();
        const deviceId = getDeviceId();


        const sendVisit = async (member?: {
          uid: string;
          email?: string | null;
          name?: string | null;
        }) => {
          const response = await fetch("/api/visit", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "same-origin",
            keepalive: true,
            cache: "no-store",
            body: JSON.stringify({
              deviceId,
              engaged: true,
              source,
              memberUid: member?.uid || "",
              memberEmail: member?.email || "",
              memberName: member?.name || "",
            }),
          });

          if (!response.ok) {
            throw new Error("Visitor count request failed.");
          }

          return response.json().catch(() => ({
            success: true,
            memberLinked: false,
          }));
        };

        if (
          window.localStorage.getItem(VISIT_DAY_KEY) !== day &&
          !attemptIsFresh(day)
        ) {
          window.localStorage.setItem(
            ATTEMPT_KEY,
            `${day}|${Date.now()}`,
          );

          void sendVisit()
            .then(() => {
              window.localStorage.setItem(VISIT_DAY_KEY, day);
              window.localStorage.removeItem(ATTEMPT_KEY);
            })
            .catch(() => {
              try {
                window.localStorage.removeItem(ATTEMPT_KEY);
              } catch {}
            });
        }

        unsubscribe = onAuthStateChanged(auth, (user) => {
          if (!user) return;

          const memberKey = `${day}|${user.uid}`;

          if (
            window.localStorage.getItem(MEMBER_LINK_KEY) ===
            memberKey
          ) {
            return;
          }

          void sendVisit({
            uid: user.uid,
            email: user.email,
            name: user.displayName,
          })
            .then((result) => {
              if (result?.success) {
                window.localStorage.setItem(
                  MEMBER_LINK_KEY,
                  memberKey,
                );
              }
            })
            .catch(() => {});
        });
      } catch {}

    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    events.forEach(type => window.addEventListener(type, start, { passive: true }));
    return () => {
      events.forEach(type => window.removeEventListener(type, start));
      unsubscribe();
    };
  }, []);

  return null;
}
