import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminAuthGuard from '@/components/AdminAuthGuard';

export default function ResellerTasksAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <main className="min-h-screen bg-[#F4F4F1] text-[#14140F]">
        <div className="border-b border-black/8 bg-white px-4 py-3">
          <div className="mx-auto max-w-6xl">
            <Link href="/admin" className="inline-flex items-center gap-2 rounded-full bg-[#F4F4F1] px-3 py-2 text-[10px] font-black text-black/60">
              <ArrowLeft size={14} /> Back to Admin
            </Link>
          </div>
        </div>
        {children}
      </main>
    </AdminAuthGuard>
  );
}
