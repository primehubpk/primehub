"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

type VisitorDetail = {
  visitorId: string;
  source: string;
  country: string;
  firstSeenAt: string;
  memberUid: string;
  memberEmail: string;
  memberName: string;
};

type VisitorData = {
  today: string;
  yesterday: string;
  todayTotal: number;
  yesterdayTotal: number;
  sources: Record<string, number>;
};

const LABELS: Record<string, string> = {
  direct: "Direct",
  google: "Google",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  other: "Other",
};

export default function VisitorStats() {
  const [data, setData] = useState<VisitorData | null>(null);
  const [error, setError] = useState("");
  const [detailDay, setDetailDay] = useState<"today" | "yesterday" | null>(null);
  const [details, setDetails] = useState<VisitorDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/admin/visitors", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const json = await response.json().catch(() => null);

        if (!response.ok || !json?.success) {
          throw new Error(json?.error || "Visitor statistics unavailable.");
        }

        return json as VisitorData;
      })
      .then((json) => {
        if (active) setData(json);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Visitor statistics unavailable.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function toggleDetails(day: "today" | "yesterday") {
    if (detailDay === day) {
      setDetailDay(null);
      setDetails([]);
      setDetailError("");
      return;
    }

    setDetailDay(day);
    setDetails([]);
    setDetailError("");
    setDetailLoading(true);

    try {
      const response = await fetch(
        `/api/admin/visitors?details=${day}`,
        {
          credentials: "same-origin",
          cache: "no-store",
        },
      );
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.success) {
        throw new Error(
          json?.error || "Visitor details unavailable.",
        );
      }

      setDetails(
        Array.isArray(json.visitors)
          ? (json.visitors as VisitorDetail[])
          : [],
      );
    } catch (reason) {
      setDetailError(
        reason instanceof Error
          ? reason.message
          : "Visitor details unavailable.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 pb-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.03]">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-[#0F6A5F]" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#0F6A5F]">
              Website Visitors
            </p>
            <h2 className="text-lg font-black">Daily Unique Devices</h2>
          </div>
        </div>

        <p className="mt-2 text-[10px] leading-4 text-black/45">
          Same browser/device counts only once per Pakistan day, even after guest,
          admin or reseller login.
        </p>

        {error ? (
          <p className="mt-4 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : !data ? (
          <p className="mt-4 text-xs text-black/40">Loading visitor count...</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void toggleDetails("today")}
                className="rounded-2xl bg-[#F4F4F1] p-4 text-left transition hover:bg-[#ECECE7]"
              >
                <p className="text-[9px] font-black uppercase tracking-wider text-black/40">
                  Today
                </p>
                <p className="mt-1 text-3xl font-black">{data.todayTotal}</p>
                <p className="mt-1 text-[9px] text-black/35">{data.today}</p>
                <p className="mt-2 text-[8px] font-black uppercase tracking-wider text-[#0F6A5F]">
                  Tap to view IDs
                </p>
              </button>

              <button
                type="button"
                onClick={() => void toggleDetails("yesterday")}
                className="rounded-2xl bg-[#F4F4F1] p-4 text-left transition hover:bg-[#ECECE7]"
              >
                <p className="text-[9px] font-black uppercase tracking-wider text-black/40">
                  Yesterday
                </p>
                <p className="mt-1 text-3xl font-black">{data.yesterdayTotal}</p>
                <p className="mt-1 text-[9px] text-black/35">{data.yesterday}</p>
                <p className="mt-2 text-[8px] font-black uppercase tracking-wider text-[#0F6A5F]">
                  Tap to view IDs
                </p>
              </button>
            </div>

            {detailDay ? (
              <div className="mt-4 rounded-2xl border border-black/8 bg-[#FBFBF8] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#0F6A5F]">
                      {detailDay === "today" ? "Today" : "Yesterday"} visitor IDs
                    </p>
                    <p className="mt-1 text-[9px] text-black/40">
                      One row per browser/device for that Pakistan day.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailDay(null);
                      setDetails([]);
                      setDetailError("");
                    }}
                    className="rounded-lg bg-black/5 px-2.5 py-1.5 text-[9px] font-black"
                  >
                    Close
                  </button>
                </div>

                {detailLoading ? (
                  <p className="mt-3 text-[10px] font-bold text-black/40">
                    Loading visitor IDs...
                  </p>
                ) : detailError ? (
                  <p className="mt-3 rounded-xl bg-red-50 p-3 text-[10px] font-bold text-red-700">
                    {detailError}
                  </p>
                ) : details.length ? (
                  <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                    {details.map((visitor) => (
                      <div
                        key={visitor.visitorId}
                        className="rounded-xl bg-white p-3 ring-1 ring-black/5"
                      >
                        <p className="break-all font-mono text-[9px] font-bold text-black/70">
                          ID: {visitor.visitorId}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-black/50 sm:grid-cols-4">
                          <span>Source: <b>{LABELS[visitor.source] || visitor.source}</b></span>
                          <span>Country: <b>{visitor.country || "unknown"}</b></span>
                          <span>
                            Member: <b>{visitor.memberEmail || visitor.memberName || "Guest / not linked"}</b>
                          </span>
                          <span>
                            UID: <b className="break-all">{visitor.memberUid || "—"}</b>
                          </span>
                        </div>
                        <p className="mt-1 text-[8px] text-black/35">
                          First seen: {visitor.firstSeenAt || "unknown"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[10px] font-bold text-black/40">
                    No visitor rows found for this day.
                  </p>
                )}
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(data.sources).map(([source, count]) => (
                <div key={source} className="rounded-2xl border border-black/8 px-3 py-3">
                  <p className="text-[9px] font-black text-black/40">
                    {LABELS[source] || source}
                  </p>
                  <p className="mt-1 text-lg font-black">{count}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
