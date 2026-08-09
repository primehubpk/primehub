// components/YouTubeGuide.tsx
// SECTION 7: Admin-controlled YouTube tutorial.
// Settings are read from settings/main with safe local defaults.

'use client';

import { useState } from 'react';
import { PlayCircle, X } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

export default function YouTubeGuide() {
  const [videoOpen, setVideoOpen] = useState(false);
  const { settings } = useSettings();
  const guide = settings.youtubeGuide;

  if (!guide?.enabled || !guide.videoId.trim()) return null;

  const videoId = guide.videoId.trim();

  return (
    <section className="max-w-md mx-auto px-4 mt-7">
      <h2 className="font-[family-name:var(--font-display)] font-bold text-base mb-3">
        Watch &amp; Learn
      </h2>

      <button
        type="button"
        onClick={() => setVideoOpen(true)}
        className="relative w-full h-40 rounded-xl overflow-hidden bg-[#14140F] group"
      >
        <img
          src={`https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`}
          alt=""
          className="w-full h-full object-cover opacity-70 group-active:opacity-60 transition"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <PlayCircle className="w-12 h-12 text-white drop-shadow" aria-hidden="true" />
          <p className="text-white text-xs font-semibold px-6 text-center">
            {guide.title || 'Watch & Learn'}
          </p>
          {guide.description && (
            <p className="text-white/75 text-[11px] px-6 text-center">{guide.description}</p>
          )}
        </div>
      </button>

      {videoOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="relative w-full max-w-md">
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              aria-label="Close video"
              className="absolute -top-10 right-0 text-white"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
            <div className="aspect-video rounded-xl overflow-hidden">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1`}
                title={guide.title || 'PrimeHub Deals YouTube Guide'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
