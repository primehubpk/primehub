'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Video } from 'lucide-react';
import type { VideoPlatform, WholesaleVideo } from '@/lib/wholesaleVideos';

const empty = {
  title: '',
  platform: 'youtube' as VideoPlatform,
  url: '',
  thumbnailUrl: '',
  description: '',
  price: 0,
  active: true,
};

export default function WholesaleVideoManager() {
  const [videos, setVideos] = useState<WholesaleVideo[]>([]);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/admin/wholesale-videos', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || 'Wholesale packages load failed.');
        }
        return result;
      })
      .then((result) => {
        if (cancelled) return;
        setVideos(Array.isArray(result.videos) ? result.videos : []);
        setSource(String(result.source || ''));
        if (result.source === 'supabase-repaired') {
          setMessage('Missing fallback packages Supabase primary mein recover ho gaye.');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Wholesale packages load failed.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function add() {
    if (!form.title.trim() || !form.url.trim()) {
      setMessage('Title aur video link required hain.');
      return;
    }
    setVideos((current) => [
      ...current,
      { ...form, price: Number(form.price || 0), id: crypto.randomUUID() },
    ]);
    setForm(empty);
    setMessage('Video add ho gaya. Save Changes dabayein.');
  }

  async function save(next = videos) {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/wholesale-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ videos: next }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Save failed');
      }
      const saved = Array.isArray(result.videos) ? result.videos : next;
      setVideos(saved);
      setSource(String(result.source || ''));
      setMessage(
        result.source === 'supabase'
          ? `Wholesale packages Supabase primary mein save ho gaye${result.firebaseMirrored === false ? '; Firebase mirror pending hai.' : ' aur Firebase fallback mirror bhi update ho gaya.'}`
          : 'Supabase unavailable tha; packages Firebase fallback mein save hue.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function remove(id: string) {
    const next = videos.filter((video) => video.id !== id);
    setVideos(next);
    void save(next);
  }

  return (
    <section className="mx-auto max-w-6xl p-4">
      <div className="rounded-[28px] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Video className="text-[#E1352B]" />
          <div>
            <h2 className="text-lg font-black">Wholesale Video Hub</h2>
            <p className="text-[10px] text-black/45">
              Supabase primary · Firebase fallback. Homepage par pehle 4 packages 2×2 preview mein aate hain.
            </p>
            <p className="mt-1 text-[9px] font-bold text-[#0F6A5F]">
              {loading ? 'Loading primary data…' : `${videos.length} package${videos.length === 1 ? '' : 's'} loaded${source ? ` · ${source}` : ''}`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input
            className="rounded-xl bg-[#F4F4F1] p-3 text-xs outline-none"
            placeholder="Video title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <select
            className="rounded-xl bg-[#F4F4F1] p-3 text-xs"
            value={form.platform}
            onChange={(event) =>
              setForm({ ...form, platform: event.target.value as VideoPlatform })
            }
          >
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
          </select>
          <input
            className="rounded-xl bg-[#F4F4F1] p-3 text-xs outline-none md:col-span-2"
            placeholder="Video link"
            value={form.url}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
          />
          <input
            className="rounded-xl bg-[#F4F4F1] p-3 text-xs outline-none"
            placeholder="Package price (optional)"
            type="number"
            min="0"
            value={form.price || ''}
            onChange={(event) =>
              setForm({ ...form, price: Number(event.target.value || 0) })
            }
          />
          <input
            className="rounded-xl bg-[#F4F4F1] p-3 text-xs outline-none"
            placeholder="Thumbnail image URL (optional)"
            value={form.thumbnailUrl}
            onChange={(event) =>
              setForm({ ...form, thumbnailUrl: event.target.value })
            }
          />
          <textarea
            className="rounded-xl bg-[#F4F4F1] p-3 text-xs outline-none md:col-span-2"
            placeholder="Short description"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
          <button
            onClick={add}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#14140F] p-3 text-xs font-black text-white disabled:opacity-50"
          >
            <Plus size={14} /> Add Video
          </button>
          <button
            disabled={saving || loading}
            onClick={() => save()}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#E1352B] p-3 text-xs font-black text-white disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {message && (
          <p className="mt-3 text-xs font-bold text-[#0F6A5F]">{message}</p>
        )}

        <div className="mt-5 space-y-2">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex items-center gap-3 rounded-2xl bg-[#F4F4F1] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black">{video.title}</p>
                <p className="truncate text-[9px] text-black/45">
                  {video.platform} · {video.url}
                </p>
                {Number(video.price || 0) > 0 ? (
                  <p className="mt-1 text-[10px] font-black text-[#E1352B]">
                    Rs. {Number(video.price).toLocaleString('en-PK')}
                  </p>
                ) : null}
              </div>
              <button
                onClick={() => remove(video.id)}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#E1352B] disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
