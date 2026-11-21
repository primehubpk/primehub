'use client';
import Image from '@/components/StorefrontSourceImage';

import { imageOf, priceOf, titleOf } from '@/components/checkout/useCheckout';
import CartItemControls from './CartItemControls';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { megaImageNeedsTrim, megaImageTrimStyle } from '@/lib/megaImagePresentation';

export default function CartItem({
  item,
  removeItem,
  updateQty,
  compact = false,
}: {
  item: any;
  removeItem: (id: string) => void;
  updateQty: (id: string, q: number) => void;
  compact?: boolean;
}) {
  const qty = Number(item.quantity || item.qty || 1);
  const id = String(item.id || item.productId);
  const title = titleOf(item);
  const image = imageOf(item);
  const price = priceOf(item);
  const lineTotal = price * qty;

  if (compact) {
    const fullSize = String(item.variant?.size || '');
    const size = fullSize.match(/^2\.\d+(?=\s+-)/)?.[0] || fullSize;
    const trim = megaImageNeedsTrim(item.productId, image);
    return <article data-cart-item={id} className="rounded-2xl border border-[#E4E8E1] bg-white p-3">
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#F7F7F2]">
          {image ? <Image fill unoptimized src={image} alt={title} className="h-full w-full object-contain" style={trim ? megaImageTrimStyle : undefined}/> : <div className="grid h-full place-items-center text-xs text-black/30">No image</div>}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[13px] font-bold leading-[18px]">{title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            {size && <span title={fullSize} className="rounded-md bg-[#EAF3ED] px-2 py-1 font-bold text-[#0F6A5F]">Size {size}</span>}
            {item.variant?.color && <span className="text-black/50">{item.variant.color}</span>}
          </div>
          <p className="mt-1.5 text-xs text-black/55">Rs. {price.toLocaleString('en-PK')} <span className="text-[10px]">{item.bogoOffer?.enabled ? 'per offer' : 'each'}</span></p>
        </div>
      </div>
      {item.bogoOffer?.enabled && <p className="mt-2 text-[11px] font-semibold text-[#0F6A5F]">{qty} paid + {qty} free · same design / size</p>}
      {Array.isArray(item.markedImages) && item.markedImages.length > 0 && <div className="mt-2">
        <p className="text-[10px] font-semibold text-[#0F6A5F]">Your marked colours ({item.markedImages.length})</p>
        <div className="mt-1 flex flex-wrap gap-1.5">{item.markedImages.slice(0, 12).map((photo: { markedUrl: string }, index: number) =>
          <a key={photo.markedUrl} href={photo.markedUrl} target="_blank" rel="noopener noreferrer" title={`View marked photo ${index + 1}`}>
            <img src={photo.markedUrl} alt={`Marked photo ${index + 1}`} className="h-10 w-10 rounded-lg border border-[#0F6A5F]/20 object-cover"/>
          </a>)}</div>
      </div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-2.5">
        <div className="flex items-center gap-1 rounded-lg border border-[#E0E7DF] bg-[#F8FAF6]">
          <button type="button" disabled={qty <= 1} onClick={() => updateQty(id, qty - 1)} aria-label={`Decrease ${title} quantity`} className="grid h-9 w-9 place-items-center text-[#0F6A5F] disabled:opacity-30"><Minus size={14}/></button>
          <span className="min-w-6 text-center text-xs font-bold" aria-label={`Quantity ${qty}`}>{qty}</span>
          <button type="button" disabled={qty >= 50} onClick={() => updateQty(id, qty + 1)} aria-label={`Increase ${title} quantity`} className="grid h-9 w-9 place-items-center text-[#0F6A5F] disabled:opacity-30"><Plus size={14}/></button>
        </div>
        <button type="button" onClick={() => removeItem(id)} aria-label={`Remove ${title}`} className="flex min-h-9 items-center gap-1 px-1 text-[10px] font-semibold text-black/45"><Trash2 size={13}/>Remove</button>
        <p className="ml-auto text-right text-sm font-black">Rs. {lineTotal.toLocaleString('en-PK')}</p>
      </div>
    </article>;
  }

  return (
    <article className="rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_4px_18px_rgba(0,0,0,0.045)] sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#F7F7F5] sm:h-28 sm:w-28">
          {image ? (
            <Image fill unoptimized src={image} alt={title} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-bold text-black/25">No image</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-sm font-extrabold leading-5 text-[#14140F] sm:text-base">
                {title}
              </h2>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-sm font-black text-[#14140F]">
                Rs. {price.toLocaleString()}
              </p>
              {item.variant ? <p className="mt-1 text-xs text-black/60">{[item.variant.color, item.variant.size].filter(Boolean).join(' · ')}</p> : null}
              {item.bogoOffer?.enabled && <p className="mt-2 text-xs font-bold text-[#0F6A5F]">{qty} paid + {qty} free · same design / size</p>}
              {item.dealDay && item.originalPrice > price && (
                <span className="mt-2 inline-flex rounded-full bg-[#E1352B]/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#E1352B]">
                  Deal Price
                </span>
              )}
            </div>
          </div>

          {Array.isArray(item.markedImages) && item.markedImages.length > 0 ? (
            <div className="mt-2">
              <p className="text-[9px] font-black text-[#0F6A5F]">Your selected favourite colours · {item.markedImages.length} marked photo{item.markedImages.length === 1 ? '' : 's'}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {item.markedImages.slice(0, 12).map((photo: { markedUrl: string }, index: number) => (
                  <a key={photo.markedUrl} href={photo.markedUrl} target="_blank" rel="noopener noreferrer" title={`View marked photo ${index + 1}`}>
                    <img src={photo.markedUrl} alt={`Marked photo ${index + 1}`} className="h-11 w-11 rounded-lg border border-[#0F6A5F]/30 object-cover"/>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[8px] font-black uppercase tracking-[0.16em] text-black/35">{item.bogoOffer?.enabled ? 'Offer packs' : 'Quantity'}</p>
          <CartItemControls
            id={id}
            qty={qty}
            title={title}
            removeItem={removeItem}
            updateQty={updateQty}
          />
        </div>

        <div className="text-right">
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-black/35">Item total</p>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-sm font-black text-[#14140F] sm:text-base">
            Rs. {lineTotal.toLocaleString()}
          </p>
        </div>
      </div>
    </article>
  );
}
