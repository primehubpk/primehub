import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Clock3, ShoppingBag, Sparkles } from 'lucide-react';
import { getStorefrontSettingsSnapshot } from '@/lib/publicCatalogServer';
import { normalizeImageUrl } from '@/lib/imageUrl';

export const dynamic = 'force-dynamic';

type BigDeal = {
  productId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  title?: string;
  originalPrice?: number | string;
  dealPrice?: number | string;
  endAt?: string;
  buttonLink?: string;
  active?: boolean;
};

function resolveDealImage(deal?: BigDeal) {
  if (!deal) return '';
  const images = Array.isArray(deal.imageUrls) ? deal.imageUrls.filter(Boolean) : [];
  if (!images.length) return normalizeImageUrl(deal.imageUrl || '');
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', weekday: 'long' })
    .format(new Date())
    .toLowerCase();
  const index = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weekday);
  return normalizeImageUrl(images[index >= 0 ? index % images.length : 0] || deal.imageUrl || images[0]);
}

function countdownEnd(endAt?: string) {
  const end = endAt ? new Date(endAt).getTime() : 0;
  if (end > Date.now()) return new Date(end).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
  return 'When configured in Admin';
}

export default async function BigDealPage() {
  const settings = await getStorefrontSettingsSnapshot() as { dailyDeal?: BigDeal };
  const deal = settings.dailyDeal;
  const originalPrice = Number(deal?.originalPrice || 0);
  const dealPrice = Number(deal?.dealPrice || 0);
  const discount = originalPrice > dealPrice && dealPrice > 0
    ? Math.round(((originalPrice - dealPrice) / originalPrice) * 100)
    : 0;
  const imageUrl = resolveDealImage(deal);
  const productHref = deal?.productId ? `/product/${deal.productId}` : '/shop';

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-28">
      <div className="mx-auto max-w-5xl px-4 py-5 md:px-6">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[10px] font-black shadow-sm">
          <ArrowLeft size={14}/> Back to Home
        </Link>

        {!deal?.active || !deal.title ? (
          <section className="mt-5 rounded-[30px] bg-white p-10 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-[#FFB020]"/>
            <h1 className="mt-4 text-2xl font-black">Big Deal is not active</h1>
            <p className="mt-1 text-xs text-black/45">The admin can publish the next Big Deal from Admin → Settings.</p>
          </section>
        ) : (
          <>
            <header className="mt-5 rounded-[30px] bg-[#14140F] p-6 text-white md:p-8">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#FFB020]">PrimeHub Spotlight</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">Big Deal</h1>
              <p className="mt-2 text-sm text-white/55">One featured offer, managed separately from Sunday–Saturday deals.</p>
            </header>

            <section className="mt-5 overflow-hidden rounded-[30px] bg-white shadow-sm">
              <div className="grid md:grid-cols-2">
                <div className="relative aspect-square bg-[#F4F4F1] md:aspect-auto md:min-h-[520px]">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={deal.title}
                      fill
                      priority
                      fetchPriority="high"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      quality={78}
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm font-bold text-black/25">No Big Deal image</div>
                  )}
                  <div className="absolute left-4 top-4 flex gap-2">
                    <span className="rounded-full bg-[#E1352B] px-3 py-1.5 text-[9px] font-black text-white">BIG DEAL</span>
                    {discount > 0 && <span className="rounded-full bg-[#FFB020] px-3 py-1.5 text-[9px] font-black">-{discount}% OFF</span>}
                  </div>
                </div>

                <div className="flex flex-col justify-center p-6 md:p-10">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">Limited time offer</p>
                  <h2 className="mt-2 text-3xl font-black md:text-4xl">{deal.title}</h2>
                  <div className="mt-6 flex items-end gap-3">
                    <span className="font-[family-name:var(--font-mono)] text-3xl font-black text-[#E1352B]">Rs. {dealPrice.toLocaleString()}</span>
                    {originalPrice > dealPrice && <span className="pb-1 text-sm text-black/35 line-through">Rs. {originalPrice.toLocaleString()}</span>}
                  </div>
                  <div className="mt-5 rounded-2xl bg-[#F4F4F1] p-4 text-xs">
                    <div className="flex items-center gap-2 font-bold"><Clock3 size={16}/> Offer ends</div>
                    <p className="mt-1 text-black/45">{countdownEnd(deal.endAt)}</p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Link href={deal.buttonLink || productHref} className="inline-flex items-center gap-2 rounded-xl bg-[#14140F] px-5 py-3 text-xs font-black text-white">
                      <ShoppingBag size={15}/> Shop Big Deal
                    </Link>
                    <Link href={productHref} className="inline-flex rounded-xl border border-black/10 px-5 py-3 text-xs font-black">View Product</Link>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
