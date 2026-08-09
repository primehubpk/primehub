'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import {
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  PackageCheck,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import { db } from '@/lib/firebase';

type Order = {
  id: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    notes?: string;
  };
  items?: Array<{
    productId?: string;
    title?: string;
    price?: number;
    quantity?: number;
    image?: string;
  }>;
  total?: number;
  subtotal?: number;
  totalItems?: number;
  status?: string;
  createdAt?: any;
  [key: string]: any;
};

const STATUSES = [
  ['pending', 'New Orders'],
  ['confirmed', 'Confirmed'],
  ['shipped', 'Shipped'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
] as const;

function customerOf(order: Order) {
  return order.customer || {};
}

function money(value: unknown) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

function dateOf(value: any) {
  if (!value) return '—';
  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function statusLabel(status: string) {
  return status === 'pending'
    ? 'New'
    : status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AdminOrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
    } catch {
      // Fallback for old orders without a sortable timestamp.
      const snap = await getDocs(collection(db, 'orders'));
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      const customer = customerOf(order);
      const haystack = [
        order.id,
        customer.name,
        customer.phone,
        customer.city,
        customer.email,
      ]
        .join(' ')
        .toLowerCase();

      return (
        (!q || haystack.includes(q)) &&
        (status === 'all' || String(order.status || 'pending') === status)
      );
    });
  }, [orders, search, status]);

  const counts = useMemo(() => {
    const base: Record<string, number> = {
      all: orders.length,
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    orders.forEach((order) => {
      const s = String(order.status || 'pending');
      base[s] = (base[s] || 0) + 1;
    });
    return base;
  }, [orders]);

  const changeStatus = async (order: Order, next: string) => {
    setSavingId(order.id);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: next,
        updatedAt: new Date(),
      });
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, status: next } : item
        )
      );
      setSelected((current) =>
        current?.id === order.id ? { ...current, status: next } : current
      );
    } finally {
      setSavingId('');
    }
  };

  const whatsapp = (order: Order) => {
    const customer = customerOf(order);
    const items = (order.items || []).map(
      (item, i) =>
        `${i + 1}. ${item.title || 'Product'} × ${item.quantity || 1} — ${money(
          Number(item.price || 0) * Number(item.quantity || 1)
        )}`
    );

    const text = [
      'PrimeHub Deals — Order Update',
      `Order: ${order.id}`,
      '',
      ...items,
      '',
      `Total: ${money(order.total ?? order.subtotal)}`,
      `Customer: ${customer.name || '-'}`,
      `Phone: ${customer.phone || '-'}`,
    ].join('\n');

    const phone = String(customer.phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="rounded-[28px] bg-[#F4F4F1] p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#E1352B]">
            Order Command Center
          </p>
          <h2 className="mt-1 text-2xl font-black">Orders</h2>
          <p className="mt-1 text-xs text-black/40">
            Manage, track and contact every customer from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-2xl bg-[#14140F] px-4 py-3 text-[10px] font-black text-white"
        >
          Refresh Orders
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-5">
        {STATUSES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-2xl p-3 text-left ${
              status === value ? 'bg-[#14140F] text-white' : 'bg-white'
            }`}
          >
            <p className="text-[8px] font-black uppercase tracking-wider opacity-50">
              {label}
            </p>
            <p className="mt-1 text-xl font-black">{counts[value]}</p>
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white px-3">
        <Search size={16} className="text-black/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order ID, name, phone, city..."
          className="w-full bg-transparent py-3.5 text-xs font-bold outline-none"
        />
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center rounded-3xl bg-white p-10">
            <Loader2 className="animate-spin text-black/30" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center text-xs font-bold text-black/35">
            No orders found.
          </div>
        ) : (
          filtered.map((order) => {
            const customer = customerOf(order);
            const currentStatus = String(order.status || 'pending');

            return (
              <article key={order.id} className="rounded-3xl bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <button
                    type="button"
                    onClick={() => setSelected(order)}
                    className="min-w-0 text-left"
                  >
                    <p className="font-[family-name:var(--font-mono)] text-[9px] font-black text-[#E1352B]">
                      #{order.id.slice(0, 10)}
                    </p>
                    <h3 className="mt-1 truncate text-sm font-black">
                      {customer.name || 'Customer'}
                    </h3>
                    <p className="mt-1 text-[9px] text-black/40">
                      {customer.phone || 'No phone'} · {customer.city || 'No city'} ·{' '}
                      {dateOf(order.createdAt)}
                    </p>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#F4F4F1] px-3 py-2 text-[9px] font-black">
                      {money(order.total ?? order.subtotal)}
                    </span>

                    <select
                      value={currentStatus}
                      disabled={savingId === order.id}
                      onChange={(e) => changeStatus(order, e.target.value)}
                      className="rounded-xl border-0 bg-[#14140F] px-3 py-2 text-[9px] font-black text-white outline-none"
                    >
                      {STATUSES.map(([value]) => (
                        <option key={value} value={value}>
                          {statusLabel(value)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => whatsapp(order)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F6A5F] text-white"
                      aria-label="WhatsApp customer"
                    >
                      <MessageCircle size={15} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[200]">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            onClick={() => setSelected(null)}
            aria-label="Close order"
          />
          <aside className="absolute bottom-0 right-0 top-0 w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl md:p-7">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">
                  Order Details
                </p>
                <h2 className="mt-1 text-xl font-black">
                  #{selected.id.slice(0, 10)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F4F4F1]"
              >
                <XCircle size={17} />
              </button>
            </div>

            <div className="mt-5 rounded-3xl bg-[#F4F4F1] p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-black/35">
                Customer
              </p>
              <p className="mt-2 text-sm font-black">
                {customerOf(selected).name || 'Customer'}
              </p>
              <p className="mt-1 text-xs font-bold text-black/55">
                {customerOf(selected).phone || '—'}
              </p>
              {customerOf(selected).email && (
                <p className="mt-1 text-xs text-black/45">
                  {customerOf(selected).email}
                </p>
              )}
              <p className="mt-3 flex gap-2 text-xs leading-5 text-black/55">
                <MapPin size={15} className="mt-0.5 shrink-0" />
                {customerOf(selected).address || '—'}, {customerOf(selected).city || '—'}
              </p>
              {customerOf(selected).notes && (
                <p className="mt-3 rounded-2xl bg-white p-3 text-[10px] leading-4 text-black/55">
                  <b>Note:</b> {customerOf(selected).notes}
                </p>
              )}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black">Items</h3>
                <span className="text-[9px] font-black text-black/35">
                  {selected.totalItems || selected.items?.length || 0} items
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {(selected.items || []).map((item, index) => (
                  <div
                    key={`${item.productId || item.title || index}`}
                    className="flex items-center gap-3 rounded-2xl bg-[#F4F4F1] p-3"
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-xl bg-white">
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[10px] font-black">
                        {item.title || 'Product'}
                      </p>
                      <p className="mt-1 text-[9px] text-black/40">
                        Qty {item.quantity || 1}
                      </p>
                    </div>
                    <p className="font-[family-name:var(--font-mono)] text-[10px] font-black">
                      {money(Number(item.price || 0) * Number(item.quantity || 1))}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-[#14140F] p-5 text-white">
              <p className="text-[9px] font-black uppercase tracking-wider text-white/40">
                Order Total
              </p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-2xl font-black">
                {money(selected.total ?? selected.subtotal)}
              </p>
              <p className="mt-2 text-[9px] text-white/45">
                Placed {dateOf(selected.createdAt)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {STATUSES.map(([value, label]) => {
                const Icon =
                  value === 'pending'
                    ? Clock3
                    : value === 'confirmed'
                      ? Check
                      : value === 'shipped'
                        ? Truck
                        : value === 'delivered'
                          ? PackageCheck
                          : XCircle;

                return (
                  <button
                    key={value}
                    type="button"
                    disabled={savingId === selected.id}
                    onClick={() => changeStatus(selected, value)}
                    className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-[9px] font-black ${
                      String(selected.status || 'pending') === value
                        ? 'bg-[#E1352B] text-white'
                        : 'bg-[#F4F4F1] text-[#14140F]'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => whatsapp(selected)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F6A5F] py-4 text-xs font-black text-white"
            >
              <MessageCircle size={16} />
              WhatsApp Customer
              <ExternalLink size={13} />
            </button>
          </aside>
        </div>
      )}
    </section>
  );
}
