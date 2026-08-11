'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import AdminAuthGuard from '@/components/AdminAuthGuard';
import AdminHeader, { type AdminTab } from '@/components/admin/AdminHeader';
import DashboardStats from '@/components/admin/DashboardStats';
import ProductsManager from '@/components/admin/ProductsManager';
import CategoriesManager from '@/components/admin/CategoriesManager';
import DealScheduleManager from '@/components/admin/DealScheduleManager';
import OrdersManager from '@/components/admin/OrdersManager';
import VendorRequests from '@/components/admin/VendorRequests';
import SiteSettingsManager from '@/components/admin/SiteSettingsManager';
import MediaLibrary from '@/components/admin/MediaLibrary';
import { auth } from '@/lib/firebase';
import { adminCollection, type Order, type Product, type VendorRequest } from '@/components/admin/shared';

type ActiveTab = AdminTab;

export default function AdminPage() { return <AdminAuthGuard><AdminPanel /></AdminAuthGuard>; }

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendorRequests, setVendorRequests] = useState<VendorRequest[]>([]);

  useEffect(() => {
    const unsubscribeProducts = onSnapshot(adminCollection('products'), (snapshot) => setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Product)));
    const unsubscribeOrders = onSnapshot(adminCollection('orders'), (snapshot) => setOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Order)));
    const unsubscribeVendors = onSnapshot(adminCollection('vendor_submissions'), (snapshot) => setVendorRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as VendorRequest)));
    return () => { unsubscribeProducts(); unsubscribeOrders(); unsubscribeVendors(); };
  }, []);

  async function logout() { await signOut(auth); }

  function renderActiveTab() {
    switch (activeTab) {
      case 'dashboard': return <DashboardStats products={products} orders={orders} vendorRequests={vendorRequests} />;
      case 'products': return <ProductsManager />;
      case 'categories': return <CategoriesManager />;
      case 'media': return <MediaLibrary />;
      case 'deals': return <DealScheduleManager />;
      case 'orders': return <OrdersManager />;
      case 'suppliers': return <VendorRequests />;
      case 'settings': return <SiteSettingsManager />;
    }
  }

  return <main className="min-h-screen bg-[#F4F4F1]"><AdminHeader activeTab={activeTab} onTabChange={setActiveTab} onLogout={logout} search={search} onSearchChange={setSearch} stats={{ totalProducts: products.length, totalOrders: orders.length }} />{renderActiveTab()}</main>;
}
