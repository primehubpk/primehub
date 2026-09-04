import type { Metadata } from 'next';
import ProductRewardInfo from '@/components/ProductRewardInfo';
import WeeklyDealProductExtras from '@/components/WeeklyDealProductExtras';
import { getAdminDb } from '@/lib/firebaseAdmin';

type ProductMetadata = {
  title?: string;
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  image?: string;
  images?: Array<string | { url?: string }>;
  stock?: number;
  quantity?: number;
  active?: boolean;
  category?: string;
};

function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || 'https://primehubmall.com';
  return configured.startsWith('http') ? configured.replace(/\/$/, '') : `https://${configured.replace(/\/$/, '')}`;
}

function productImage(product: ProductMetadata) {
  const first = product.images?.[0];
  const image = (typeof first === 'string' ? first : first?.url) || product.imageUrl || product.image || '';
  if (!image || image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${siteUrl()}${image.startsWith('/') ? '' : '/'}${image}`;
}

async function loadProduct(id: string) {
  try {
    const snapshot = await getAdminDb().collection('products').doc(id).get();
    if (!snapshot.exists) return null;
    return snapshot.data() as ProductMetadata;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params);
  const id = decodeURIComponent(resolved.id || '');
  const url = `${siteUrl()}/product/${encodeURIComponent(id)}`;
  const product = await loadProduct(id);

  if (!product || product.active === false) {
    return {
      title: 'Product not found',
      alternates: { canonical: url },
      robots: { index: false, follow: true },
    };
  }

  const title = String(product.title || product.name || 'PrimeHubMall Product').trim();
  const description = String(
    product.description || `${title}${product.price ? ` — Rs. ${Number(product.price).toLocaleString()}` : ''}. Shop retail and wholesale deals at PrimeHubMall Pakistan.`,
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  const image = productImage(product);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | PrimeHubMall`,
      description,
      url,
      siteName: 'PrimeHubMall',
      type: 'website',
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | PrimeHubMall`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const id = decodeURIComponent(resolved.id || '');
  const product = await loadProduct(id);
  const title = String(product?.title || product?.name || '').trim();
  const image = product ? productImage(product) : '';
  const price = Number(product?.price || 0);
  const stock = Number(product?.stock ?? product?.quantity ?? 0);

  const productSchema = product && product.active !== false && title ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description: String(product.description || '').trim() || undefined,
    image: image || undefined,
    category: product.category || undefined,
    sku: id,
    brand: { '@type': 'Brand', name: 'PrimeHubMall' },
    ...(price > 0 ? {
      offers: {
        '@type': 'Offer',
        priceCurrency: 'PKR',
        price,
        availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: `${siteUrl()}/product/${encodeURIComponent(id)}`,
      },
    } : {}),
  } : null;

  return <>
    {productSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />}
    <ProductRewardInfo productId={id}/>
    {children}
    <WeeklyDealProductExtras productId={id}/>
  </>;
}
