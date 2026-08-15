'use client';

import { Package } from 'lucide-react';

export default function WholesaleBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[8px] font-black text-[#14140F] shadow-sm backdrop-blur-sm">
      <Package size={10} aria-hidden="true" />
      Wholesale
    </span>
  );
}
