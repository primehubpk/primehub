'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  User,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useCartStore } from '@/lib/cartStore';

type Customer = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes: string;
};

function titleOf(item: any) {
  return item.title || item.name || 'Product';
}
function priceOf(item: any) {
  return Number(item.price || 0);
}
function imageOf(item: any) {
  return item.imageUrl || item.image || item.images?.[0] || '';
}

export default function CheckoutPage() {
  const items = useCartStore((state: any) => state.items || state.cart || []);
  const clearCart = useCartStore((state: any) => state.clearCart);

  const [customer, setCustomer] = useState<Customer>({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    notes: '',
  });
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState('');

  const totalItems = useMemo(
    () =>
      items.reduce(
        (sum: number, item: any) => sum + Number(item.quantity || item.qty || 1),
        0
      ),
    [items]
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum: number, item: any) =>
          sum + priceOf(item) * Number(item.quantity || item.qty || 1),
        0
      ),
    [items]
  );

  const update = (key: keyof Customer, value: string) =>
    setCustomer((prev) => ({ ...prev, [key]: value }));

  const placeOrder = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!items.length) {
      setError('Your cart is empty. Please add a product first.');
      return;
    }

    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim() || !customer.city.trim()) {
      setError('Please fill your name, phone, address and city.');
      return;
    }

    setPlacing(true);

    try {
      const order = {
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          email: customer.email.trim(),
          address: customer.address.trim(),
          city: customer.city.trim(),
          notes: customer.notes.trim(),
        },
        items: items.map((item: any) => ({
          productId: item.id || item.productId || '',
          title: titleOf(item),
          price: priceOf(item),
          quantity: Number(item.quantity || item.qty || 1),
          image: imageOf(item),
        })),
        totalItems,
        subtotal,
        total: subtotal,
        currency: 'PKR',
        status: 'pending',
        source: 'website',
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, 'orders'), order);
      setOrderId(ref.id);
      clearCart();
    } catch (err) {
      console.error(err);
      setError(
        'Order save nahi ho saka. Please try again or use WhatsApp ordering.'
      );
    } finally {
      setPlacing(false);
    }
  };

  const whatsappOrder = () => {
    const lines = items.map((item: any, index: number) => {
      const qty = Number(item.quantity || item.qty || 1);
      return `${index + 1}. ${titleOf(item)} × ${qty} — Rs. ${(priceOf(item) * qty).toLocaleString()}`;
    });

    const text = [
      '🛍️ PrimeHub Deals Order',
      '',
      ...lines,
      '',
      `Customer: ${customer.name || '-'}`,
      `Phone: ${customer.phone || '-'}`,
      `City: ${customer.city || '-'}`,
      `Address: ${customer.address || '-'}`,
      `Total: Rs. ${subtotal.toLocaleString()}`,
    ].join('\n');

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  if (orderId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-4">
        <div className="w-full max-w-md rounded-[30px] bg-white p-7 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0F6A5F]/10 text-[#0F6A5F]">
            <CheckCircle2 size={30} />
          </div>
          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.25em] text-[#0F6A5F]">
            Order received
          </p>
          <h1 className="mt-2 text-2xl font-black">Thank you! 🎉</h1>
          <p className="mt-2 text-xs leading-5 text-black/45">
            Your order has been saved. Our team will contact you to confirm the
            delivery details.
          </p>

          <div className="mt-5 rounded-2xl bg-[#F4F4F1] p-4 text-left">
            <p className="text-[9px] font-black uppercase tracking-wider text-black/35">
              Order ID
            </p>
            <p className="mt-1 break-all font-[family-name:var(--font-mono)] text-xs font-black">
              {orderId}
            </p>
          </div>

          <Link
            href="/"
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F4F1] px-4">
        <div className="w-full max-w-md rounded-[30px] bg-white p-7 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4F4F1]">
            <ShoppingBag size={22} className="text-black/30" />
          </div>
          <h1 className="mt-4 text-lg font-black">Your cart is empty</h1>
          <p className="mt-1 text-xs text-black/40">
            Add a deal before heading to checkout.
          </p>
          <Link
            href="/shop"
            className="mt-5 inline-flex rounded-full bg-[#14140F] px-5 py-3 text-[10px] font-black text-white"
          >
            Browse Deals
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F4F1] pb-12">
      <div className="mx-auto max-w-5xl px-4 py-5 md:px-6">
        <Link
          href="/shop"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          aria-label="Back to shop"
        >
          <ArrowLeft size={17} />
        </Link>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_360px]">
          <form
            onSubmit={placeOrder}
            className="rounded-[28px] bg-white p-5 shadow-sm md:p-7"
          >
            <p className="text-[9px] font-black uppercase tracking-[0.23em] text-[#E1352B]">
              Checkout
            </p>
            <h1 className="mt-1 text-2xl font-black">Where should we deliver?</h1>
            <p className="mt-1 text-xs leading-5 text-black/40">
              Enter your details. Our team can contact you to confirm the order.
            </p>

            {error && (
              <div className="mt-4 rounded-2xl bg-[#E1352B]/10 p-3 text-xs font-bold text-[#E1352B]">
                {error}
              </div>
            )}

            <div className="mt-6 grid gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">
                  Full Name *
                </span>
                <div className="flex items-center gap-2 rounded-2xl bg-[#F4F4F1] px-3">
                  <User size={15} className="text-black/30" />
                  <input
                    required
                    value={customer.name}
                    onChange={(e) => update('name', e.target.value)}
                    className="w-full bg-transparent py-3.5 text-xs font-bold outline-none"
                    placeholder="Your name"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">
                  Phone / WhatsApp *
                </span>
                <div className="flex items-center gap-2 rounded-2xl bg-[#F4F4F1] px-3">
                  <Phone size={15} className="text-black/30" />
                  <input
                    required
                    type="tel"
                    value={customer.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    className="w-full bg-transparent py-3.5 text-xs font-bold outline-none"
                    placeholder="+92 3XX XXXXXXX"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">
                  Email (optional)
                </span>
                <input
                  type="email"
                  value={customer.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="w-full rounded-2xl bg-[#F4F4F1] px-3 py-3.5 text-xs font-bold outline-none"
                  placeholder="you@example.com"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">
                    City *
                  </span>
                  <div className="flex items-center gap-2 rounded-2xl bg-[#F4F4F1] px-3">
                    <MapPin size={15} className="text-black/30" />
                    <input
                      required
                      value={customer.city}
                      onChange={(e) => update('city', e.target.value)}
                      className="w-full bg-transparent py-3.5 text-xs font-bold outline-none"
                      placeholder="City"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">
                    Address *
                  </span>
                  <input
                    required
                    value={customer.address}
                    onChange={(e) => update('address', e.target.value)}
                    className="w-full rounded-2xl bg-[#F4F4F1] px-3 py-3.5 text-xs font-bold outline-none"
                    placeholder="Full delivery address"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-black/40">
                  Order Notes (optional)
                </span>
                <textarea
                  value={customer.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  className="min-h-24 w-full resize-none rounded-2xl bg-[#F4F4F1] px-3 py-3.5 text-xs font-bold outline-none"
                  placeholder="Any delivery note..."
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={placing}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14140F] py-4 text-xs font-black text-white disabled:opacity-60"
            >
              {placing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {placing ? 'Placing Order...' : 'Place Order'}
            </button>

            <button
              type="button"
              onClick={whatsappOrder}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F6A5F] py-4 text-xs font-black text-white"
            >
              <MessageCircle size={16} />
              Order via WhatsApp Instead
            </button>
          </form>

          <aside className="h-fit rounded-[28px] bg-white p-5 shadow-sm md:sticky md:top-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Your Order</h2>
              <span className="text-[10px] font-black text-black/35">
                {totalItems} items
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {items.map((item: any, index: number) => {
                const qty = Number(item.quantity || item.qty || 1);
                return (
                  <div key={`${item.id || item.productId || index}`} className="flex gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F4F4F1]">
                      {imageOf(item) && (
                        <img
                          src={imageOf(item)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[10px] font-black">
                        {titleOf(item)}
                      </p>
                      <p className="mt-1 text-[9px] font-bold text-black/40">
                        Qty {qty}
                      </p>
                    </div>
                    <p className="font-[family-name:var(--font-mono)] text-[10px] font-black">
                      Rs. {(priceOf(item) * qty).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="my-4 h-px bg-black/8" />

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black/45">Subtotal</span>
              <span className="font-[family-name:var(--font-mono)] text-xl font-black">
                Rs. {subtotal.toLocaleString()}
              </span>
            </div>

            <p className="mt-3 rounded-2xl bg-[#0F6A5F]/8 p-3 text-[9px] font-bold leading-4 text-[#0F6A5F]">
              🚚 Free delivery eligibility is calculated from the cart item count.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
