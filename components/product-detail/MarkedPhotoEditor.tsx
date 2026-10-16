'use client';

import { useState, type PointerEvent } from 'react';
import { Check, ChevronLeft, Eraser, Pencil, Save, X } from 'lucide-react';
import type { MarkedProductImage } from '@/lib/types';

type Point = { x: number; y: number };
type Stroke = { points: Point[] };
type Props = {
  productId: string;
  images: string[];
  markedImages: MarkedProductImage[];
  onSaved: (value: MarkedProductImage) => void;
  onClose: () => void;
};

export default function MarkedPhotoEditor({ productId, images, markedImages, onSaved, onClose }: Props) {
  const [active, setActive] = useState(images[0] || '');
  const [drafts, setDrafts] = useState<Record<string, Stroke[]>>({});
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const saved = markedImages.find((photo) => photo.originalUrl === active);
  const strokes = drafts[active] || [];

  function point(event: PointerEvent<SVGSVGElement>): Point {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1000, ((event.clientX - box.left) / box.width) * 1000)),
      y: Math.max(0, Math.min(1000, ((event.clientY - box.top) / box.height) * 1000)),
    };
  }
  function drawStart(event: PointerEvent<SVGSVGElement>) {
    if (saving || !active) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true);
    const start = point(event);
    setDrafts((prev) => {
      const previous = prev[active] || [];
      return { ...prev, [active]: [...previous.slice(-(35 - 1)), { points: [start] }] };
    });
    setError('');
  }
  function drawMove(event: PointerEvent<SVGSVGElement>) {
    if (!drawing || saving) return;
    event.preventDefault();
    const next = point(event);
    setDrafts((prev) => {
      const previous = prev[active] || [];
      if (!previous.length) return prev;
      const last = previous[previous.length - 1];
      if (last.points.length >= 250) return prev;
      return { ...prev, [active]: [...previous.slice(0, -1), { points: [...last.points, next] }] };
    });
  }
  function stopDraw(event: PointerEvent<SVGSVGElement>) {
    if (drawing) {
      event.preventDefault();
      setDrawing(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }
  async function saveMarkedPhoto() {
    if (!active || !strokes.length || saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/orders/marked-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, originalUrl: active, strokes }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.markedImage?.markedUrl) {
        throw new Error(data?.error || 'Could not save marked photo.');
      }
      onSaved(data.markedImage as MarkedProductImage);
      setDrafts((prev) => ({ ...prev, [active]: [] }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save photo. Please retry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Mark your favourite colours">
      <section className="flex max-h-[98dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-black text-[#14140F]">Mark your favourite colour</p>
            <p className="text-[10px] text-black/50">Draw directly on each photo, then Save. You can mark several photos.</p>
          </div>
          <button type="button" aria-label="Done marking" disabled={saving} onClick={onClose} className="rounded-full bg-black/5 p-2 disabled:opacity-40"><X size={19}/></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-2" aria-label="Choose photo to mark">
            {images.map((url, index) => {
              const photoSaved = markedImages.some((item) => item.originalUrl === url);
              return (
                <button type="button" key={url} onClick={() => { if (saving) return; setDrawing(false); setActive(url); setError(''); }}
                  aria-label={`Mark photo ${index + 1}`}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${active === url ? 'border-[#0F6A5F]' : 'border-black/10'}`}>
                  <img src={url} alt={`Product photo ${index + 1}`} className="h-full w-full object-cover"/>
                  {photoSaved ? <span className="absolute bottom-0 right-0 rounded-tl-md bg-[#0F6A5F] p-0.5 text-white"><Check size={13}/></span> : null}
                </button>
              );
            })}
          </div>
          <div className="flex min-h-[180px] items-center justify-center rounded-2xl bg-[#F4F4F1] p-2">
            <div className="relative inline-block max-w-full overflow-hidden rounded-xl">
              {active ? <img src={active} alt="Product photo to mark" draggable={false} className="block max-h-[49dvh] max-w-full select-none" /> : null}
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full touch-none cursor-crosshair" aria-label="Draw colour marks on the photo"
                onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={stopDraw} onPointerCancel={stopDraw}>
                {strokes.map((stroke, index) => {
                  if (stroke.points.length === 1) {
                    const p = stroke.points[0];
                    return <g key={index}><circle cx={p.x} cy={p.y} r="16" fill="white"/><circle cx={p.x} cy={p.y} r="11" fill="#ed3329"/></g>;
                  }
                  const d = stroke.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
                  return <g key={index}><path d={d} fill="none" stroke="white" strokeWidth="21" strokeLinecap="round" strokeLinejoin="round"/><path d={d} fill="none" stroke="#ed3329" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/></g>;
                })}
              </svg>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#0F6A5F]"><Pencil size={13}/> Draw red marks over the colours you want</span>
            <button type="button" disabled={saving || !strokes.length} onClick={() => setDrafts((prev) => ({ ...prev, [active]: prev[active]?.slice(0, -1) || [] }))}
              className="inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-2 text-[10px] font-bold disabled:opacity-40"><ChevronLeft size={13}/> Undo</button>
            <button type="button" disabled={saving || !strokes.length} onClick={() => setDrafts((prev) => ({ ...prev, [active]: [] }))}
              className="inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-2 text-[10px] font-bold disabled:opacity-40"><Eraser size={13}/> Clear</button>
          </div>
          {saved && !strokes.length ? <p className="mt-2 rounded-lg bg-[#EAF7F3] px-3 py-2 text-[11px] font-black text-[#0F6A5F]">✓ This marked photo is saved for your cart and order.</p> : null}
          {error ? <p role="alert" className="mt-2 text-[11px] font-bold text-red-600">{error}</p> : null}
        </div>
        <footer className="flex shrink-0 gap-2 border-t bg-white p-3">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-black/10 px-4 py-3 text-xs font-bold disabled:opacity-40">Done</button>
          <button type="button" disabled={!strokes.length || saving} onClick={() => void saveMarkedPhoto()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0F6A5F] px-4 py-3 text-xs font-black text-white disabled:opacity-40">
            <Save size={16}/>{saving ? 'Saving photo…' : 'Save marked photo'}
          </button>
        </footer>
      </section>
    </div>
  );
}
