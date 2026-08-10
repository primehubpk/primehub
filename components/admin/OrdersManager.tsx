'use client';

// ==================== ORDER MANAGEMENT ====================
import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { MapPin, MessageCircle, Search, X } from 'lucide-react';
import { adminCollection, type Order, updateAdminDocument } from './shared';

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function normalizedStatus(status?: string): OrderStatus {
  if (status === 'confirmed') return 'processing';
  return ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : 'pending';
}

function addressFor(order: Order) {
  const customer = order.customer || {};
  return [customer.address, customer.city, customer.area, customer.postalCode]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .join(', ');
}

function whatsappUrl(order: Order) {
  const customer = order.customer || {};
  const phone = String(customer.phone || '').replace(/\D/g, '');
  const items = (order.items || []).map((item) => `${item.title || 'Item'} x${item.quantity || 1}`).join(', ');
  const message = `Hi ${customer.name || 'there'}, this is PrimeHub Deals regarding your order #${order.id.slice(-6)} (Rs ${Number(order.total || 0).toLocaleString()}): ${items}. Current status: ${normalizedStatus(order.status)}.`;
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';
}

export default function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [search, setSearch] = useState('');
  const [addressOrder, setAddressOrder] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // ==================== ORDER LISTENER ====================
  useEffect(() => {
    return onSnapshot(adminCollection('orders'), (snapshot) => {
      setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Order));
    });
  }, []);

  // ==================== FILTERED ORDER RESULTS ====================
  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const statusMatches = statusFilter === 'all' || normalizedStatus(order.status) === statusFilter;
      const searchable = [
        order.id,
        order.customer?.name,
        order.customer?.phone,
        order.customer?.city,
        ...order.items.map((item) => item.title),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return statusMatches && (!term || searchable.includes(term));
    });
  }, [orders, search, statusFilter]);

  // ==================== ORDER ACTIONS ====================
  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdatingOrderId(orderId);
    try {
      await updateAdminDocument('orders', orderId, { status });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function chatWithCustomer(order: Order) {
    const url = whatsappUrl(order);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <h2 className="text-2xl font-black">Customer Orders</h2>

      {/* ==================== SEARCH AND STATUS FILTERS ==================== */}
      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4">
        <label className="flex items-center gap-2 rounded-xl bg-[#F4F4F1] px-3 py-2.5">
          <Search className="h-4 w-4 text-black/45" aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, customer, phone, or product" className="w-full bg-transparent text-sm outline-none" />
        </label>
        <div className="flex flex-wrap gap-2">
          {(['all', ...ORDER_STATUSES] as const).map((status) => (
            <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusFilter === status ? 'bg-[#14140F] text-white' : 'bg-black/5 text-black/60 hover:bg-black/10'}`}>
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      {/* ==================== ORDER LIST ==================== */}
      <div className="mt-5 overflow-x-auto rounded-2xl border border-black/10 bg-white">
        <table className="w-full min-w-[800px] text-left text-xs">
          <thead className="border-b border-black/10 text-black/50">
            <tr><th className="p-3">Customer</th><th className="p-3">Order</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => {
              const hasPhone = Boolean(String(order.customer?.phone || '').replace(/\D/g, ''));
              return (
                <tr key={order.id} className="border-b border-black/5 last:border-0 align-top">
                  <td className="p-3"><p className="font-bold">{order.customer?.name || 'Customer'}</p><p className="mt-0.5 text-black/50">{order.customer?.phone || 'No phone'}</p><button type="button" onClick={() => setAddressOrder(order)} className="mt-2 flex items-center gap-1 text-[#0F6A5F] hover:underline"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Address</button></td>
                  <td className="p-3"><p className="font-semibold">#{order.id.slice(-6)}</p><p className="mt-1 max-w-56 text-black/55">{order.items.map((item) => `${item.title || 'Item'} x${item.quantity || 1}`).join(', ') || 'No items'}</p></td>
                  <td className="p-3 font-bold">Rs {Number(order.total || 0).toLocaleString()}</td>
                  <td className="p-3"><select value={normalizedStatus(order.status)} disabled={updatingOrderId === order.id} onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)} className="rounded-lg border border-black/15 px-2 py-1.5 capitalize outline-none disabled:opacity-50">{ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                  <td className="p-3"><button type="button" disabled={!hasPhone} onClick={() => chatWithCustomer(order)} className="flex items-center gap-1.5 rounded-full bg-[#0F6A5F] px-3 py-2 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Chat</button></td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-sm text-black/45">No matching orders found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ==================== CUSTOMER ADDRESS MODAL ==================== */}
      {addressOrder && (
        <div role="dialog" aria-modal="true" aria-labelledby="address-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAddressOrder(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4"><div><h3 id="address-modal-title" className="text-lg font-black">Delivery Address</h3><p className="mt-1 text-sm text-black/55">{addressOrder.customer?.name || 'Customer'}</p></div><button type="button" aria-label="Close address details" onClick={() => setAddressOrder(null)} className="rounded-lg p-1.5 hover:bg-black/5"><X className="h-5 w-5" aria-hidden="true" /></button></div>
            <div className="mt-5 rounded-xl bg-[#F4F4F1] p-4 text-sm leading-6">{addressFor(addressOrder) || 'No delivery address was provided for this order.'}</div>
            {addressOrder.customer?.phone && <p className="mt-3 text-sm text-black/55">Phone: {addressOrder.customer.phone}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
