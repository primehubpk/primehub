import type { Metadata } from 'next';
import ProductRewardInfo from '@/components/ProductRewardInfo';
import WeeklyDealProductExtras from '@/components/WeeklyDealProductExtras';
import { getAdminDb } from '@/lib/firebaseAdmin';

type ProductMetadata = { title?: string; name?: string; description?: string; price?: number; imageUrl?: string; image?: string; images?: Array<string | { url?: string }> };

function siteUrl() {
 const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://primehub-one.vercel.app';
 return configured.startsWith('http') ? configured.replace(/\/$/, '') : `https://${configured.replace(/\/$/, '')}`;
}

function productImage(product: ProductMetadata) {
 const first = product.images?.[0];
 const image = (typeof first === 'string' ? first : first?.url) || product.imageUrl || product.image || '';
 if (!image || image.startsWith('http://') || image.startsWith('https://')) return image;
 return `${siteUrl()}${image.startsWith('/') ? '' : '/'}${image}`;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
 const url = `${siteUrl()}/product/${encodeURIComponent(params.id)}`;
 try {
  const snapshot = await getAdminDb().collection('products').doc(params.id).get();
  if (!snapshot.exists) return { title: 'Product not found | PrimeHub Deals', alternates: { canonical: url } };
  const product = snapshot.data() as ProductMetadata;
  const title = product.title || product.name || 'PrimeHub Deal';
  const description = String(product.description || `${title}${product.price ? ` — Rs. ${Number(product.price).toLocaleString()}` : ''}. Shop now on PrimeHub Deals.`).slice(0, 180);
  const image = productImage(product);
  return {
   title: `${title} | PrimeHub Deals`,
   description,
   alternates: { canonical: url },
   openGraph: { title, description, url, siteName: 'PrimeHub Deals', type: 'website', ...(image ? { images: [{ url: image, alt: title }] } : {}) },
   twitter: { card: 'summary_large_image', title, description, ...(image ? { images: [image] } : {}) },
  };
 } catch {
  return { title: 'PrimeHub Product', description: 'View this product on PrimeHub Deals.', alternates: { canonical: url }, openGraph: { title: 'PrimeHub Product', description: 'View this product on PrimeHub Deals.', url, siteName: 'PrimeHub Deals', type: 'website' } };
 }
}

export default function ProductLayout({children,params}:{children:React.ReactNode;params:{id:string}}){
 return <><ProductRewardInfo productId={params.id}/>{children}<WeeklyDealProductExtras productId={params.id}/></>;
}
