'use client';

import { imageOf, priceOf, titleOf } from '@/components/checkout/useCheckout';
import CartItemControls from './CartItemControls';

export default function CartItem({
  item,
  removeItem,
  updateQty,
}: {
  item: any;
  removeItem: (id: string) => void;
  updateQty: (id: string, q: number) => void;
}) {
  const qty = Number(item.quantity || item.qty || 1);
  const id = String(item.id || item.productId);
  const title = titleOf(item);
  const image = imageOf(item);
  const price = priceOf(item);
  const lineTotal = price * qty;

  return (
    <article className="rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_4px_18px_rgba(0,0,0,0.045)] sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#F7F7F5] sm:h-28 sm:w-28">
          {image ? (
            <img src={image} alt={title} className="h-full w-full object-cover" />
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
              {item.dealDay && item.originalPrice > price && (
                <span className="mt-2 inline-flex rounded-full bg-[#E1352B]/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#E1352B]">
                  Deal Price
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-[8px] font-black uppercase tracking-[0.16em] text-black/35">Quantity</p>
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
        </div>
      </div>
    </article>
  );
}
