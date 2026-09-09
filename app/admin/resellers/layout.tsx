import AdminAuthGuard from '@/components/AdminAuthGuard';

export default function ResellersAdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthGuard>{children}</AdminAuthGuard>;
}
