'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { getAdminDocument, setAdminDocument, type Order } from './shared';

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
const ORDER_WHATSAPP_SETTING_ID = 'orders_whatsapp_forwarding';
type OrderStatus = (typeof ORDER_STATUSES)[number];
type OrderItem = Order['items'][number];

type ActionMessage = {
  kind: 'success' | 'error';
  text: string;
};

type OrdersResponse = {
  success: true;
  orders: Order[];
  primary?: string;
  warning?: string | null;
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

function customerValue(order: Order, key: string) {
  const customer = order.customer || {};
  return textValue((customer as Record<string, unknown>)[key]);
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toLocaleString() : '0';
}

function itemsFor(order: Order) {
  return Array.isArray(order.items) ? order.items : [];
}

function addressFor(order: Order) {
  const parts = [
    customerValue(order, 'address'),
    customerValue(order, 'area'),
    customerValue(order, 'city'),
    customerValue(order, 'postalCode'),
  ].filter(Boolean);
  return [...new Set(parts)].join(', ');
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

function whatsappPhone(value: unknown) {
  let digits = textValue(value).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^03\d{9}$/.test(digits)) digits = `92${digits.slice(1)}`;
  if (/^3\d{9}$/.test(digits)) digits = `92${digits}`;
  return digits;
}

function customerWhatsappUrl(order: Order) {
  const customer = order.customer || {};
  const phone = whatsappPhone(customer.phone);
  const items = itemsFor(order).map((item) => `${item.title || 'Item'} x${item.quantity || 1}`).join(', ');
  const message = `Hi ${customer.name || 'there'}, this is PrimeHub Deals regarding your order #${order.id.slice(-6)} (Rs ${money(order.total)}): ${items}. Current status: ${normalizedStatus(order.status)}.`;
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';
}

function labelForKey(key: string) {
  const labels: Record<string, string> = {
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    city: 'City',
    address: 'Address',
    area: 'Area',
    postalCode: 'Postal Code',
    notes: 'Notes',
  };
  return labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function messageValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (Array.isArray(value)) return value.map(messageValue).filter(Boolean).join(', ');
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function orderForwardMessage(order: Order) {
  const lines: string[] = [
    '🧾 *PrimeHub Order*',
    `Order ID: ${order.id}`,
    `Order #: #${order.id.slice(-6)}`,
    `Date: ${orderDate(order.createdAt)}`,
    `Status: ${normalizedStatus(order.status)}`,
  ];

  const source = textValue(order.source);
  const fulfillment = textValue(order.fulfillment);
  const paymentMethod = textValue(order.paymentMethod);
  if (source) lines.push(`Source: ${source}`);
  if (fulfillment) lines.push(`Fulfillment: ${fulfillment}`);
  if (paymentMethod) lines.push(`Payment: ${paymentMethod}`);

  lines.push('', '👤 *Customer Details*');
  const customer = (order.customer || {}) as Record<string, unknown>;
  const priorityCustomerKeys = ['name', 'phone', 'email', 'city', 'address', 'area', 'postalCode', 'notes'];
  const usedCustomerKeys = new Set<string>();

  for (const key of priorityCustomerKeys) {
    const value = messageValue(customer[key]);
    if (value) {
      lines.push(`${labelForKey(key)}: ${value}`);
      usedCustomerKeys.add(key);
    }
  }
  for (const [key, rawValue] of Object.entries(customer)) {
    if (usedCustomerKeys.has(key)) continue;
    const value = messageValue(rawValue);
    if (value) lines.push(`${labelForKey(key)}: ${value}`);
  }

  const items = itemsFor(order);
  lines.push('', `🛍️ *Ordered Products (${items.length})*`);

  items.forEach((item, index) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const price = Number(item.price || 0);
    const originalPrice = Number(item.originalPrice || 0);
    const image = itemImage(item);
    const variant = itemVariant(item);
    const category = textValue(item.category);
    const productId = textValue(item.productId);

    lines.push('', `*${index + 1}. ${textValue(item.title) || 'Item'}*`);
    if (variant) lines.push(variant.replace(/ • /g, ' | '));
    if (category) lines.push(`Category: ${category}`);
    if (productId) lines.push(`Product ID: ${productId}`);
    lines.push(`Quantity: ${quantity}`);
    lines.push(`Price each: Rs. ${money(price)}`);
    if (originalPrice > 0 && originalPrice !== price) lines.push(`Original price: Rs. ${money(originalPrice)}`);
    if (price > 0) lines.push(`Line total: Rs. ${money(price * quantity)}`);
    if (item.isWholesale === true) lines.push('Wholesale: Yes');
    if (image) lines.push(`Image: ${image}`);
  });

  lines.push('', '💰 *Order Total*');
  const rawSubtotal = Number(order.rawSubtotal || 0);
  const subtotal = Number(order.subtotal || 0);
  const tierDiscount = Number(order.tierDiscount || 0);
  const baseDelivery = Number(order.baseDelivery || 0);
  const wholesaleSurcharge = Number(order.wholesaleSurcharge || 0);
  const deliveryCharge = Number(order.deliveryCharge || 0);
  if (rawSubtotal > 0 && rawSubtotal !== subtotal) lines.push(`Items subtotal: Rs. ${money(rawSubtotal)}`);
  if (tierDiscount > 0) lines.push(`Discount: Rs. ${money(tierDiscount)}`);
  lines.push(`Subtotal: Rs. ${money(order.subtotal)}`);
  if (baseDelivery > 0) lines.push(`Base delivery: Rs. ${money(baseDelivery)}`);
  if (wholesaleSurcharge > 0) lines.push(`Wholesale delivery surcharge: Rs. ${money(wholesaleSurcharge)}`);
  lines.push(`Delivery: Rs. ${money(deliveryCharge)}`);
  lines.push(`*TOTAL: Rs. ${money(order.total)}*`);

  const totalItems = Number(order.totalItems || 0);
  if (totalItems > 0) lines.push(`Total items: ${totalItems}`);
  const currency = textValue(order.currency);
  if (currency) lines.push(`Currency: ${currency}`);

  return lines.join('\n');
}

function orderForwardWhatsappUrl(order: Order, savedNumber: string) {
  const phone = whatsappPhone(savedNumber);
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(orderForwardMessage(order))}` : '';
}

async function fetchAdminOrders() {
  const response = await fetch('/api/admin/orders', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || 'Orders could not be loaded.');
  }
  return result as OrdersResponse;
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
  const [loadWarning, setLoadWarning] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [savedWhatsappNumber, setSavedWhatsappNumber] = useState('');
  const [savingWhatsappNumber, setSavingWhatsappNumber] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAdminOrders()
      .then((data) => {
        if (!active) return;
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setLoadWarning(data.warning || '');
      })
      .catch((error) => {
        if (!active) return;
        setActionMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Orders could not be loaded.' });
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getAdminDocument('settings', ORDER_WHATSAPP_SETTING_ID)
      .then((snapshot) => {
        if (!active || !snapshot.exists()) return;
        const data = snapshot.data() as Record<string, unknown> | undefined;
        const number = textValue(data?.whatsappNumber);
        setWhatsappNumber(number);
        setSavedWhatsappNumber(number);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Order WhatsApp number could not be loaded.', error);
      });
    return () => { active = false; };
  }, []);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...orders]
      .filter((order) => {
        const statusMatches = statusFilter === 'all' || normalizedStatus(order.status) === statusFilter;
        const searchable = [
          order.id,
          order.customer?.name,
          order.customer?.phone,
          customerValue(order, 'city'),
          customerValue(order, 'address'),
          customerValue(order, 'area'),
          ...itemsFor(order).flatMap((item) => [item.title, item.productId, itemVariant(item)]),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return statusMatches && (!term || searchable.includes(term));
      })
      .sort((a, b) => orderTime(b.createdAt) - orderTime(a.createdAt));
  }, [orders, search, statusFilter]);

  async function reloadOrders() {
    if (loadingOrders) return;
    setLoadingOrders(true);
    setActionMessage(null);
    try {
      const data = await fetchAdminOrders();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setLoadWarning(data.warning || '');
    } catch (error) {
      setActionMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Orders could not be refreshed.' });
    } finally {
      setLoadingOrders(false);
    }
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdatingOrderId(orderId);
    setActionMessage(null);
    try {
      const result = await adminOrderAction('status', orderId, status);
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));
      setActionMessage({ kind: 'success', text: `Order #${orderId.slice(-6)} status updated to ${status}.` });
      if (result.mirrorWarning) setLoadWarning('Order saved in Supabase. Firebase mirror is temporarily unavailable.');
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
      const result = await adminOrderAction('delete', orderId);
      setOrders((current) => current.filter((order) => order.id !== orderId));
      setDeleteOrder(null);
      setActionMessage({ kind: 'success', text: `Order #${orderId.slice(-6)} deleted successfully.` });
      if (result.mirrorWarning) setLoadWarning('Order deleted from Supabase. Firebase mirror is temporarily unavailable.');
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

  async function saveWhatsappNumber() {
    const number = whatsappNumber.trim();
    const normalized = whatsappPhone(number);
    if (normalized.length < 8 || normalized.length > 15) {
      setActionMessage({ kind: 'error', text: 'Please enter a valid WhatsApp number with country code, for example +923001234567.' });
      return;
    }

    setSavingWhatsappNumber(true);
    setActionMessage(null);
    try {
      await setAdminDocument('settings', ORDER_WHATSAPP_SETTING_ID, {
        whatsappNumber: number,
        updatedAt: new Date().toISOString(),
      });
      setSavedWhatsappNumber(number);
      setActionMessage({ kind: 'success', text: 'Order WhatsApp number saved. Send Order is now ready on every order.' });
    } catch (error) {
      setActionMessage({ kind: 'error', text: error instanceof Error ? error.message : 'WhatsApp number could not be saved.' });
    } finally {
      setSavingWhatsappNumber(false);
    }
  }

  function chatWithCustomer(order: Order) {
    const url = customerWhatsappUrl(order);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  function sendOrderToWhatsapp(order: Order) {
    const url = orderForwardWhatsappUrl(order, savedWhatsappNumber);
    if (!url) {
      setActionMessage({ kind: 'error', text: 'Save the Order WhatsApp number at the top first.' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
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
        <button
          type="button"
          disabled={loadingOrders}
          onClick={() => void reloadOrders()}
          className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2.5 text-[10px] font-black shadow-sm ring-1 ring-black/8 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loadingOrders ? 'animate-spin' : ''} /> {loadingOrders ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="mt-4 rounded-3xl border border-[#0F6A5F]/20 bg-white p-3.5 shadow-sm sm:p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#DDF5F0] text-[#0F6A5F]">
            <MessageCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black">Order WhatsApp</p>
            <p className="mt-1 text-[10px] font-medium leading-4 text-black/45">
              Save one WhatsApp number here. Every order will get a Send Order button that sends complete customer, product, image-link and total details.
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            type="tel"
            inputMode="tel"
            value={whatsappNumber}
            onChange={(event) => setWhatsappNumber(event.target.value)}
            placeholder="+923001234567"
            className="min-w-0 rounded-xl border border-black/10 bg-[#F7F7F4] px-3 py-3 text-xs font-bold outline-none focus:border-[#0F6A5F]/40"
          />
          <button
            type="button"
            disabled={savingWhatsappNumber}
            onClick={() => void saveWhatsappNumber()}
            className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#14140F] px-4 text-[11px] font-black text-white disabled:opacity-50"
          >
            <Save size={14} /> {savingWhatsappNumber ? 'Saving…' : 'Save Number'}
          </button>
        </div>
        {savedWhatsappNumber && (
          <p className="mt-2 text-[9px] font-bold text-[#0F6A5F]">Saved: {savedWhatsappNumber}</p>
        )}
      </div>

      {rewardMessage && (
        <p className="mt-3 rounded-2xl bg-[#DDF5F0] p-3 text-xs font-bold text-[#0F6A5F]">{rewardMessage}</p>
      )}
      {actionMessage && (
        <p className={`mt-3 rounded-2xl p-3 text-xs font-bold ${actionMessage.kind === 'success' ? 'bg-[#DDF5F0] text-[#0F6A5F]' : 'bg-rose-50 text-rose-700'}`}>
          {actionMessage.text}
        </p>
      )}
      {loadWarning && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[10px] font-semibold leading-5 text-amber-800">
          {loadWarning}
        </div>
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
          const name = customerValue(order, 'name') || 'Customer';
          const phone = customerValue(order, 'phone');
          const city = customerValue(order, 'city');
          const address = customerValue(order, 'address');
          const area = customerValue(order, 'area');
          const postalCode = customerValue(order, 'postalCode');
          const hasPhone = Boolean(phone.replace(/\D/g, ''));
          const deliveryCharge = Number(order.deliveryCharge || 0);

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
                    <h3 className="mt-2 truncate text-base font-black sm:text-lg">{name}</h3>
                    <a href={hasPhone ? `tel:${phone}` : undefined} className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-black/50">
                      <Phone size={13} /> {phone || 'No phone'}
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
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Customer Details</p>
                      <MapPin size={15} className="text-[#0F6A5F]" />
                    </div>
                    <div className="mt-3 space-y-2.5 text-xs">
                      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2"><span className="font-semibold text-black/40">Name</span><span className="font-black text-black/75">{name}</span></div>
                      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2"><span className="font-semibold text-black/40">Contact</span><span className="break-words font-bold text-black/70">{phone || 'Not provided'}</span></div>
                      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2"><span className="font-semibold text-black/40">City</span><span className="break-words font-bold text-black/70">{city || 'Not provided'}</span></div>
                      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2"><span className="font-semibold text-black/40">Address</span><span className="break-words font-bold leading-5 text-black/70">{address || 'Not provided'}</span></div>
                      {area && <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2"><span className="font-semibold text-black/40">Area</span><span className="break-words font-bold text-black/70">{area}</span></div>}
                      {postalCode && <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2"><span className="font-semibold text-black/40">Postal</span><span className="break-words font-bold text-black/70">{postalCode}</span></div>}
                    </div>
                    <button type="button" onClick={() => setAddressOrder(order)} className="mt-3 rounded-full bg-[#F4F4F1] px-3 py-2 text-[10px] font-black text-[#0F6A5F]">
                      View full address
                    </button>
                  </div>

                  <div className="rounded-2xl border border-black/8 p-3.5 sm:p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Order Total</p>
                    <div className="mt-2.5 space-y-2 text-xs">
                      <div className="flex justify-between gap-3 text-black/50"><span>Subtotal</span><span className="font-bold">Rs {money(order.subtotal)}</span></div>
                      <div className="flex justify-between gap-3 text-black/50"><span>Delivery</span><span className="font-bold">Rs {money(deliveryCharge)}</span></div>
                      <div className="flex justify-between gap-3 border-t border-black/8 pt-2.5 text-sm font-black"><span>Total</span><span>Rs {money(order.total)}</span></div>
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

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                    <button
                      type="button"
                      disabled={!savedWhatsappNumber || deletingOrderId === order.id}
                      onClick={() => sendOrderToWhatsapp(order)}
                      className="col-span-2 flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#0F6A5F] px-4 text-[11px] font-black text-white disabled:opacity-40 sm:col-span-1"
                    >
                      <Send size={15} /> Send Order
                    </button>
                    <button
                      type="button"
                      disabled={!hasPhone || deletingOrderId === order.id}
                      onClick={() => chatWithCustomer(order)}
                      className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#0F6A5F]/20 bg-[#DDF5F0] px-4 text-[11px] font-black text-[#0F6A5F] disabled:opacity-40"
                    >
                      <MessageCircle size={15} /> Customer Chat
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

        {!loadingOrders && filteredOrders.length === 0 && (
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
                <h3 className="text-lg font-black">Customer & Delivery</h3>
                <p className="mt-1 text-xs text-black/50">#{addressOrder.id.slice(-6)}</p>
              </div>
              <button type="button" onClick={() => setAddressOrder(null)} className="rounded-full bg-[#F4F4F1] p-2" aria-label="Close address">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-3 rounded-2xl bg-[#F4F4F1] p-4 text-sm">
              <div><span className="block text-[9px] font-black uppercase tracking-wider text-black/35">Name</span><span className="mt-1 block font-black">{customerValue(addressOrder, 'name') || 'Customer'}</span></div>
              <div><span className="block text-[9px] font-black uppercase tracking-wider text-black/35">Contact</span><span className="mt-1 block font-bold">{customerValue(addressOrder, 'phone') || 'Not provided'}</span></div>
              <div><span className="block text-[9px] font-black uppercase tracking-wider text-black/35">City</span><span className="mt-1 block font-bold">{customerValue(addressOrder, 'city') || 'Not provided'}</span></div>
              <div><span className="block text-[9px] font-black uppercase tracking-wider text-black/35">Complete Address</span><span className="mt-1 block break-words font-bold leading-6">{addressFor(addressOrder) || 'No delivery address was provided.'}</span></div>
            </div>
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
