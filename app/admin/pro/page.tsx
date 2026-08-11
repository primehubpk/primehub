'use client';

import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import AdminAuthGuard from '@/components/AdminAuthGuard';
import AdminHeader, { type AdminTab } from '@/components/admin/AdminHeader';
import ProDashboard from '@/components/admin/ProDashboard';
import ProductsManager from '@/components/admin/ProductsManager';
import CategoriesManager from '@/components/admin/CategoriesManager';
import DealScheduleManager from '@/components/admin/DealScheduleManager';
import OrdersManager from '@/components/admin/OrdersManager';
import VendorRequests from '@/components/admin/VendorRequests';
import SiteSettingsManager from '@/components/admin/SiteSettingsManager';
import MediaLibrary from '@/components/admin/MediaLibrary';
import { adminCollection, type Order, type Product, type VendorRequest } from '@/components/admin/shared';

type Tab = Exclude<AdminTab, 'rewards'>;

export default function ProfessionalAdminPage() {
  return <AdminAuthGuard><ProfessionalAdmin /></AdminAuthGuard>;
}

function ProfessionalAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendorRequests, setVendorRequests] = useState<VendorRequest[]>([]);

  useEffect(() => {
    const productsUnsub = onSnapshot(adminCollection('products'), (s) => setProducts(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)));
    const ordersUnsub = onSnapshot(adminCollection('orders'), (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)));
    const vendorsUnsub = onSnapshot(adminCollection('vendor_submissions'), (s) => setVendorRequests(s.docs.map((d) => ({ id: d.id, ...d.data() }) as VendorRequest)));
    return () => { productsUnsub(); ordersUnsub(); vendorsUnsub(); };
  }, []);

  const render = () => {
    switch (activeTab) {
      case 'dashboard': return <ProDashboard products={products} orders={orders} vendorRequests={vendorRequests} />;
      case 'products': return <ProductsManager />;
      case 'categories': return <CategoriesManager />;
      case 'media': return <MediaLibrary />;
      case 'deals': return <DealScheduleManager />;
      case 'orders': return <OrdersManager />;
      case 'suppliers': return <VendorRequests />;
      case 'settings': return <SiteSettingsManager />;
    }
  };

  return <main className="min-h-screen bg-[#F4F4F1]"><AdminHeader activeTab={activeTab} onTabChange={setActiveTab} onLogout={() => undefined} search={search} onSearchChange={setSearch} stats={{ totalProducts: products.length, totalOrders: orders.length }} />{render()}</main>;
}
