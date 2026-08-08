// components/Footer.tsx
// SECTION 8: Trust badges (COD, Fast Delivery, 7-Day Returns) + footer
// policy links. Pure server component — no client state needed.

import { Wallet, Truck, RotateCcw, ShieldCheck } from 'lucide-react';

const TRUST_BADGES = [
  { icon: Wallet, label: 'Cash on Delivery' },
  { icon: Truck, label: 'Fast Delivery' },
  { icon: RotateCcw, label: '7-Day Returns' },
];

const POLICY_LINKS = [
  { label: 'Return Policy', href: '/return-policy' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Contact Us', href: '/contact' },
];

export default function Footer() {
  return (
    <>
      <section className="max-w-md mx-auto px-4 mt-8">
        <div className="grid grid-cols-3 gap-2 text-center">
          {TRUST_BADGES.map(({ icon: Icon, label }) => (
            <div key={label} className="bg-white rounded-xl border border-black/10 py-3 px-1.5">
              <Icon className="w-5 h-5 mx-auto mb-1.5 text-[#0F6A5F]" aria-hidden="true" />
              <p className="text-[10px] font-medium leading-snug">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="max-w-md mx-auto px-4 mt-8 pt-6 border-t border-black/10">
        <div className="flex items-center gap-1.5 mb-4">
          <ShieldCheck className="w-4 h-4 text-[#0F6A5F]" aria-hidden="true" />
          <span className="text-xs font-semibold">Shop with confidence</span>
        </div>
        <div className="grid grid-cols-2 gap-y-2.5 text-xs text-black/60">
          {POLICY_LINKS.map(({ label, href }) => (
            <a key={href} href={href} className="hover:text-[#14140F]">
              {label}
            </a>
          ))}
        </div>
        <p className="mt-6 text-[10px] text-black/40">
          &copy; {new Date().getFullYear()} PrimeHub Deals. All rights reserved.
        </p>
      </footer>
    </>
  );
}
