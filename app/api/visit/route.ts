import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES = new Set([
  "direct",
  "google",
  "tiktok",
  "facebook",
  "instagram",
  "whatsapp",
  "youtube",
  "other",
]);

function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!url || !key) {
    throw new Error("Supabase visitor analytics is not configured.");
  }

  return { url, key };
}

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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const rawDeviceId = String(body?.deviceId || "").trim();
    const rawSource = String(body?.source || "")
      .trim()
      .toLowerCase();
    const memberUid = String(body?.memberUid || "").trim().slice(0, 160);
    const memberEmail = String(body?.memberEmail || "").trim().slice(0, 240);
    const memberName = String(body?.memberName || "").trim().slice(0, 160);

    if (
      rawDeviceId.length < 8 ||
      rawDeviceId.length > 160 ||
      !/^[a-zA-Z0-9._:-]+$/.test(rawDeviceId)
    ) {
      return NextResponse.json(
        { error: "Invalid device id." },
        { status: 400 },
      );
    }

    const day = pakistanDayKey();

    const deviceHash = createHash("sha256")
      .update(rawDeviceId)
      .digest("hex")
      .slice(0, 40);

    const source = SOURCES.has(rawSource)
      ? rawSource
      : "other";

    const country =
      request.headers.get("x-vercel-ip-country") ||
      request.headers.get("cf-ipcountry") ||
      "unknown";

    const { url, key } = config();

    const query = new URLSearchParams({
      on_conflict: "visit_day,device_hash",
    });

    const response = await fetch(
      `${url}/rest/v1/daily_unique_visitors?${query.toString()}`,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify({
          visit_day: day,
          device_hash: deviceHash,
          source,
          country,
          first_seen_at: new Date().toISOString(),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Supabase visitor insert failed ${response.status}`,
      );
    }

    let memberLinked = false;

    if (memberUid) {
      const memberUpdate = await fetch(
        `${url}/rest/v1/daily_unique_visitors?visit_day=eq.${encodeURIComponent(day)}&device_hash=eq.${encodeURIComponent(deviceHash)}`,
        {
          method: "PATCH",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            member_uid: memberUid,
            member_email: memberEmail || null,
            member_name: memberName || null,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        },
      );

      if (memberUpdate.ok) {
        memberLinked = true;
      } else if (memberUpdate.status !== 400) {
        console.warn(
          "Visitor member identity update failed",
          memberUpdate.status,
        );
      }
    }

    return NextResponse.json({
      success: true,
      memberLinked,
    });
  } catch (error) {
    console.error("Visitor tracking failed", error);

    return NextResponse.json(
      { error: "Visitor tracking failed." },
      { status: 500 },
    );
  }
}
