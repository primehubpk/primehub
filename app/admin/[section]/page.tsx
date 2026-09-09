'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import AdminAuthGuard from '@/components/AdminAuthGuard';
import ProductsManager from '@/components/admin/ProductsManager';
import BulkProductEditor from '@/components/admin/BulkProductEditor';
import CategoriesManager from '@/components/admin/CategoriesManager';
import DealScheduleManager from '@/components/admin/DealScheduleManager';
import BigDealManager from '@/components/admin/BigDealManager';
import SkillsManager from '@/components/admin/SkillsManager';
import OrdersManager from '@/components/admin/OrdersManager';
import VendorRequests from '@/components/admin/VendorRequests';
import SiteSettingsManager from '@/components/admin/SiteSettingsManager';
import RewardsManager from '@/components/admin/RewardsManager';
import RewardsTermsManager from '@/components/admin/RewardsTermsManager';
import ResellerWhatsAppRequests from '@/components/admin/ResellerWhatsAppRequests';
import WhatsAppCoexistenceSetup from '@/components/admin/WhatsAppCoexistenceSetup';
import WholesaleVideoManager from '@/components/admin/WholesaleVideoManager';
import SalarManager from '@/components/admin/SalarManager';

type SectionDefinition = {
  title: string;
  eyebrow: string;
  description: string;
  content: React.ReactNode;
};

const SECTIONS: Record<string, SectionDefinition> = {
  products: {
    title: 'Products',
    eyebrow: 'Catalog',
    description: 'Manage PrimeHubMall products on a focused admin page.',
    content: <ProductsManager />,
  },
  'product-editor': {
    title: 'Product Editor',
    eyebrow: 'Catalog',
    description: 'Bulk product editing without the dashboard navigation taking over the screen.',
    content: <BulkProductEditor />,
  },
  categories: {
    title: 'Categories',
    eyebrow: 'Catalog',
    description: 'Create and manage storefront categories.',
    content: <CategoriesManager />,
  },
  deals: {
    title: 'One Day Deals',
    eyebrow: 'Deals',
    description: 'Manage the weekly one-day deal schedule.',
    content: <DealScheduleManager />,
  },
  'big-deal': {
    title: 'Big Deal',
    eyebrow: 'Deals',
    description: 'Build the PrimeHubMall Big Deal rotation from one to seven deals.',
    content: <BigDealManager />,
  },
  skills: {
    title: 'Prime Skills',
    eyebrow: 'Content',
    description: 'Manage Prime Skills from its own workspace.',
    content: <SkillsManager />,
  },
  rewards: {
    title: 'Rewards',
    eyebrow: 'Rewards',
    description: 'Manage reward settings and reward terms.',
    content: <><RewardsManager /><RewardsTermsManager /></>,
  },
  'video-hub': {
    title: 'Video Hub',
    eyebrow: 'Content',
    description: 'Manage wholesale video packages.',
    content: <WholesaleVideoManager />,
  },
  orders: {
    title: 'Orders',
    eyebrow: 'Orders',
    description: 'Review and manage customer orders.',
    content: <OrdersManager />,
  },
  salar: {
    title: 'Salar',
    eyebrow: 'Assistant',
    description: 'Phase 1 visibility and provider health controls.',
    content: <SalarManager />,
  },
  'reseller-whatsapp': {
    title: 'Reseller WhatsApp',
    eyebrow: 'Reseller',
    description: 'Review reseller WhatsApp order requests.',
    content: <ResellerWhatsAppRequests />,
  },
  'whatsapp-bot': {
    title: 'WhatsApp Bot',
    eyebrow: 'WhatsApp',
    description: 'Manage WhatsApp bot setup and coexistence.',
    content: <WhatsAppCoexistenceSetup />,
  },
  suppliers: {
    title: 'Suppliers',
    eyebrow: 'Supply',
    description: 'Review supplier submissions and requests.',
    content: <VendorRequests />,
  },
  settings: {
    title: 'Settings',
    eyebrow: 'Store',
    description: 'Manage storefront settings on a clean dedicated page.',
    content: <SiteSettingsManager />,
  },
};

export default function AdminSectionPage() {
  const params = useParams<{ section: string }>();
  const key = String(params?.section || '');
  const section = SECTIONS[key];

  return (
    <AdminAuthGuard>
      <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
        <section className="border-b border-black/8 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-full bg-[#F4F4F1] px-3 py-2 text-[10px] font-black text-black/60 transition hover:text-black">
              <ArrowLeft size={14} /> Back to Admin
            </Link>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#E1352B]">{section?.eyebrow || 'Admin'}</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight">{section?.title || 'Admin section'}</h1>
                <p className="mt-1 max-w-xl text-xs leading-5 text-black/45">{section?.description || 'This admin section could not be found.'}</p>
              </div>
              <LayoutGrid size={20} className="shrink-0 text-black/15" />
            </div>
          </div>
        </section>

        {section ? section.content : (
          <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
            <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
              <h2 className="text-lg font-black">Section not found</h2>
              <p className="mt-2 text-xs text-black/45">Return to the Admin dashboard and choose an available icon.</p>
              <Link href="/admin" className="mt-5 inline-flex rounded-full bg-[#14140F] px-4 py-3 text-xs font-black text-white">Open Admin</Link>
            </div>
          </section>
        )}
      </main>
    </AdminAuthGuard>
  );
}
