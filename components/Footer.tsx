// components/Footer.tsx
// Premium trust section + responsive footer. No admin/settings changes.

import Link from 'next/link';
import { Wallet, Truck, RotateCcw, ShieldCheck, HeartHandshake, MessageCircle } from 'lucide-react';

const TRUST_BADGES = [
  { icon: Wallet, label: 'Cash on Delivery', text: 'Pay when your order arrives' },
  { icon: Truck, label: 'Fast Delivery', text: 'Reliable delivery to your door' },
  { icon: RotateCcw, label: '7-Day Returns', text: 'Simple returns for eligible items' },
  { icon: HeartHandshake, label: 'Shop with Confidence', text: 'Customer-first support' },
];

const SHOP_LINKS = [
  { label: 'All Products', href: '/shop' },
  { label: 'Categories', href: '/shop' },
  { label: 'Offers', href: '/shop?offers=1' },
  { label: 'Wishlist', href: '/shop?wishlist=1' },
];

const HELP_LINKS = [
  { label: 'My Account', href: '/account' },
  { label: 'My Orders', href: '/orders' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Return Policy', href: '/return-policy' },
];

const POLICY_LINKS = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms' },
];

export default function Footer() {
  return (
    <div className="mt-12 border-t border-black/8 bg-white">
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TRUST_BADGES.map(({ icon: Icon, label, text }) => (
            <div key={label} className="group rounded-[22px] border border-black/8 bg-[#F8F7F3] p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(20,20,15,0.08)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#0F6A5F] shadow-sm"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <p className="mt-3 text-[11px] font-black text-[#14140F]">{label}</p>
              <p className="mt-1 text-[10px] leading-4 text-black/45">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#14140F] text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <div className="text-3xl font-black tracking-[-0.07em]">ph<span className="text-[#E1352B]">deals</span></div>
              <div className="mt-1 text-[7px] font-black tracking-[0.35em] text-[#FFB020]">PRIME HUB</div>
              <p className="mt-4 max-w-xs text-xs leading-5 text-white/55">Discover everyday products, handpicked deals and a simple shopping experience built for PrimeHub customers.</p>
              <Link href="/contact" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black text-[#14140F] transition hover:bg-[#FFB020]"><MessageCircle size={14} />Need help?</Link>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFB020]">Shop</h3>
              <div className="mt-4 grid gap-3">{SHOP_LINKS.map(({ label, href }) => <Link key={label} href={href} className="text-xs text-white/60 transition hover:text-white">{label}</Link>)}</div>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFB020]">Customer</h3>
              <div className="mt-4 grid gap-3">{HELP_LINKS.map(({ label, href }) => <Link key={label} href={href} className="text-xs text-white/60 transition hover:text-white">{label}</Link>)}</div>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFB020]">Policies</h3>
              <div className="mt-4 grid gap-3">{POLICY_LINKS.map(({ label, href }) => <Link key={label} href={href} className="text-xs text-white/60 transition hover:text-white">{label}</Link>)}</div>
              <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-white/45"><ShieldCheck size={14} />Secure &amp; trusted shopping</div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-5 text-[9px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} PrimeHub Deals. All rights reserved.</span>
            <span>Built for a better shopping experience.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
