// ==================== ADMIN DASHBOARD METRICS ====================
import { ClipboardList, Package, TrendingUp, Users } from 'lucide-react';
import type { DashboardStats as Stats, Order, Product, VendorRequest } from './shared';

type Props = { products: Product[]; orders: Order[]; vendorRequests?: VendorRequest[] };

export default function DashboardStats({ products, orders, vendorRequests = [] }: Props) {
  const pendingOrders = orders.filter((order) => (order.status || 'pending') === 'pending').length;
  const pendingRequests = vendorRequests.filter((request) => (request.status || 'pending') === 'pending').length;
  const metrics: Array<{ label: string; value: string | number; icon: typeof Package; tone: string }> = [
    { label: 'Total Revenue', value: `Rs. ${orders.reduce((sum, order) => sum + Number(order.total || order.subtotal || 0), 0).toLocaleString()}`, icon: TrendingUp, tone: 'text-[#0F6A5F]' },
    { label: 'Total Orders', value: orders.length, icon: ClipboardList, tone: 'text-[#E1352B]' },
    { label: 'Pending Requests', value: pendingRequests || pendingOrders, icon: Users, tone: 'text-[#FFB020]' },
    { label: 'Total Products', value: products.length, icon: Package, tone: 'text-[#14140F]' },
  ];
  return <section className="mx-auto max-w-6xl px-4 py-6"><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#E1352B]">Store command center</p><h2 className="mt-1 text-2xl font-black">Dashboard Overview</h2><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(({label,value,icon:Icon,tone}) => <article key={label} className="rounded-3xl bg-white p-4 shadow-sm"><Icon className={tone} size={20}/><p className="mt-4 text-[9px] font-black uppercase tracking-wider text-black/40">{label}</p><p className="mt-1 text-xl font-black">{value}</p></article>)}</div><div className="mt-4 rounded-3xl bg-[#14140F] p-5 text-white"><p className="text-[9px] font-black uppercase tracking-wider text-white/45">Quick status</p><p className="mt-2 text-sm font-black">{pendingOrders} pending orders · {products.filter((product) => Number(product.stock || 0) < 5).length} low-stock products</p></div></section>;
}
