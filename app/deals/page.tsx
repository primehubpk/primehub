'use client';
import DealsHeader from '@/components/deals/DealsHeader';
import DealGrid from '@/components/deals/DealGrid';
import useDeals from '@/components/deals/useDeals';
export default function DealsPage(){const {loading,today,products,weeklyDeals,addingId,addToCart}=useDeals();return <main className="min-h-screen bg-neutral-50 pb-28"><div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7"><DealsHeader/>{loading ? <div className="mt-5 h-28 animate-pulse rounded-[30px] bg-black/5"/> : <DealGrid weeklyDeals={weeklyDeals} products={products} today={today} addingId={addingId} onAdd={addToCart}/>}</div></main>}
