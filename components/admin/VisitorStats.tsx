"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

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
              <div className="rounded-2xl bg-[#F4F4F1] p-4">
                <p className="text-[9px] font-black uppercase tracking-wider text-black/40">
                  Today
                </p>
                <p className="mt-1 text-3xl font-black">{data.todayTotal}</p>
                <p className="mt-1 text-[9px] text-black/35">{data.today}</p>
              </div>

              <div className="rounded-2xl bg-[#F4F4F1] p-4">
                <p className="text-[9px] font-black uppercase tracking-wider text-black/40">
                  Yesterday
                </p>
                <p className="mt-1 text-3xl font-black">{data.yesterdayTotal}</p>
                <p className="mt-1 text-[9px] text-black/35">{data.yesterday}</p>
              </div>
            </div>

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
