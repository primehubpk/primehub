'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

type Props = {
  productId: string;
  title: string;
  className?: string;
  showLabel?: boolean;
};

export default function ProductShareButton({ productId, title, className = '', showLabel = false }: Props) {
  const [copied, setCopied] = useState(false);

  async function share(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const url = `${window.location.origin}/product/${encodeURIComponent(productId)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} — PrimeHub Deals`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        window.prompt('Copy product link', url);
      }
    }
  }

  return <button type="button" onClick={share} aria-label={`Share ${title}`} title="Share product" className={className}>
    {copied ? <Check size={15}/> : <Share2 size={15}/>}
    {showLabel ? <span>{copied ? 'Link copied' : 'Share'}</span> : null}
  </button>;
}
