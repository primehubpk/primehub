// components/YouTubeGuide.tsx
// SECTION 7: Admin-controlled YouTube tutorial.
// Reads the guide URL from settings/main with a safe default fallback.

'use client';

import { useMemo } from 'react';
import { PlayCircle } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

const DEFAULT_GUIDE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function getYouTubeVideoId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('/')[0] || '';
    if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com' || url.hostname === 'm.youtube.com') {
      if (url.pathname === '/watch') return url.searchParams.get('v') || '';
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || '';
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || '';
    }
  } catch {
    return '';
  }
  return '';
}

export default function YouTubeGuide() {
  const { settings } = useSettings();
  const guideUrl = settings.youtubeGuideUrl?.trim() || DEFAULT_GUIDE_URL;
  const videoId = useMemo(() => getYouTubeVideoId(guideUrl), [guideUrl]);

  if (!videoId) return null;

  return (
    <section className="max-w-md mx-auto px-4 mt-7">
      <h2 className="font-[family-name:var(--font-display)] font-bold text-base mb-3">
        Watch &amp; Learn
      </h2>

      <a
        href={guideUrl}
        target="_blank"
        rel="noreferrer"
        className="relative block w-full h-40 rounded-xl overflow-hidden bg-[#14140F] group"
        aria-label="Watch & Learn on YouTube"
      >
        <img
          src={`https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`}
          alt=""
          className="w-full h-full object-cover opacity-70 group-active:opacity-60 transition"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <PlayCircle className="w-12 h-12 text-white drop-shadow" aria-hidden="true" />
          <p className="text-white text-xs font-semibold px-6 text-center">
            Watch &amp; Learn
          </p>
          <p className="text-white/75 text-[11px] px-6 text-center">
            Learn how to order and shop with PrimeHub Deals.
          </p>
        </div>
      </a>
    </section>
  );
}
