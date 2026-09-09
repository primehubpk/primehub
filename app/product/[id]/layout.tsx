import type { Metadata } from 'next';
import ProductRewardInfo from '@/components/ProductRewardInfo';
import WeeklyDealProductExtras from '@/components/WeeklyDealProductExtras';

function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || 'https://primehubmall.com';
  return configured.startsWith('http')
    ? configured.replace(/\/$/, '')
    : `https://${configured.replace(/\/$/, '')}`;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolved = await Promise.resolve(params);
  const id = decodeURIComponent(resolved.id || '');
  const url = `${siteUrl()}/product/${encodeURIComponent(id)}`;
  const title = 'PrimeHubMall Product';
  const description =
    'Shop this product at PrimeHubMall Pakistan. Explore retail prices, wholesale deals and nationwide delivery.';

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
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | PrimeHubMall`,
      description,
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

  return (
    <>
      <ProductRewardInfo productId={id} />
      {children}
      <WeeklyDealProductExtras productId={id} />
    </>
  );
}
