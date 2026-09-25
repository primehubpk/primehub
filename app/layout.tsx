// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import BottomNav from '@/components/BottomNav';
import GlobalFooter from '@/components/GlobalFooter';
import CartMiniBar from '@/components/CartMiniBar';
import PWARegister from '@/components/PWARegister';
import VisitorTracker from '@/components/VisitorTracker';
import GlobalVariantSelector from '@/components/GlobalVariantSelector';
import AdminQuickAccess from '@/components/AdminQuickAccess';
import SalarViewportShell from '@/components/salar/SalarViewportShell';
import { SettingsProvider } from '@/lib/useSettings';
import { TIKTOK_PIXEL_ID } from '@/lib/tiktokConfig';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const BRAND_NAME = 'PrimeHubMall';
const BRAND_ALIASES = ['Prime Hub Mall', 'PrimeHub Mall', 'Prime Hub', 'PrimeHub Deals', 'Prime Hub Deals'];
const SITE_DESCRIPTION =
  'Shop bangles, jewellery, watches, retail and wholesale deals at PrimeHubMall Pakistan. Discover new arrivals, special offers and nationwide delivery.';
const SOCIAL_IMAGE = 'https://images.primehubmall.com/products/1766930358870-fbc575bb0ca3.webp';

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
    images: [
      {
        url: SOCIAL_IMAGE,
        alt: 'PrimeHubMall bangles and jewellery shopping',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PrimeHubMall | Retail & Wholesale Shopping in Pakistan',
    description: SITE_DESCRIPTION,
    images: [SOCIAL_IMAGE],
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
      'query-input': 'required name=search_term_string',
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
      <head>
        <link rel="preconnect" href="https://images.primehubmall.com" />
        <link rel="dns-prefetch" href="https://images.primehubmall.com" />
        <link rel="dns-prefetch" href="https://i.ibb.co" />
      </head>
      <body className="font-sans antialiased pb-24">
        <VisitorTracker />
        <Script id="tiktok-pixel" strategy="afterInteractive">{`
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

  ttq.load('${TIKTOK_PIXEL_ID}');
  ttq.page();
}(window, document, 'ttq');
`}</Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <BottomNav />
        <SettingsProvider>
          {children}
          <GlobalFooter />
          <GlobalVariantSelector />
          <CartMiniBar />
          <AdminQuickAccess />
          <PWARegister />
          <SalarViewportShell />
        </SettingsProvider>
      </body>
    </html>
  );
}
