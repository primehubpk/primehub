import Link from 'next/link';

export default function OrdersPage() {
  return <main className="min-h-screen bg-[#F4F4F1] px-4 py-10 pb-28"><div className="mx-auto max-w-md rounded-3xl bg-white p-7 text-center shadow-sm"><h1 className="text-2xl font-black">Your Orders</h1><p className="mt-2 text-xs leading-5 text-black/45">Orders are confirmed by our team after checkout. For order status, please contact PrimeHub Deals with your order ID.</p><Link href="/shop" className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-xs font-black text-white">Continue Shopping</Link></div></main>;
}
