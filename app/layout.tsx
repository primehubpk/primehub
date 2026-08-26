// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/space-grotesk/wght.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import BottomNav from '@/components/BottomNav';
import CartMiniBar from '@/components/CartMiniBar';
import PWARegister from '@/components/PWARegister';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import GlobalVariantSelector from '@/components/GlobalVariantSelector';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: 'PrimeHub Deals | Daily Dollar Deals & Flash Sales',
  description: 'PrimeHub Deals (phdeals) — daily flash sales, weekend glow deals, and gamified rewards. Worldwide delivery, WhatsApp ordering.',
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}), applicationName: 'PrimeHub Deals', generator: 'Next.js',
  keywords: ['PrimeHub Deals', 'phdeals', 'daily deals', 'flash sales', 'online shopping'], alternates: { canonical: '/' },
  openGraph: { title: 'PrimeHub Deals', description: 'Daily flash sales, weekend glow deals, and gamified rewards.', type: 'website', ...(SITE_URL ? { url: SITE_URL } : {}), siteName: 'PrimeHub Deals' },
  twitter: { card: 'summary_large_image', title: 'PrimeHub Deals', description: 'Daily flash sales, weekend glow deals, and gamified rewards.' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
};

export const viewport: Viewport = { themeColor: '#14140F', colorScheme: 'light', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased pb-24">
        <script dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'PrimeHub Deals', alternateName: 'phdeals', url: SITE_URL || undefined, description: 'Daily flash sales, weekend glow deals, and gamified rewards.', potentialAction: { '@type': 'SearchAction', target: `${SITE_URL || ''}/shop?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }) }} />
        {children}
        <GlobalVariantSelector />
        <BottomNav />
        <CartMiniBar />
        <PWARegister />
        <PWAInstallBanner />
      </body>
    </html>
  );
}
