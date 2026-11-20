'use client';

import { useId, useState } from 'react';
import { cardSizeDescription, shortCardSize, uniqueCardSizes } from '@/lib/cardSizeLabels';

type Props = {
  sizes: unknown;
  selected: string;
  onSelect: (size: string) => void;
  title: string;
  category?: string;
  disabled?: boolean;
  className?: string;
};

/** Reuse on Home, BOGO, Shop, and category cards. Only verified catalog sizes are shown. */
export default function CardSizePicker({ sizes, selected, onSelect, title, category = '', disabled = false, className = '' }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  const options = uniqueCardSizes(sizes);
  const sizeContext = `${category} ${title}`;
  if (!options.length) return null;

  return <div data-card-sizes className={`min-w-0 ${className}`}>
    <div className="mb-1 flex min-w-0 flex-wrap items-center justify-between gap-x-1 gap-y-0.5">
      <span className="text-[10px] font-bold text-[#665f54]">Available sizes</span>
      <button type="button" className="text-[10px] font-extrabold text-[#0F6A5F] underline underline-offset-2 hover:text-[#064d42] focus-visible:outline-2"
        aria-expanded={detailsOpen} aria-controls={detailsId}
        onClick={() => setDetailsOpen(open => !open)}>
        Size details
      </button>
    </div>
    <div role="group" aria-label={`Choose size for ${title}`} className="flex min-w-0 flex-wrap gap-1">
      {options.map(size => <button key={size} type="button" disabled={disabled}
        aria-label={`Choose size ${cardSizeDescription(size, sizeContext)} for ${title}`}
        aria-pressed={selected === size} title={cardSizeDescription(size, sizeContext)}
        onClick={() => onSelect(size)}
        className="min-h-8 min-w-8 max-w-full break-words rounded-md border border-[#cddbd5] bg-[#f7fbf8] px-1.5 text-[10px] font-extrabold text-[#0f6a5f] aria-pressed:border-[#0f6a5f] aria-pressed:bg-[#0f6a5f] aria-pressed:text-white disabled:opacity-45 focus-visible:outline-2">
        {shortCardSize(size)}
      </button>)}
    </div>
    {selected && options.includes(selected) && <p role="status" className="mt-1 rounded bg-[#e7f4ed] px-1.5 py-1 text-[10px] font-semibold leading-[14px] text-[#075447]">
      Selected: {cardSizeDescription(selected, sizeContext)}
    </p>}
    {detailsOpen && <div id={detailsId} role="region" aria-label={`Size details for ${title}`} className="mt-1.5 max-h-36 overflow-y-auto rounded-lg border border-[#dae7dd] bg-[#f8fbf8] p-2 text-[10px] leading-[16px] text-[#334e44]">
      {options.map(size => <p key={size} className="py-0.5">{cardSizeDescription(size, sizeContext)}</p>)}
      <p className="mt-1 font-semibold text-[#65776c]">Only currently listed sizes are shown. Stock is checked before adding to cart.</p>
    </div>}
  </div>;
}
