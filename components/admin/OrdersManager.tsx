'use client';

import { useEffect, useMemo, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { adminCollection, type Order } from './shared';

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];
type OrderItem = Order['items'][number];

type ActionMessage = {
  kind: 'success' | 'error';
  text: string;
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  processing: 'bg-sky-50 text-sky-700 ring-sky-200',
  shipped: 'bg-violet-50 text-violet-700 ring-violet-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
};

function normalizedStatus(status?: string): OrderStatus {
  if (status === 'confirmed') return 'processing';
  return ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : 'pending';
}

function textValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toLocaleString() : '0';
}

function itemsFor(order: Order) {
  return Array.isArray(order.items) ? order.items : [];
}

function addressFor(order: Order) {
  const customer = order.customer || {};
  return [customer.address, customer.area, customer.city, customer.postalCode]
    .map(textValue)
    .filter(Boolean)
    .join(', ');
}

function itemImage(item: OrderItem) {
  const raw = textValue(item.image) || textValue(item.imageUrl) || textValue(item.photoUrl);
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function itemVariant(item: OrderItem) {
  const variant = item.variant;
  if (!variant || typeof variant !== 'object') return '';
  const row = variant as Record<string, unknown>;
  const color = textValue(row.color);
  const size = textValue(row.size);
  return [color ? `Color: ${color}` : '', size ? `Size: ${size}` : ''].filter(Boolean).join(' • ');
}

function orderTime(value: unknown) {
  if (!value) return 0;
  try {
    if (typeof value === 'object') {
      const row = value as { toDate?: () => Date; seconds?: number };
      if (typeof row.toDate === 'function') return row.toDate().getTime();
      if (typeof row.seconds === 'number') return row.seconds * 1000;
    }
    const parsed = new Date(value as string | number | Date).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function orderDate(value: unknown) {
  const time = orderTime(value);
  if (!time) return 'Date unavailable';
  try {
    return new Intl.DateTimeFormat('en-PK', {
      timeZone: 'Asia/Karachi',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(time));
  } catch {
    return new Date(time).toLocaleString();
  }
}

function whatsappUrl(order: Order) {
  const customer = order.customer || {};
  const phone = String(customer.phone || '').replace(/\D/g, '');
  const items = itemsFor(order).map((item) => `${item.title || 'Item'} x${item.quantity || 1}`).join(', ');
  const message = `Hi ${customer.name || 'there'}, this is PrimeHub Deals regarding your order #${order.id.slice(-6)} (Rs ${money(order.total)}): ${items}. Current status: ${normalizedStatus(order.status)}.`;
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';
}

async function adminOrderAction(action: 'status' | 'delete', orderId: string, status?: OrderStatus) {
  const response = await fetch('/api/admin/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    body: JSON.stringify({ action, orderId, ...(status ? { status } : {}) }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || 'Order action failed.');
  }
  return result as { success: true; mirrorWarning?: string };
}

export default function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [search, setSearch] = useState('');
  const [addressOrder, setAddressOrder] = useState<Order | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [rewardingOrderId, setRewardingOrderId] = useState<string | null>(null);
  const [rewardMessage, setRewardMessage] = useState('');
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);

  useEffect(
    () => onSnapshot(
      adminCollection('orders'),
      (snapshot) => setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Order)),
      () => setActionMessage({ kind: 'error', text: 'Orders could not be refreshed. Please reload the page.' }),
    ),
    [],
  );

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...orders]
      .filter((order) => {
        const statusMatches = statusFilter === 'all' || normalizedStatus(order.status) === statusFilter;
        const searchable = [
          order.id,
          order.customer?.name,
          order.customer?.phone,
          order.customer?.city,
          addressFor(order),
          ...itemsFor(order).flatMap((item) => [item.title, item.productId, itemVariant(item)]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return statusMatches && (!term || searchable.includes(term));
      })
      .sort((a, b) => orderTime(b.createdAt) - orderTime(a.createdAt));
  }, [orders, search, statusFilter]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdatingOrderId(orderId);
    setActionMessage(null);
    try {
      await adminOrderAction('status', orderId, status);
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));
      setActionMessage({ kind: 'success', text: `Order #${orderId.slice(-6)} status updated to ${status}.` });
    } catch (error) {
      setActionMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Status update failed.' });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteOrder || deletingOrderId) return;
    const orderId = deleteOrder.id;
    setDeletingOrderId(orderId);
    setActionMessage(null);
    try {
      await adminOrderAction('delete', orderId);
      setOrders((current) => current.filter((order) => order.id !== orderId));
      setDeleteOrder(null);
      setActionMessage({ kind: 'success', text: `Order #${orderId.slice(-6)} deleted successfully.` });
    } catch (error) {
      setActionMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Order delete failed.' });
    } finally {
      setDeletingOrderId(null);
    }
  }

  async function approveReward(order: Order) {
    const row = order as Order & { resellerUserId?: string; resellerRewardStatus?: string };
    if (!row.resellerUserId) return;
    setRewardingOrderId(order.id);
    setRewardMessage('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Admin session expired.');
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reseller-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resellerUserId: row.resellerUserId, orderId: order.id, orderTotal: Number(order.total || 0), source: 'website' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Reward approval failed.');
      setRewardMessage(data.alreadyCredited ? 'Reward was already credited.' : `Reward credited: Rs. ${Number(data.reward || 0).toLocaleString()}`);
    } catch (error) {
      setRewardMessage(error instanceof Error ? error.message : 'Reward approval failed.');
    } finally {
      setRewardingOrderId(null);
    }
  }

  function chatWithCustomer(order: Order) {
    const url = whatsappUrl(order);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black sm:text-2xl">Customer Orders</h2>
          <p className="mt-1 text-[11px] font-medium text-black/40">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} shown
          </p>
        </div>
      </div>

      {rewardMessage && (
        <p className="mt-3 rounded-2xl bg-[#DDF5F0] p-3 text-xs font-bold text-[#0F6A5F]">{rewardMessage}</p>
      )}
      {actionMessage && (
        <p className={`mt-3 rounded-2xl p-3 text-xs font-bold ${actionMessage.kind === 'success' ? 'bg-[#DDF5F0] text-[#0F6A5F]' : 'bg-rose-50 text-rose-700'}`}>
          {actionMessage.text}
        </p>
      )}

      <div className="mt-4 rounded-3xl border border-black/8 bg-white p-3 shadow-sm sm:p-4">
        <label className="flex items-center gap-2 rounded-2xl bg-[#F4F4F1] px-3 py-3">
          <Search className="h-4 w-4 shrink-0 text-black/40" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, phone, order or product"
            className="min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-black/35"
          />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(['all', ...ORDER_STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-black capitalize transition ${statusFilter === status ? 'bg-[#14140F] text-white' : 'bg-black/5 text-black/55'}`}
            >
              {status === 'all' ? 'All Orders' : status}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {filteredOrders.map((order) => {
          const row = order as Order & { resellerUserId?: string; resellerRewardStatus?: string };
          const status = normalizedStatus(order.status);
          const items = itemsFor(order);
          const hasPhone = Boolean(String(order.customer?.phone || '').replace(/\D/g, ''));
          const deliveryCharge = Number(order.deliveryCharge || 0);
          const fullAddress = addressFor(order);

          return (
            <article key={order.id} className="overflow-hidden rounded-[26px] border border-black/8 bg-white shadow-sm">
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black capitalize ring-1 ring-inset ${STATUS_STYLES[status]}`}>
                        {status}
                      </span>
                      {row.resellerUserId && (
                        <span className="inline-flex rounded-full bg-[#DDF5F0] px-2.5 py-1 text-[9px] font-black text-[#0F6A5F]">RESELLER</span>
                      )}
                    </div>
                    <h3 className="mt-2 truncate text-base font-black sm:text-lg">{order.customer?.name || 'Customer'}</h3>
                    <a href={hasPhone ? `tel:${order.customer?.phone}` : undefined} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-black/50">
                      <Phone size={13} /> {order.customer?.phone || 'No phone'}
                    </a>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black">#{order.id.slice(-6)}</p>
                    <p className="mt-1 flex items-center justify-end gap-1 text-[9px] font-semibold text-black/35">
                      <CalendarDays size={11} /> {orderDate(order.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-[#F7F7F4] p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-xs font-black">
                      <Package size={15} className="text-[#0F6A5F]" /> Ordered Products
                    </p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-black/45">
                      {items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0)} pcs
                    </span>
                  </div>

                  <div className="mt-3 divide-y divide-black/7">
                    {items.length > 0 ? items.map((item, index) => {
                      const image = itemImage(item);
                      const quantity = Math.max(1, Number(item.quantity || 1));
                      const price = Number(item.price || 0);
                      const variant = itemVariant(item);
                      const wholesale = item.isWholesale === true;
                      return (
                        <div key={`${textValue(item.productId) || 'item'}-${index}`} className="grid grid-cols-[68px_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[78px_minmax(0,1fr)_auto] sm:items-center">
                          <div className="relative flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-xl border border-black/8 bg-white sm:h-[78px] sm:w-[78px]">
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={image} alt={textValue(item.title) || 'Ordered product'} className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <Package size={24} className="text-black/20" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black leading-5 sm:text-sm">{item.title || 'Item'}</p>
                            {variant && <p className="mt-0.5 text-[10px] font-semibold text-black/45">{variant}</p>}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-black/55">Qty {quantity}</span>
                              {wholesale && <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-700">Wholesale</span>}
                            </div>
                            <p className="mt-2 text-[10px] font-bold text-black/50 sm:hidden">
                              Rs {money(price)} each {price > 0 ? `• Rs ${money(price * quantity)}` : ''}
                            </p>
                          </div>
                          <div className="hidden text-right sm:block">
                            <p className="text-[10px] font-semibold text-black/40">Rs {money(price)} each</p>
                            {price > 0 && <p className="mt-1 text-sm font-black">Rs {money(price * quantity)}</p>}
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="py-5 text-center text-xs font-semibold text-black/40">No product details were saved with this order.</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-black/8 p-3.5 sm:p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Customer & Delivery</p>
                    <div className="mt-2.5 flex items-start gap-2 text-xs leading-5 text-black/65">
                      <MapPin size={15} className="mt-0.5 shrink-0 text-[#0F6A5F]" />
                      <span className="min-w-0 break-words">{fullAddress || 'No delivery address was provided.'}</span>
                    </div>
                    <button type="button" onClick={() => setAddressOrder(order)} className="mt-3 rounded-full bg-[#F4F4F1] px-3 py-2 text-[10px] font-black text-[#0F6A5F]">
                      View address
                    </button>
                  </div>

                  <div className="rounded-2xl border border-black/8 p-3.5 sm:p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Order Total</p>
                    <div className="mt-2.5 space-y-2 text-xs">
                      <div className="flex justify-between gap-3 text-black/50"><span>Subtotal</span><span className="font-bold">Rs {money(order.subtotal)}</span></div>
                      <div className="flex justify-between gap-3 text-black/50"><span>Delivery</span><span className="font-bold">Rs {money(deliveryCharge)}</span></div>
                      <div className="border-t border-black/8 pt-2.5 flex justify-between gap-3 text-sm font-black"><span>Total</span><span>Rs {money(order.total)}</span></div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 border-t border-black/8 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-black/35">Order status</span>
                      <select
                        value={status}
                        disabled={updatingOrderId === order.id || deletingOrderId === order.id}
                        onChange={(event) => void updateStatus(order.id, event.target.value as OrderStatus)}
                        className="w-full rounded-xl border border-black/12 bg-white px-3 py-3 text-xs font-bold capitalize outline-none disabled:opacity-50"
                      >
                        {ORDER_STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>

                    <div>
                      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-black/35">Reseller</span>
                      {row.resellerUserId ? (
                        row.resellerRewardStatus === 'credited' ? (
                          <div className="flex min-h-[42px] items-center rounded-xl bg-[#DDF5F0] px-3 text-[10px] font-black text-[#0F6A5F]">Reward credited</div>
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(rewardingOrderId) || deletingOrderId === order.id}
                            onClick={() => void approveReward(order)}
                            className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#0F6A5F] px-3 text-[10px] font-black text-white disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} /> {rewardingOrderId === order.id ? 'Please wait…' : 'Confirm + Reward'}
                          </button>
                        )
                      ) : (
                        <div className="flex min-h-[42px] items-center rounded-xl bg-[#F4F4F1] px-3 text-[10px] font-bold text-black/35">Regular customer</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex lg:justify-end">
                    <button
                      type="button"
                      disabled={!hasPhone || deletingOrderId === order.id}
                      onClick={() => chatWithCustomer(order)}
                      className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#0F6A5F] px-4 text-[11px] font-black text-white disabled:opacity-40"
                    >
                      <MessageCircle size={15} /> Chat
                    </button>
                    <button
                      type="button"
                      disabled={deletingOrderId === order.id}
                      onClick={() => setDeleteOrder(order)}
                      className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 text-[11px] font-black text-rose-700 disabled:opacity-40"
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="rounded-[26px] border border-dashed border-black/15 bg-white px-5 py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-black/15" />
            <p className="mt-3 text-sm font-black">No matching orders found</p>
            <p className="mt-1 text-xs text-black/40">Try another search or status filter.</p>
          </div>
        )}
      </div>

      {addressOrder && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-4" onClick={() => setAddressOrder(null)}>
          <div className="w-full max-w-md rounded-[26px] bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black">Delivery Address</h3>
                <p className="mt-1 text-xs text-black/50">{addressOrder.customer?.name || 'Customer'} • #{addressOrder.id.slice(-6)}</p>
              </div>
              <button type="button" onClick={() => setAddressOrder(null)} className="rounded-full bg-[#F4F4F1] p-2" aria-label="Close address">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-[#F4F4F1] p-4 text-sm leading-6">{addressFor(addressOrder) || 'No delivery address was provided.'}</div>
            {addressOrder.customer?.phone && <p className="mt-3 text-sm font-semibold text-black/55">Phone: {addressOrder.customer.phone}</p>}
          </div>
        </div>
      )}

      {deleteOrder && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[230] flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4" onClick={() => !deletingOrderId && setDeleteOrder(null)}>
          <div className="w-full max-w-md rounded-[26px] bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><Trash2 size={20} /></div>
            <h3 className="mt-4 text-lg font-black">Delete order #{deleteOrder.id.slice(-6)}?</h3>
            <p className="mt-2 text-xs leading-5 text-black/50">
              {deleteOrder.customer?.name || 'This customer'} ka order permanently delete ho jayega. Is action ko undo nahi kiya ja sakta.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={Boolean(deletingOrderId)} onClick={() => setDeleteOrder(null)} className="rounded-xl bg-[#F4F4F1] px-4 py-3 text-xs font-black disabled:opacity-50">Cancel</button>
              <button type="button" disabled={Boolean(deletingOrderId)} onClick={() => void confirmDelete()} className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">
                <Trash2 size={14} /> {deletingOrderId ? 'Deleting…' : 'Delete Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
