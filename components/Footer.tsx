// components/Footer.tsx
// Soft Modern trust section + footer. Uses real PrimeHub business details.
import Link from 'next/link';
import { Wallet, Truck, RotateCcw, HeartHandshake, MessageCircle, MapPin, Globe2, ShoppingBag, ArrowUpRight } from 'lucide-react';

const WHATSAPP = '923035985676';
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP}`;
const ADDRESS = 'Shop No. 217, Street No. 7, Gulistan Colony, Mustafabad, Dharampura, Lahore';
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

export default function Footer() {
  return (
    <div className="mt-10 border-t border-black/6 bg-white">
      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Shop with confidence</p>
            <h2 className="mt-1 text-base font-black tracking-tight text-[#14140F]">Why PrimeHub?</h2>
          </div>
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

      <footer className="bg-[#14140F] text-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_0.9fr_1.35fr]">
            <div>
              <div className="text-3xl font-black tracking-[-0.07em]">ph<span className="text-[#E1352B]">deals</span></div>
              <div className="mt-1 text-[7px] font-black tracking-[0.35em] text-[#FFB020]">PRIME HUB</div>
              <p className="mt-3 max-w-xs text-[11px] leading-5 text-white/55">Premium everyday deals from Prime Hub, with worldwide delivery and wholesale deals available.</p>
              <a href={WHATSAPP_HREF} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black text-[#14140F] transition hover:bg-[#FFB020]">
                <MessageCircle size={14} /> WhatsApp · 03035958676 <ArrowUpRight size={12} />
              </a>
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
              <a href={WHATSAPP_HREF} target="_blank" rel="noreferrer" className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#25D366]" />
                <span><b className="block text-[10px] text-white">Need help?</b><span className="text-[9px] text-white/45">WhatsApp 03035958676</span></span>
              </a>
              <div className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB020]" />
                <span><b className="block text-[10px] text-white">Our location</b><span className="text-[9px] leading-4 text-white/45">{ADDRESS}<br />{ADDRESS_DETAIL}</span></span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/contact" className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-[9px] font-black text-white/70 transition hover:bg-white/10"><Globe2 size={14} /> Worldwide delivery</Link>
                <a href={WHATSAPP_HREF} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-[9px] font-black text-white/70 transition hover:bg-white/10"><ShoppingBag size={14} /> Wholesale deals</a>
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
