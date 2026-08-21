// components/Footer.tsx
// Premium storefront footer with live contact/policy settings.
'use client';

import Link from 'next/link';
import { Wallet, Truck, RotateCcw, HeartHandshake, MapPin, Globe2, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { useSettings } from '@/lib/useSettings';

const MAP_HREF = 'https://www.google.com/maps/search/?api=1&query=Prime+Hub+Sabir+Bangles+Store+Shop+217+Street+7+Gulistan+Colony+Mustafabad+Dharampura+Lahore';
const FALLBACK_ADDRESS = 'Shop No. 217, Street No. 7, Gulistan Colony, Mustafabad, Dharampura, Lahore';
const ADDRESS_DETAIL = 'Prime Hub (Sabir Bangles Store) · Near Aftab Masjid, School Road';

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
  { label: 'My Account', href: '/account' },
];

const HELP_LINKS = [
  { label: 'My Orders', href: '/orders' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Return Policy', href: '/return-policy' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
];

function normalizeWhatsApp(value: string) {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return digits;
}

function WhatsAppIcon() {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/20">
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.96L.06 24l6.28-1.65a11.93 11.93 0 0 0 5.72 1.46h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.16-3.45-8.43ZM12.07 21.8h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.73.98.99-3.64-.23-.37a9.87 9.87 0 0 1-1.51-5.28C2.17 6.45 6.6 2.02 12.07 2.02c2.65 0 5.14 1.03 7.01 2.9a9.85 9.85 0 0 1 2.9 7.02c0 5.47-4.43 9.9-9.91 9.9Zm5.43-7.42c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.46-.88-.78-1.48-1.74-1.66-2.04-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.68-1.64-.93-2.25-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.09 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.07-.12-.27-.2-.57-.35Z" />
      </svg>
    </span>
  );
}

export default function Footer({ onWholesaleSelect }: { onWholesaleSelect?: () => void }) {
  const { contact } = useSettings();
  const whatsapp = normalizeWhatsApp(contact?.whatsappNumber || '');
  const whatsappHref = whatsapp ? `https://wa.me/${whatsapp}` : '/contact';
  const displayWhatsApp = contact?.whatsappNumber?.trim() || 'WhatsApp support available';
  const address = contact?.physicalAddress?.trim() || FALLBACK_ADDRESS;

  const handleWholesaleClick = () => {
    const wholesaleCard = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.toLowerCase().includes('wholesale deals'),
    );
    const wholesaleAlreadyActive = wholesaleCard?.className.includes('bg-[#14140F]');

    if (onWholesaleSelect && !wholesaleAlreadyActive) {
      onWholesaleSelect();
    }

    window.setTimeout(() => {
      const productGrid = Array.from(document.querySelectorAll('section')).find((section) =>
        section.querySelector('h2')?.textContent?.trim().includes('Discover deals'),
      );
      productGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  return (
    <div className="mt-10 border-t border-white/10 bg-white">
      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Shop with confidence</p>
          <h2 className="mt-1 text-base font-black tracking-tight text-[#14140F]">Why PrimeHub?</h2>
        </div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {TRUST_BADGES.map(({ icon: Icon, label, text }) => (
            <div key={label} className="rounded-[20px] border border-black/6 bg-[#F8F7F3] p-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#0F6A5F] shadow-sm"><Icon className="h-4.5 w-4.5" aria-hidden="true" /></span>
              <p className="mt-2.5 text-[10px] font-black text-[#14140F]">{label}</p>
              <p className="mt-1 text-[9px] leading-4 text-black/45">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#14140F] text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_0.9fr_1.35fr]">
            <div>
              <div className="text-3xl font-black tracking-[-0.07em]">ph<span className="text-[#E1352B]">deals</span></div>
              <div className="mt-1 text-[7px] font-black tracking-[0.35em] text-[#FFB020]">PRIME HUB</div>
              <p className="mt-3 max-w-xs text-[11px] leading-5 text-white/55">Premium everyday deals from Prime Hub, with worldwide delivery and wholesale deals available.</p>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFB020]">Shop</h3>
              <div className="mt-3 grid gap-2.5">{SHOP_LINKS.map(({ label, href }) => <Link key={label} href={href} className="text-[11px] text-white/60 transition hover:text-white">{label}</Link>)}</div>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFB020]">Help</h3>
              <div className="mt-3 grid gap-2.5">{HELP_LINKS.map(({ label, href }) => <Link key={label} href={href} className="text-[11px] text-white/60 transition hover:text-white">{label}</Link>)}</div>
            </div>

            <div className="space-y-2.5">
              <a href={whatsappHref} target={whatsapp ? '_blank' : undefined} rel={whatsapp ? 'noreferrer' : undefined} className="group flex min-h-[72px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-3.5 backdrop-blur-md transition hover:border-[#25D366]/40 hover:bg-white/10">
                <WhatsAppIcon />
                <span className="min-w-0 flex-1">
                  <b className="block text-[10px] uppercase tracking-[0.14em] text-[#25D366]">Official Support</b>
                  <span className="mt-1 block truncate text-[11px] font-semibold text-white">{displayWhatsApp}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-white/40 transition group-hover:text-white" />
              </a>

              <a href={MAP_HREF} target="_blank" rel="noreferrer" className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB020]" />
                <span><b className="block text-[10px] text-white">Our location</b><span className="text-[9px] leading-4 text-white/45">{address}<br />{ADDRESS_DETAIL}</span></span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <Link href="/contact" className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-[9px] font-black text-white/70 transition hover:bg-white/10"><Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB020]" /><span>Global Shipping Available.<span className="mt-1 block font-normal leading-4 text-white/45">We deliver our premium bangles worldwide with secure packaging.</span></span></Link>
                <button type="button" onClick={handleWholesaleClick} className="flex min-h-[72px] items-center gap-2 rounded-2xl border border-yellow-600/30 bg-white/5 p-3.5 text-left text-[9px] font-black text-[#FFB020] backdrop-blur-md transition hover:bg-white/[0.08] hover:border-yellow-600/40"><ShoppingBag size={14} /> Wholesale Deals <ArrowUpRight size={11} /></button>
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-2 border-t border-white/10 pt-4 text-[9px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} PrimeHub Deals. All rights reserved.</span>
            <span>Prime Hub · Sabir Bangles Store · Lahore</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
