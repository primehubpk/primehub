// app/layout.tsx
// Root layout — loads fonts, sets metadata, mounts the fixed BottomNav
// shell so it persists across every route (not just the homepage).

import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter, Space_Mono } from 'next/font/google';
import BottomNav from '@/components/BottomNav';
import './globals.css';
import CartDrawer from '@/components/CartDrawer';
import PWARegister from '@/components/PWARegister';

// =====================================================================
// SECTION: FONTS
// Display -> Space Grotesk (headlines, prices)
// Body    -> Inter (paragraphs, labels)
// Mono    -> Space Mono (countdown timer, price digits)
// =====================================================================
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-display',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
});

// =====================================================================
// SECTION: METADATA
// =====================================================================
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  title: 'PrimeHub Deals | Daily Dollar Deals & Flash Sales',
  description:
    'PrimeHub Deals (phdeals) — daily flash sales, weekend glow deals, and gamified rewards. Worldwide delivery, WhatsApp ordering.',
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  applicationName: 'PrimeHub Deals',
  generator: 'Next.js',
  keywords: ['PrimeHub Deals', 'phdeals', 'daily deals', 'flash sales', 'online shopping'],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'PrimeHub Deals',
    description: 'Daily flash sales, weekend glow deals, and gamified rewards.',
    type: 'website',
    ...(SITE_URL ? { url: SITE_URL } : {}),
    siteName: 'PrimeHub Deals',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PrimeHub Deals',
    description: 'Daily flash sales, weekend glow deals, and gamified rewards.',
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

// =====================================================================
// SECTION: ROOT LAYOUT
// =====================================================================
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${spaceMono.variable}`}>
      <body className="font-sans antialiased pb-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'PrimeHub Deals',
              alternateName: 'phdeals',
              url: SITE_URL || undefined,
              description: 'Daily flash sales, weekend glow deals, and gamified rewards.',
              potentialAction: {
                '@type': 'SearchAction',
                target: `${SITE_URL || ''}/shop?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        {/* Page content (each route's page.tsx renders here) */}
        {children}

        {/* SECTION 9: MOBILE BOTTOM NAVIGATION BAR — fixed, persists on
            every route. Rendered here (not in page.tsx) so it never has
            to be re-imported per page. */}
        <BottomNav />
        <CartDrawer />
        <PWARegister />
      </body>
    </html>
  );
}
