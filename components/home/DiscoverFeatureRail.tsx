import Link from 'next/link';
import { ArrowRight, Crown, Gift, PackageSearch, ShieldCheck, Sparkles, Store, Tags, WalletCards } from 'lucide-react';

export function ShopFeatureBanner() {
  return <section className="col-span-full my-3 overflow-hidden rounded-[26px] bg-gradient-to-r from-[#14140F] via-[#24352F] to-[#0F6A5F] text-white shadow-[0_16px_40px_rgba(20,20,15,0.14)]">
    <Link href="/shop" className="group grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_auto] md:items-center">
      <div className="flex items-start gap-3 sm:items-center"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#FFCF68]"><Store size={23}/></div><div><p className="text-[8px] font-black uppercase tracking-[.2em] text-[#FFCF68]">PrimeHub Shop</p><h3 className="mt-1 text-lg font-black sm:text-xl">Explore the complete collection</h3><p className="mt-1 text-[10px] leading-4 text-white/60">All products, categories and latest deals in one place.</p></div></div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:justify-end md:overflow-visible md:pb-0"><FeaturePill icon={<PackageSearch size={12}/>} label="All Products"/><FeaturePill icon={<Tags size={12}/>} label="Categories"/><FeaturePill icon={<Sparkles size={12}/>} label="New Arrivals"/><span className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#14140F] transition group-hover:translate-x-1"><ArrowRight size={17}/></span></div>
    </Link>
  </section>;
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[9px] font-black text-white/80">{icon}{label}</span>;
}

type FeatureConfig = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  benefits: Array<{ icon: React.ReactNode; label: string }>;
  action: string;
  icon: React.ReactNode;
  theme: string;
};

const RESELLER_FEATURE: FeatureConfig = {
  href: '/reseller',
  eyebrow: 'PrimeHub Exclusive',
  title: 'Prime Reseller Club',
  description: 'Buy more, save more and build your reseller income with PrimeHub.',
  benefits: [
    { icon: <WalletCards size={12}/>, label: 'Earn reseller cash' },
    { icon: <Gift size={12}/>, label: 'Monthly gifts & rewards' },
    { icon: <ShieldCheck size={12}/>, label: 'Special member benefits' },
  ],
  action: 'Join Reseller Club',
  icon: <Crown size={23}/>,
  theme: 'bg-gradient-to-br from-[#14140F] via-[#173C36] to-[#0B4F47] text-white',
};

// Keep this list ready for future PrimeHub home features that should appear beside Reseller Club.
const COMPANION_FEATURES: FeatureConfig[] = [];

export function MemberFeatureRail() {
  const features = [RESELLER_FEATURE, ...COMPANION_FEATURES];

  return <section className="col-span-full my-3"><div className="mb-2 flex items-center justify-between px-1"><div><p className="text-[8px] font-black uppercase tracking-[.2em] text-[#0F6A5F]">More from PrimeHub</p><h3 className="mt-0.5 text-base font-black">Unlock more ways to shop</h3></div>{features.length > 1 ? <span className="text-[8px] font-bold text-black/35 sm:hidden">Swipe →</span> : null}</div><div className={features.length > 1 ? "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-[1.35fr_.65fr] md:overflow-visible" : "grid gap-3"}>{features.map(feature => <FeatureCard key={feature.href} feature={feature}/>)}</div></section>;
}

function FeatureCard({ feature }: { feature: FeatureConfig }) {
  return <Link href={feature.href} className={`group relative min-h-[188px] w-full shrink-0 snap-start overflow-hidden rounded-[24px] p-4 shadow-[0_14px_34px_rgba(20,20,15,0.10)] sm:min-h-[198px] sm:p-5 md:w-auto ${feature.theme}`}><div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl"/><div className="relative flex h-full flex-col"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 sm:h-11 sm:w-11">{feature.icon}</div><span className="rounded-full bg-white/15 px-2.5 py-1 text-[7px] font-black uppercase tracking-wider">Featured</span></div><p className="mt-3 text-[8px] font-black uppercase tracking-[.2em] opacity-60 sm:mt-4">{feature.eyebrow}</p><h4 className="mt-1 text-lg font-black sm:text-xl">{feature.title}</h4><p className="mt-1 max-w-xl text-[10px] leading-4 opacity-65">{feature.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{feature.benefits.map(benefit => <span key={benefit.label} className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1.5 text-[8px] font-black">{benefit.icon}{benefit.label}</span>)}</div><div className="mt-auto flex items-center justify-between pt-4 text-[10px] font-black"><span>{feature.action}</span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#14140F] transition group-hover:translate-x-1"><ArrowRight size={15}/></span></div></div></Link>;
}
