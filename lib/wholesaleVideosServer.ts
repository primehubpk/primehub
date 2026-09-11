import 'server-only';

import { getAdminDb } from '@/lib/firebaseAdmin';
import type { WholesaleVideo, VideoPlatform } from '@/lib/wholesaleVideos';

const HOME_PACKAGE_TARGET = 4;

type SupabaseSettingsRow = {
  id: string;
  payload?: Record<string, any>;
  created_at?: string | null;
  sync_version?: number | string | null;
};

function envValue(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function supabaseConfig() {
  const url = envValue('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const key = envValue('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_KEY');
  if (!url || !key) throw new Error('Supabase wholesale settings credentials are not configured.');
  return { url, key };
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Supabase wholesale settings request failed ${response.status}: ${await response.text()}`);
  }
  return response;
}

function platformOf(value: unknown): VideoPlatform {
  const platform = String(value || '').toLowerCase();
  if (platform === 'tiktok' || platform === 'instagram') return platform;
  return 'youtube';
}

function cleanVideo(value: any): WholesaleVideo | null {
  if (!value || typeof value !== 'object') return null;
  const title = String(value.title || '').trim();
  const url = String(value.url || '').trim();
  if (!title || !url) return null;
  const id = String(value.id || '').trim() || `wholesale-${Buffer.from(url).toString('base64url').slice(0, 18)}`;
  return {
    id,
    title,
    platform: platformOf(value.platform),
    url,
    thumbnailUrl: String(value.thumbnailUrl || '').trim(),
    description: String(value.description || '').trim(),
    price: Math.max(0, Number(value.price || 0)),
    active: value.active !== false,
  };
}

export function sanitizeWholesaleVideos(values: unknown): WholesaleVideo[] {
  const list = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const cleaned: WholesaleVideo[] = [];
  for (const item of list) {
    const video = cleanVideo(item);
    if (!video) continue;
    const key = video.id || video.url;
    const fallbackKey = video.url.toLowerCase();
    if (seen.has(key) || seen.has(fallbackKey)) continue;
    seen.add(key);
    seen.add(fallbackKey);
    cleaned.push(video);
  }
  return cleaned;
}

function mergeMissing(primary: WholesaleVideo[], fallback: WholesaleVideo[]) {
  const merged = [...primary];
  const ids = new Set(primary.map((video) => video.id));
  const urls = new Set(primary.map((video) => video.url.toLowerCase()));
  for (const video of fallback) {
    if (ids.has(video.id) || urls.has(video.url.toLowerCase())) continue;
    merged.push(video);
    ids.add(video.id);
    urls.add(video.url.toLowerCase());
  }
  return merged;
}

async function readSupabaseMainRow(): Promise<SupabaseSettingsRow | null> {
  const response = await supabaseRequest(
    'settings?select=id,payload,created_at,sync_version&id=eq.main&limit=1',
    { method: 'GET' },
  );
  const rows = (await response.json()) as SupabaseSettingsRow[];
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function readFirebaseVideos() {
  const snapshot = await getAdminDb().collection('settings').doc('main').get();
  if (!snapshot.exists) return [] as WholesaleVideo[];
  return sanitizeWholesaleVideos(snapshot.data()?.wholesaleVideos);
}

async function writeSupabaseVideos(videos: WholesaleVideo[]) {
  const current = await readSupabaseMainRow();
  const now = new Date().toISOString();
  const payload = {
    ...(current?.payload && typeof current.payload === 'object' ? current.payload : {}),
    wholesaleVideos: videos,
  };
  const syncVersion = Math.max(0, Number(current?.sync_version || 0)) + 1;
  await supabaseRequest('settings?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: 'main',
      payload,
      authoritative_source: 'supabase',
      mirror_status: 'pending',
      mirror_error: null,
      created_at: current?.created_at || now,
      updated_at: now,
      sync_version: syncVersion,
    }),
  });
}

async function markSupabaseMirror(status: 'synced' | 'failed', error?: string) {
  await supabaseRequest('settings?id=eq.main', {
    method: 'PATCH',
    body: JSON.stringify({
      mirror_status: status,
      mirror_error: error || null,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function getWholesaleVideosSnapshot() {
  let primaryVideos: WholesaleVideo[] = [];
  let supabaseAvailable = false;

  try {
    const row = await readSupabaseMainRow();
    supabaseAvailable = true;
    primaryVideos = sanitizeWholesaleVideos(row?.payload?.wholesaleVideos);
  } catch (error) {
    console.warn('Wholesale packages Supabase primary read failed', error);
  }

  if (supabaseAvailable) {
    if (primaryVideos.length < HOME_PACKAGE_TARGET) {
      try {
        const fallbackVideos = await readFirebaseVideos();
        const recovered = mergeMissing(primaryVideos, fallbackVideos);
        if (recovered.length > primaryVideos.length) {
          await writeSupabaseVideos(recovered);
          await markSupabaseMirror('synced');
          console.warn(
            `Wholesale packages recovered ${recovered.length - primaryVideos.length} missing Firebase fallback item(s) into Supabase primary.`,
          );
          return {
            videos: recovered,
            source: 'supabase-repaired' as const,
            primaryCount: primaryVideos.length,
            fallbackCount: fallbackVideos.length,
          };
        }
        return {
          videos: primaryVideos,
          source: 'supabase' as const,
          primaryCount: primaryVideos.length,
          fallbackCount: fallbackVideos.length,
        };
      } catch (error) {
        console.warn('Wholesale packages Firebase recovery lookup failed', error);
      }
    }

    return {
      videos: primaryVideos,
      source: 'supabase' as const,
      primaryCount: primaryVideos.length,
      fallbackCount: null,
    };
  }

  try {
    const fallbackVideos = await readFirebaseVideos();
    return {
      videos: fallbackVideos,
      source: 'firebase-fallback' as const,
      primaryCount: 0,
      fallbackCount: fallbackVideos.length,
    };
  } catch (error) {
    console.error('Wholesale packages fallback read failed', error);
    return {
      videos: [] as WholesaleVideo[],
      source: 'empty' as const,
      primaryCount: 0,
      fallbackCount: 0,
    };
  }
}

export async function saveWholesaleVideosSupabasePrimary(values: unknown) {
  const videos = sanitizeWholesaleVideos(values);

  try {
    await writeSupabaseVideos(videos);

    try {
      await getAdminDb().collection('settings').doc('main').set(
        { wholesaleVideos: videos },
        { merge: true },
      );
      await markSupabaseMirror('synced');
      return { videos, source: 'supabase' as const, firebaseMirrored: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        await markSupabaseMirror('failed', message);
      } catch {
        // Supabase already contains the authoritative payload; mirror status is best effort.
      }
      console.error('Wholesale packages Firebase mirror failed after Supabase save', error);
      return { videos, source: 'supabase' as const, firebaseMirrored: false };
    }
  } catch (primaryError) {
    console.error('Wholesale packages Supabase primary save failed', primaryError);
    await getAdminDb().collection('settings').doc('main').set(
      { wholesaleVideos: videos },
      { merge: true },
    );
    return { videos, source: 'firebase-fallback' as const, firebaseMirrored: true };
  }
}
