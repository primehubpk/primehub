'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { youtubeId, type WholesaleVideo } from '@/lib/wholesaleVideos';

type Player = {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getPlayerState: () => number;
  destroy: () => void;
};
type YouTubeAPI = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: { target: Player }) => void;
        onError: (event: { data: number }) => void;
        onStateChange: (event: { data: number }) => void;
      };
    },
  ) => Player;
};

let apiPromise: Promise<YouTubeAPI> | null = null;

/** Load Google's supported iframe player API only after the customer taps Play. */
function loadYoutubePlayer(): Promise<YouTubeAPI> {
  const client = window as Window & {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  };
  if (client.YT?.Player) return Promise.resolve(client.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeAPI>((resolve, reject) => {
    const existingCallback = client.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => reject(new Error('Video player could not load.')), 15000);
    client.onYouTubeIframeAPIReady = () => {
      existingCallback?.();
      window.clearTimeout(timeout);
      if (client.YT?.Player) resolve(client.YT);
      else reject(new Error('Video player is unavailable.'));
    };

    if (!document.querySelector('script[data-primehub-youtube-api]')) {
      const script = document.createElement('script');
      script.dataset.primehubYoutubeApi = '1';
      script.async = true;
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('Video player could not load.'));
      };
      document.head.appendChild(script);
    }
  }).catch((error) => {
    // Permit a later retry if the device was offline.
    apiPromise = null;
    throw error;
  });
  return apiPromise;
}

type Props = { video: WholesaleVideo | null; onClose: () => void };

/**
 * The video stays inside PrimeHub's page/WebView. Only the explicit
 * "Full video on YouTube" control opens YouTube outside the app.
 */
export default function WholesaleVideoPlayer({ video, onClose }: Props) {
  const id = video?.platform === 'youtube' ? youtubeId(video.url) : '';
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!video) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', keydown);
    };
  }, [video]);

  useEffect(() => {
    if (!video) return;
    let cancelled = false;
    setReady(false);
    setPlaying(false);
    setMuted(false);
    setError('');
    if (!id) {
      setError('This video cannot be played inside the app.');
      return;
    }
    void loadYoutubePlayer()
      .then((YT) => {
        if (cancelled || !host.current) return;
        const instance = new YT.Player(host.current, {
          videoId: id,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            playsinline: 1,
            controls: 1,
            rel: 0,
            fs: 0, // Full-video control deliberately opens the YouTube app instead.
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              setReady(true);
              setMuted(event.target.isMuted());
              // This is initiated by an explicit tap. Embedded controls remain
              // available if Android blocks auto-play regardless of that tap.
              event.target.playVideo();
            },
            onError: () => {
              if (!cancelled) setError('YouTube could not play this video here. You can watch it on YouTube.');
            },
            onStateChange: (event) => {
              if (!cancelled) setPlaying(event.data === 1);
            },
          },
        });
        player.current = instance;
      })
      .catch(() => {
        if (!cancelled) setError('The in-app player did not load. Please try YouTube.');
      });

    return () => {
      cancelled = true;
      try { player.current?.destroy(); } catch {}
      player.current = null;
    };
  }, [video, id]);

  if (!video) return null;
  const youtubeLink = id ? `https://www.youtube.com/watch?v=${id}` : video.url;

  function toggleSound() {
    if (!player.current || !ready) return;
    if (muted) player.current.unMute();
    else player.current.mute();
    setMuted(!muted);
  }
  function togglePlayback() {
    if (!player.current || !ready) return;
    if (player.current.getPlayerState() === 1) {
      player.current.pauseVideo();
      setPlaying(false);
    } else {
      player.current.playVideo();
      setPlaying(true);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Watch ${video.title}`}
      className="fixed inset-0 z-[180] flex items-center justify-center bg-black/90 px-3 py-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-[#151510] text-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-black">{video.title}</p>
            <p className="text-[10px] text-white/60">Wholesale video · Playing inside PrimeHubMall</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close video" className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full bg-white/15"><X size={20} /></button>
        </header>
        <div className="relative aspect-video w-full bg-black">
          <div ref={host} className="h-full w-full" />
          {!ready && !error ? <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white/80">Loading video…</div> : null}
          {error ? <div role="alert" className="absolute inset-0 flex items-center justify-center bg-[#151510] px-6 text-center text-xs text-white">{error}</div> : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="flex gap-2">
            <button type="button" onClick={togglePlayback} disabled={!ready || Boolean(error)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-3 text-[11px] font-bold disabled:opacity-40">
              {playing ? <Pause size={17} /> : <Play size={17} />} {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={toggleSound} disabled={!ready || Boolean(error)} aria-label={muted ? 'Turn sound on' : 'Mute sound'} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-3 text-[11px] font-bold disabled:opacity-40">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />} {muted ? 'Sound on' : 'Sound off'}
            </button>
          </div>
          <a href={youtubeLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#E1352B] px-4 text-[11px] font-black text-white">
            <ExternalLink size={16} /> Full video on YouTube
          </a>
        </div>
      </section>
    </div>
  );
}
