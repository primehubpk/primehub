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
import RewardsManager from '@/components/admin/RewardsManager';
import { auth } from '@/lib/firebase';
import { adminCollection, type Order, type Product, type VendorRequest } from '@/components/admin/shared';

type ActiveTab = 'dashboard' | 'products' | 'categories' | 'deals' | 'orders' | 'vendors' | 'settings' | 'rewards';

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

  function changeTab(tab: AdminTab) { setActiveTab(tab === 'suppliers' ? 'vendors' : tab); }
  async function logout() { await signOut(auth); }

  function renderActiveTab() {
    switch (activeTab) {
      case 'dashboard': return <DashboardStats products={products} orders={orders} vendorRequests={vendorRequests} />;
      case 'products': return <ProductsManager />;
      case 'categories': return <CategoriesManager />;
      case 'deals': return <DealScheduleManager />;
      case 'orders': return <OrdersManager />;
      case 'vendors': return <VendorRequests />;
      case 'settings': return <SiteSettingsManager />;
      case 'rewards': return <RewardsManager />;
    }
  }

  return <main className="min-h-screen bg-[#F4F4F1]"><AdminHeader activeTab={(activeTab === 'vendors' ? 'suppliers' : activeTab) as AdminTab} onTabChange={changeTab} onLogout={logout} search={search} onSearchChange={setSearch} stats={{ totalProducts: products.length, totalOrders: orders.length }} />{renderActiveTab()}</main>;
}
