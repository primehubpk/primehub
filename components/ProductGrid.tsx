// components/ProductGrid.tsx
// SECTION 6: "Just For You" product feed.
//
// UPDATED: products load live from Firestore's `products` collection.
// Any product with a `videoUrl` (set from the admin Products tab) now
// shows a "▶ Reel" badge — tapping it opens a modal video player.
// Supports YouTube links (embedded as an iframe) and direct .mp4 links
// (played with a native <video> tag). Other links (e.g. Instagram Reels,
// which block iframe embedding) open in a new tab instead.

'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Star, MessageCircle, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';
import { useSettings } from '@/lib/useSettings';
import { Product } from '@/lib/types';

// ==========================================
// SECTION: HELPERS
// ==========================================
function buildWhatsAppLink(whatsappNumber: string, productName: string, price: number) {
  const text = `Hi! I want to order: ${productName} - Rs ${price}. Please confirm availability.`;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
}

function discountBadge(price: number, originalPrice: number) {
  if (!originalPrice || originalPrice <= price) return null;
  const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
  return `-${pct}%`;
}

// Works out how to play a given video link: YouTube gets embedded,
// direct .mp4 gets a native player, anything else (Instagram Reels,
// TikTok, etc.) just opens in a new tab since those platforms block
// iframe embedding.
type VideoKind = 'youtube' | 'mp4' | 'external';

function getVideoKind(url: string): VideoKind {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.toLowerCase().endsWith('.mp4')) return 'mp4';
  return 'external';
}

function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  const videoId = match ? match[1] : '';
  return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
}

// ==========================================
// SECTION: VIDEO MODAL
// ==========================================
function VideoModal({ videoUrl, onClose }: { videoUrl: string; onClose: () => void }) {
  const kind = getVideoKind(videoUrl);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close video"
          className="absolute -top-10 right-0 text-white"
        >
          <X className="w-6 h-6" aria-hidden="true" />
        </button>

        <div className="aspect-[9/16] max-h-[80vh] rounded-xl overflow-hidden bg-black mx-auto">
          {kind === 'youtube' && (
            <iframe
              className="w-full h-full"
              src={getYouTubeEmbedUrl(videoUrl)}
              title="Product video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
          {kind === 'mp4' && (
            <video src={videoUrl} controls autoPlay className="w-full h-full object-contain" />
          )}
          {kind === 'external' && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-white text-sm">This video opens on its original platform.</p>
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#0F6A5F] text-white text-sm font-semibold px-4 py-2 rounded-full"
              >
                Open Reel
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// SECTION: PRODUCT GRID
// ==========================================
export default function ProductGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const addItem = useCartStore((s) => s.addItem);
  const { settings } = useSettings();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]);
    });
    return () => unsub();
  }, []);

  return (
    <section className="max-w-md mx-auto px-4 mt-6">
      <h2 className="font-[family-name:var(--font-display)] font-bold text-base mb-3">
        Just For You
      </h2>

      {products.length === 0 && (
        <p className="text-xs text-black/40">No products yet — add some from the admin panel.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => {
          const badge = discountBadge(p.price, p.originalPrice);
          const outOfStock = p.stock <= 0;

          return (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-black/10 overflow-hidden flex flex-col"
            >
              <div className="relative h-24 bg-[#F4F4F1]">
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                )}

                {badge && (
                  <span
                    className="absolute top-2 left-0 bg-[#E1352B] text-white text-[10px] font-bold px-2 py-0.5"
                    style={{ clipPath: 'polygon(0 0, 100% 0, 92% 50%, 100% 100%, 0 100%)' }}
                  >
                    {badge}
                  </span>
                )}

                {outOfStock && (
                  <span className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold">
                    SOLD OUT
                  </span>
                )}

                {/* SECTION: SHINY "WATCH VIDEO" BADGE — only shows when this product has a videoUrl */}
                {p.videoUrl && (
                  <button
                    type="button"
                    onClick={() => setActiveVideoUrl(p.videoUrl!)}
                    aria-label={`Watch video for ${p.title}`}
                    className="absolute bottom-2 right-2 flex items-center gap-1 bg-gradient-to-r from-[#E1352B] to-[#FFB020] text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md active:scale-95 transition"
                  >
                    🎬 Reel
                  </button>
                )}
              </div>

              <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                <p className="text-xs font-medium leading-snug line-clamp-2">{p.title}</p>

                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-[#FFB020] text-[#FFB020]" aria-hidden="true" />
                  <span className="text-[10px] text-black/50">4.5</span>
                </div>

                <div className="flex items-baseline gap-1.5 font-[family-name:var(--font-mono)]">
                  <span className="text-sm font-bold">Rs {p.price}</span>
                  {p.originalPrice > p.price && (
                    <span className="text-[10px] text-black/40 line-through">Rs {p.originalPrice}</span>
                  )}
                </div>

                <div className="mt-1 flex gap-1.5">
                  <button
                    type="button"
                    disabled={outOfStock}
                    onClick={() =>
                      addItem({ id: Number(p.id) || Date.now(), name: p.title, price: p.price, originalPrice: p.originalPrice })
                    }
                    className="flex-1 text-[10px] font-semibold bg-[#14140F] text-white rounded-full py-1.5 active:scale-95 transition disabled:opacity-40"
                  >
                    {outOfStock ? 'Sold Out' : 'Add to Cart'}
                  </button>
                  <a
                    href={buildWhatsAppLink(settings.whatsappNumber, p.title, p.price)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Order ${p.title} on WhatsApp`}
                    className="w-8 h-8 shrink-0 rounded-full bg-[#0F6A5F] text-white flex items-center justify-center active:scale-95 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SECTION: VIDEO MODAL — mounted once, driven by activeVideoUrl */}
      {activeVideoUrl && (
        <VideoModal videoUrl={activeVideoUrl} onClose={() => setActiveVideoUrl(null)} />
      )}
    </section>
  );
}
