import { NextResponse } from "next/server";
import { verifyPrimeHubAdminRequest } from "@/lib/adminSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES = [
  "direct",
  "google",
  "tiktok",
  "facebook",
  "instagram",
  "whatsapp",
  "youtube",
  "other",
] as const;

type StatsPayload = {
  success: true;
  today: string;
  yesterday: string;
  todayTotal: number;
  yesterdayTotal: number;
  sources: Record<string, number>;
  countingRule: string;
};

let memoryCache:
  | {
      at: number;
      payload: StatsPayload;
    }
  | null = null;

const CACHE_MS = 30_000;

function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!url || !key) {
    throw new Error(
      "Supabase visitor analytics credentials are not configured.",
    );
  }

  return { url, key };
}

function pakistanDay(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  const base =
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
    ) +
    offsetDays * 86_400_000;

  const date = new Date(base);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

async function loadStats(today: string, yesterday: string) {
  const { url, key } = config();

  const params = new URLSearchParams();

  params.set(
    "select",
    "visit_day,source,unique_devices",
  );

  params.set(
    "visit_day",
    `in.(${yesterday},${today})`,
  );

  const response = await fetch(
    `${url}/rest/v1/daily_unique_visitor_stats?${params.toString()}`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Visitor stats read failed ${response.status}`,
    );
  }

  return (await response.json()) as Array<{
    visit_day?: string;
    source?: string;
    unique_devices?: number | string;
  }>;
}

export async function GET(request: Request) {
  const admin = await verifyPrimeHubAdminRequest(request);

  if (!admin) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  try {
    if (
      memoryCache &&
      Date.now() - memoryCache.at < CACHE_MS
    ) {
      return NextResponse.json(memoryCache.payload, {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      });
    }

    const today = pakistanDay(0);
    const yesterday = pakistanDay(-1);

    /*
      One Supabase request returns at most a few aggregated rows.
      No per-source query loop.
    */
    const rows = await loadStats(today, yesterday);

    const sources: Record<string, number> =
      Object.fromEntries(
        SOURCES.map((source) => [source, 0]),
      );

    let todayTotal = 0;
    let yesterdayTotal = 0;

    for (const row of rows) {
      const count = Number(row.unique_devices || 0);

      if (!Number.isFinite(count)) continue;

      if (row.visit_day === today) {
        todayTotal += count;

        if (
          row.source &&
          Object.prototype.hasOwnProperty.call(
            sources,
            row.source,
          )
        ) {
          sources[row.source] += count;
        }
      }

      if (row.visit_day === yesterday) {
        yesterdayTotal += count;
      }
    }

    const payload: StatsPayload = {
      success: true,
      today,
      yesterday,
      todayTotal,
      yesterdayTotal,
      sources,
      countingRule:
        "one-browser-device-per-pakistan-day",
    };

    memoryCache = {
      at: Date.now(),
      payload,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error(
      "Admin visitor stats failed",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Visitor statistics could not be loaded.",
      },
      { status: 503 },
    );
  }
}
