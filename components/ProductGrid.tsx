// components/ProductGrid.tsx
// SECTION 6: "Just For You" product feed — grid cards with rating,
// price/original price, Add to Cart (writes to the Zustand cart store),
// and a WhatsApp Order deep link.

'use client';

import { Star, MessageCircle } from 'lucide-react';
import { useCartStore } from '@/lib/cartStore';

// =====================================================================
// SECTION: CONFIG
// =====================================================================
const WHATSAPP_NUMBER = '923001234567'; // no + or leading zeros

const PRODUCTS = [
  { id: 1, name: 'Steel Jug Set (2pc)', price: 149, original: 299, rating: 4.6, badge: '-50%' },
  { id: 2, name: 'Bangle Set (6pc)', price: 99, original: 199, rating: 4.8, badge: '-50%' },
  { id: 3, name: 'Kitchen Organizer Rack', price: 499, original: 799, rating: 4.4, badge: '-38%' },
  { id: 4, name: 'Wireless Earbuds Mini', price: 899, original: 1499, rating: 4.3, badge: '-40%' },
  { id: 5, name: 'LED Makeup Mirror', price: 349, original: 599, rating: 4.7, badge: '-42%' },
  { id: 6, name: 'Non-Stick Fry Pan', price: 649, original: 999, rating: 4.5, badge: '-35%' },
];

function buildWhatsAppLink(productName: string, price: number) {
  const text = `Hi! I want to order: ${productName} - Rs ${price}. Please confirm availability.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export default function ProductGrid() {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <section className="max-w-md mx-auto px-4 mt-6">
      <h2 className="font-[family-name:var(--font-display)] font-bold text-base mb-3">
        Just For You
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {PRODUCTS.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl border border-black/10 overflow-hidden flex flex-col"
          >
            <div className="relative h-24 bg-[#F4F4F1]">
              {/* torn-ticket price tag */}
              <span
                className="absolute top-2 left-0 bg-[#E1352B] text-white text-[10px] font-bold px-2 py-0.5"
                style={{ clipPath: 'polygon(0 0, 100% 0, 92% 50%, 100% 100%, 0 100%)' }}
              >
                {p.badge}
              </span>
            </div>

            <div className="p-2.5 flex flex-col gap-1.5 flex-1">
              <p className="text-xs font-medium leading-snug line-clamp-2">{p.name}</p>

              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-[#FFB020] text-[#FFB020]" aria-hidden="true" />
                <span className="text-[10px] text-black/50">{p.rating}</span>
              </div>

              <div className="flex items-baseline gap-1.5 font-[family-name:var(--font-mono)]">
                <span className="text-sm font-bold">Rs {p.price}</span>
                <span className="text-[10px] text-black/40 line-through">Rs {p.original}</span>
              </div>

              <div className="mt-1 flex gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    addItem({ id: p.id, name: p.name, price: p.price, originalPrice: p.original })
                  }
                  className="flex-1 text-[10px] font-semibold bg-[#14140F] text-white rounded-full py-1.5 active:scale-95 transition"
                >
                  Add to Cart
                </button>
                <a
                  href={buildWhatsAppLink(p.name, p.price)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Order ${p.name} on WhatsApp`}
                  className="w-8 h-8 shrink-0 rounded-full bg-[#0F6A5F] text-white flex items-center justify-center active:scale-95 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
