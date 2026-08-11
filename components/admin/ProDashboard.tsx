'use client';

import { useMemo } from 'react';
import { AlertTriangle, ArrowUpRight, Box, CheckCircle2, ClipboardList, Clock3, Package, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import type { Order, Product, VendorRequest } from './shared';

type Props = { products: Product[]; orders: Order[]; vendorRequests: VendorRequest[] };

const money = (value: number) => `Rs. ${Math.round(value).toLocaleString('en-PK')}`;

export default function ProDashboard({ products, orders, vendorRequests }: Props) {
  const stats = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pending = orders.filter((order) => !['delivered', 'cancelled', 'refunded'].includes(String(order.status || '').toLowerCase())).length;
    const lowStock = products.filter((product) => Number(product.stock || 0) <= 5).length;
    const outOfStock = products.filter((product) => Number(product.stock || 0) <= 0).length;
    const delivered = orders.filter((order) => String(order.status || '').toLowerCase() === 'delivered').length;
    return { revenue, pending, lowStock, outOfStock, delivered };
  }, [orders, products]);

  const cards = [
    { label: 'Total sales', value: money(stats.revenue), hint: `${orders.length} total orders`, icon: TrendingUp },
    { label: 'Orders', value: orders.length.toLocaleString(), hint: `${stats.pending} need attention`, icon: ShoppingBag },
    { label: 'Products', value: products.length.toLocaleString(), hint: `${stats.outOfStock} out of stock`, icon: Package },
    { label: 'Delivered', value: stats.delivered.toLocaleString(), hint: `${vendorRequests.filter((v) => String(v.status || '').toLowerCase() === 'pending').length} supplier requests`, icon: CheckCircle2 },
  ];

  const recent = [...orders].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 6);
  const attention = [
    stats.outOfStock ? `${stats.outOfStock} products are out of stock` : '',
    stats.lowStock ? `${stats.lowStock} products are at low stock` : '',
    stats.pending ? `${stats.pending} orders are still in progress` : '',
  ].filter(Boolean);

  return <section className="mx-auto max-w-7xl px-4 py-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.24em] text-[#E1352B]">PrimeHub command center</p><h2 className="mt-1 text-3xl font-black tracking-tight">Good morning, Admin.</h2><p className="mt-1 text-sm text-black/45">Your store health, sales and operations at a glance.</p></div><div className="rounded-full bg-white px-3 py-2 text-[10px] font-black text-black/45 shadow-sm">Live Firestore data</div></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, hint, icon: Icon }) => <article key={label} className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#14140F] text-white"><Icon size={18}/></div><ArrowUpRight size={16} className="text-black/20"/></div><p className="mt-5 text-[10px] font-black uppercase tracking-wider text-black/35">{label}</p><p className="mt-1 text-2xl font-black">{value}</p><p className="mt-1 text-[11px] text-black/45">{hint}</p></article>)}</div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-black">Recent orders</h3><p className="text-[11px] text-black/40">Latest activity from your storefront</p></div><ClipboardList size={18} className="text-black/25"/></div><div className="mt-4 divide-y divide-black/5">{recent.map((order) => <div key={order.id} className="flex items-center gap-3 py-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F4F1]"><ShoppingBag size={15}/></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{order.customer?.name || 'Customer'}</p><p className="truncate text-[10px] text-black/40">#{order.id.slice(0, 8)} · {order.status || 'pending'}</p></div><p className="text-xs font-black">{money(Number(order.total || 0))}</p></div>)}{!recent.length && <p className="py-8 text-center text-xs text-black/40">No orders yet.</p>}</div></section>
      <div className="space-y-4"><section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><AlertTriangle size={17} className="text-[#E1352B]"/><h3 className="font-black">Needs attention</h3></div><div className="mt-4 space-y-2">{attention.map((item) => <div key={item} className="rounded-xl bg-[#F4F4F1] px-3 py-3 text-xs font-bold">{item}</div>)}{!attention.length && <div className="flex items-center gap-2 rounded-xl bg-[#0F6A5F]/10 px-3 py-3 text-xs font-bold text-[#0F6A5F]"><CheckCircle2 size={14}/>Everything looks healthy.</div>}</div></section><section className="rounded-3xl border border-black/5 bg-[#14140F] p-5 text-white shadow-sm"><div className="flex items-center gap-2"><Clock3 size={17}/><h3 className="font-black">Operations snapshot</h3></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-3"><Box size={15}/><p className="mt-2 text-lg font-black">{stats.lowStock}</p><p className="text-[9px] uppercase tracking-wider text-white/45">Low stock</p></div><div className="rounded-2xl bg-white/10 p-3"><Users size={15}/><p className="mt-2 text-lg font-black">{vendorRequests.length}</p><p className="text-[9px] uppercase tracking-wider text-white/45">Supplier requests</p></div></div></section></div>
    </div>
  </section>;
}
