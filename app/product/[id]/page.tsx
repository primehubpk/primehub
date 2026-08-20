'use client';

import Link from 'next/link';
import { ArrowLeft, Heart, ShoppingBag } from 'lucide-react';
import RecentlyViewed from '@/components/RecentlyViewed';
import ReviewsSection from '@/components/ReviewsSection';
import MobileLiveDealBanner from '@/components/MobileLiveDealBanner';
import WeeklyDealCalendar from '@/components/WeeklyDealCalendar';
import { useProductDetail } from '@/components/product-detail/useProductDetail';
import ProductHero from '@/components/product-detail/ProductHero';
import ProductDealBanner from '@/components/product-detail/ProductDealBanner';
import ProductPricing from '@/components/product-detail/ProductPricing';
import ProductPurchasePanel from '@/components/product-detail/ProductPurchasePanel';
import ProductVideoModal from '@/components/product-detail/ProductVideoModal';
import DealConfetti from '@/components/product-detail/DealConfetti';

export default function ProductDetailPage() {
  const model = useProductDetail();
  const { product, weeklyProducts, loading, failed, activeImage, quantity, wished, videoOpen, added, nowTick, images, regularPrice, productOriginal, stock, rating, reviews, weeklyDeals, currentDeal, timing, liveDeal, dealPrice, normalForDeal, savingsAmount, countdown, currentPrice, maxQuantity, stockProgress, bannerCountdown, setActiveImage, setQuantity, setWished, setVideoOpen, addProduct, orderNow, buyWhatsApp } = model;

  if (loading) return <main className="min-h-screen bg-[#F4F4F1] px-4 pb-28 pt-4"><div className="mx-auto max-w-6xl"><div className="mb-4 h-10 w-10 animate-pulse rounded-full bg-black/8" /><div className="grid gap-4 md:grid-cols-[1.05fr_.95fr]"><div className="aspect-square animate-pulse rounded-[30px] bg-white md:aspect-[4/3]" /><div className="rounded-[30px] bg-white p-6"><div className="h-8 w-4/5 animate-pulse rounded bg-black/8" /><div className="mt-5 h-16 w-1/2 animate-pulse rounded bg-black/8" /><div className="mt-5 h-28 animate-pulse rounded-2xl bg-black/8" /></div></div></div></main>;

  if (failed || !product) return <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-5"><div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5"><ShoppingBag size={22} className="text-black/35" /></div><h1 className="mt-4 text-lg font-black">Product not found</h1><p className="mt-1 text-xs leading-5 text-black/45">This deal may have been removed or is no longer available.</p><Link href="/" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-[10px] font-black text-white">Back to Deals</Link></div></main>;

  return <main className="min-h-screen bg-[#F4F4F1] pb-28">
    <DealConfetti liveDeal={liveDeal} />
    <div className="mx-auto max-w-6xl">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#F4F4F1]/92 px-3 py-3 backdrop-blur md:px-5"><Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" aria-label="Back to home"><ArrowLeft size={17} /></Link><span className="text-[10px] font-black uppercase tracking-[0.24em] text-black/40">PrimeHub Product</span><button type="button" onClick={() => setWished((value) => !value)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}><Heart size={17} className={wished ? 'text-[#E1352B]' : 'text-[#14140F]'} fill={wished ? 'currentColor' : 'none'} /></button></header>
      <MobileLiveDealBanner live={liveDeal} countdown={countdown} />
      <div className="grid gap-5 px-3 md:grid-cols-[1.04fr_.96fr] md:px-5 md:pt-3">
        <ProductHero product={product} images={images} activeImage={activeImage} savingsAmount={savingsAmount} liveDeal={liveDeal} onImageChange={(updater) => setActiveImage(updater)} onVideoOpen={() => setVideoOpen(true)} />
        <section className="rounded-[30px] border border-black/7 bg-white p-4 shadow-sm sm:p-6 md:p-7">
          <ProductDealBanner currentDeal={currentDeal} liveDeal={liveDeal} bannerCountdown={bannerCountdown} timing={timing} nowTick={nowTick} />
          <ProductPricing product={product} rating={rating} reviews={reviews} currentDeal={currentDeal} liveDeal={liveDeal} dealPrice={dealPrice} regularPrice={regularPrice} productOriginal={productOriginal} normalForDeal={normalForDeal} savingsAmount={savingsAmount} stock={stock} stockProgress={stockProgress} />
          <ProductPurchasePanel quantity={quantity} maxQuantity={maxQuantity} stock={stock} currentPrice={currentPrice} liveDeal={liveDeal} added={added} onQuantityChange={setQuantity} onOrderNow={orderNow} onAddProduct={addProduct} onWhatsApp={buyWhatsApp} />
        </section>
      </div>
    </div>
    <WeeklyDealCalendar weeklyDeals={weeklyDeals} weeklyProducts={weeklyProducts} nowTick={nowTick} />
    <RecentlyViewed excludeId={product.id} />
    <ReviewsSection productId={product.id} />
    <ProductVideoModal product={product} open={videoOpen} onClose={() => setVideoOpen(false)} />
  </main>;
}
