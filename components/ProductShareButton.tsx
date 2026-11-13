'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Share2, X } from 'lucide-react';

type Props = {
  title: string;
  className?: string;
  showLabel?: boolean;
} & ({ productId: string; path?: never } | { path: '/deals' | '/deals/bogo' | '/new-arrivals' | '/wholesale-video-hub' | '/skills'; productId?: never });

export default function ProductShareButton({ productId, path, title, className = '', showLabel = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState('');
  function copiedLink() {
    setCopied(true); setFallbackUrl('');
    window.setTimeout(() => setCopied(false), 1800);
  }
  async function copyLink(url: string) {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); copiedLink(); return; }
    } catch { /* HTTP previews and some Android WebViews need the fallback. */ }
    const text = document.createElement('textarea');
    text.value = url; text.setAttribute('readonly', '');
    Object.assign(text.style, { position: 'fixed', left: '-9999px', top: '0' });
    document.body.appendChild(text); text.select();
    let success = false;
    try { success = document.execCommand('copy'); } catch {} finally { text.remove(); }
    if (success) copiedLink(); else setFallbackUrl(url);
  }
  async function share(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault(); event.stopPropagation();
    const url = new URL(path || `/product/${encodeURIComponent(productId || '')}`, window.location.origin).href;
    if (navigator.share) {
      try { await navigator.share({ title, text: `${title} — PrimeHubMall`, url }); return; }
      catch (error) { if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return; }
    }
    await copyLink(url);
  }
  return <>
    <button type="button" onClick={share} aria-label={`Share ${title}`} title="Share / copy link" className={className}>
      {copied ? <Check size={15}/> : <Share2 size={15}/>}
      {showLabel ? <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span> : null}
    </button>
    {fallbackUrl && typeof document !== 'undefined' ? createPortal(<div role="dialog" aria-label="Copy share link" className="fixed inset-x-4 bottom-24 z-[100] mx-auto max-w-md rounded-2xl border border-black/10 bg-white p-4 text-left text-[#173b31] shadow-xl">
      <div className="flex items-center justify-between gap-2"><strong className="text-sm">Copy this link</strong><button type="button" aria-label="Close share link" onClick={() => setFallbackUrl('')}><X size={18}/></button></div>
      <input aria-label="Shareable link" className="mt-3 w-full rounded-lg border p-2 text-xs" readOnly value={fallbackUrl} onFocus={event => event.currentTarget.select()}/>
      <p className="mt-2 text-xs">Press and hold the link to copy it.</p>
    </div>, document.body) : null}
  </>;
}
