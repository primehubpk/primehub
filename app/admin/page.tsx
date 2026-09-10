'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import AdminAuthGuard from '@/components/AdminAuthGuard';
import AdminHeader, { type AdminTab } from '@/components/admin/AdminHeader';
import DashboardStats from '@/components/admin/DashboardStats';
import { adminCollection, type Order, type Product, type VendorRequest } from '@/components/admin/shared';
import { auth } from '@/lib/firebase';

export default function AdminPage() {
  return <AdminAuthGuard><AdminPanel /></AdminAuthGuard>;
}

function AdminPanel() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendorRequests, setVendorRequests] = useState<VendorRequest[]>([]);

  useEffect(() => {
    const stopProducts = onSnapshot(adminCollection('products'), (snapshot) => setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product)));
    const stopOrders = onSnapshot(adminCollection('orders'), (snapshot) => setOrders(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Order)));
    const stopVendors = onSnapshot(adminCollection('vendor_submissions'), (snapshot) => setVendorRequests(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as VendorRequest)));
    return () => { stopProducts(); stopOrders(); stopVendors(); };
  }, []);

  async function logout() {
    await fetch('/api/admin/session', { method: 'DELETE', cache: 'no-store' }).catch(() => undefined);
    await signOut(auth).catch(() => undefined);
    router.replace('/admin');
    router.refresh();
  }

  function openSection(tab: AdminTab) {
    if (tab === 'dashboard') return;
    if (tab === 'resellers' || tab === 'reseller-tasks' || tab === 'rewards') {
      router.push('/admin/reseller-tasks');
      return;
    }
    router.push(`/admin/${tab}`);
  }

  return (
    <main className="min-h-screen bg-[#F4F4F1]">
      <AdminHeader
        activeTab="dashboard"
        onTabChange={openSection}
        onLogout={() => void logout()}
        stats={{ totalProducts: products.length, totalOrders: orders.length }}
      />
      <DashboardStats products={products} orders={orders} vendorRequests={vendorRequests} />
    </main>
  );
}
