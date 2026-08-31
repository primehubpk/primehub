import { Suspense } from 'react';
import NewArrivalsCatalog from './NewArrivalsCatalog';
export default function NewArrivalsPage(){return <Suspense fallback={<main className="min-h-screen bg-[#F4F4F1] p-6 font-black">Loading new arrivals...</main>}><NewArrivalsCatalog/></Suspense>}