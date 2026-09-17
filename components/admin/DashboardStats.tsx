// ==================== ADMIN DASHBOARD METRICS ====================
import Link from 'next/link';
import { ClipboardList, Package, Store, TrendingUp, Users } from 'lucide-react';
import type { Order, Product, VendorRequest } from './shared';

type Props = { products: Product[]; orders: Order[]; vendorRequests?: VendorRequest[] };

export default function DashboardStats({ products, orders, vendorRequests = [] }: Props) {
  const pendingOrders = orders.filter((order) => (order.status || 'pending') === 'pending').length;
  const pendingSupplierRequests = vendorRequests.filter((request) => (request.status || 'pending') === 'pending').length;
  const lowStock = products.filter((product) => Number(product.stock || 0) < 5).length;
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || order.subtotal || 0), 0);

  const metrics = [
    { label: 'Total Revenue', value: `Rs. ${revenue.toLocaleString()}`, icon: TrendingUp, tone: 'text-[#0F6A5F]', href: '/admin/orders', hint: 'Open orders' },
    { label: 'Total Orders', value: orders.length, icon: ClipboardList, tone: 'text-[#E1352B]', href: '/admin/orders', hint: 'View all orders' },
    { label: 'Pending Orders', value: pendingOrders, icon: ClipboardList, tone: 'text-[#FFB020]', href: '/admin/orders', hint: 'Orders waiting for action' },
    { label: 'Supplier Requests', value: pendingSupplierRequests, icon: Users, tone: 'text-[#7B4B94]', href: '/admin/suppliers', hint: 'Supplier submissions' },
    { label: 'Total Products', value: products.length, icon: Package, tone: 'text-[#14140F]', href: '/admin/products', hint: 'Open products' },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      <p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Store command center</p>
      <h2 className="mt-1 text-2xl font-black">Dashboard Overview</h2>
      <p className="mt-1 text-[10px] text-black/40">Tap any card to open the exact section behind that number.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map(({ label, value, icon: Icon, tone, href, hint }) => (
          <Link key={label} href={href} className="group rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03] transition active:scale-[0.99]">
            <div className="flex items-center justify-between gap-2">
              <Icon className={tone} size={20} />
              <Store size={13} className="text-black/15 transition group-hover:text-black/35" />
            </div>
            <p className="mt-4 text-[9px] font-black uppercase tracking-wider text-black/40">{label}</p>
            <p className="mt-1 text-xl font-black">{value}</p>
            <p className="mt-2 text-[8px] font-semibold text-black/30">{hint}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 rounded-3xl bg-[#14140F] p-5 text-white">
        <p className="text-[9px] font-black uppercase tracking-wider text-white/45">Quick status</p>
        <p className="mt-2 text-sm font-black">{pendingOrders} pending orders · {pendingSupplierRequests} supplier requests · {lowStock} low-stock products</p>
      </div>
    </section>
  );
}
