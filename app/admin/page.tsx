'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import RewardsTermsManager from '@/components/admin/RewardsTermsManager';
import ResellerWhatsAppRequests from '@/components/admin/ResellerWhatsAppRequests';
import AdminResellersPage from './resellers/page';
import ResellerTasksAdminPage from './reseller-tasks/page';
import { adminCollection, type Order, type Product, type VendorRequest } from '@/components/admin/shared';
export default function AdminPage(){return <AdminAuthGuard><AdminPanel/></AdminAuthGuard>}
function AdminPanel(){const router=useRouter();const [activeTab,setActiveTab]=useState<AdminTab>('dashboard');const [search,setSearch]=useState('');const [products,setProducts]=useState<Product[]>([]);const [orders,setOrders]=useState<Order[]>([]);const [vendorRequests,setVendorRequests]=useState<VendorRequest[]>([]);useEffect(()=>{const a=onSnapshot(adminCollection('products'),s=>setProducts(s.docs.map(d=>({id:d.id,...d.data()}) as Product)));const b=onSnapshot(adminCollection('orders'),s=>setOrders(s.docs.map(d=>({id:d.id,...d.data()}) as Order)));const c=onSnapshot(adminCollection('vendor_submissions'),s=>setVendorRequests(s.docs.map(d=>({id:d.id,...d.data()}) as VendorRequest)));return()=>{a();b();c()}},[]);function logout(){window.localStorage.removeItem('admin_session_auth');router.replace('/admin')}function render(){switch(activeTab){case'dashboard':return <DashboardStats products={products} orders={orders} vendorRequests={vendorRequests}/>;case'products':return <ProductsManager/>;case'categories':return <CategoriesManager/>;case'deals':return <DealScheduleManager/>;case'rewards':return <><RewardsManager/><RewardsTermsManager/></>;case'orders':return <OrdersManager/>;case'reseller-whatsapp':return <ResellerWhatsAppRequests/>;case'resellers':return <AdminResellersPage/>;case'reseller-tasks':return <ResellerTasksAdminPage/>;case'suppliers':return <VendorRequests/>;case'settings':return <SiteSettingsManager/>}}return <main className="min-h-screen bg-[#F4F4F1]"><AdminHeader activeTab={activeTab} onTabChange={setActiveTab} onLogout={logout} search={search} onSearchChange={setSearch} stats={{totalProducts:products.length,totalOrders:orders.length}}/>{render()}</main>}
