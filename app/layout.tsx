// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import BottomNav from '@/components/BottomNav';
import GlobalFooter from '@/components/GlobalFooter';
import CartMiniBar from '@/components/CartMiniBar';
import PWARegister from '@/components/PWARegister';
import GlobalVariantSelector from '@/components/GlobalVariantSelector';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const BRAND_NAME = 'PrimeHubMall';
const BRAND_ALIASES = ['Prime Hub Mall', 'PrimeHub Mall', 'Prime Hub', 'PrimeHub Deals', 'Prime Hub Deals'];
const SITE_DESCRIPTION =
  'Shop bangles, jewellery, watches, retail and wholesale deals at PrimeHubMall Pakistan. Discover new arrivals, special offers and nationwide delivery.';

export const metadata: Metadata = {
  title: {
    default: 'PrimeHubMall | Retail & Wholesale Shopping in Pakistan',
    template: '%s | PrimeHubMall',
  },
  description: SITE_DESCRIPTION,
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  applicationName: BRAND_NAME,
  generator: 'Next.js',
  keywords: [
    'PrimeHubMall',
    'Prime Hub Mall',
    'PrimeHub Mall',
    'Prime Hub',
    'PrimeHub Deals',
    'Prime Hub Deals',
    'PrimeHub Mall Pakistan',
    'online shopping Pakistan',
    'retail shopping Pakistan',
    'wholesale shopping Pakistan',
    'bangles Pakistan',
    'jewellery Pakistan',
    'watches Pakistan',
    'wholesale deals',
  ],
  alternates: { canonical: '/' },
  verification: {
    other: {
      'facebook-domain-verification': 'fvnxoqhor4zrphzqp0gfvnrfmb4n50',
    },
  },
  openGraph: {
    title: 'PrimeHubMall | Retail & Wholesale Shopping in Pakistan',
    description: SITE_DESCRIPTION,
    type: 'website',
    ...(SITE_URL ? { url: SITE_URL } : {}),
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PrimeHubMall | Retail & Wholesale Shopping in Pakistan',
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#14140F',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND_NAME,
    alternateName: BRAND_ALIASES,
    url: SITE_URL || undefined,
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL || ''}/shop?q={search_term_string}`,
      'query-input': 'required name={search_term_string}',
    },
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME,
    alternateName: BRAND_ALIASES,
    url: SITE_URL || undefined,
    description: SITE_DESCRIPTION,
  };

  return (
    <html lang="en">
      <body className="font-sans antialiased pb-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {children}
        <GlobalFooter />
        <GlobalVariantSelector />
        <BottomNav />
        <CartMiniBar />
        <PWARegister />
      </body>
    </html>
  );
}
