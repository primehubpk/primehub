// app/layout.tsx
// Root layout — loads fonts, sets metadata, mounts the fixed BottomNav
// shell so it persists across every route (not just the homepage).

import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter, Space_Mono } from 'next/font/google';
import BottomNav from '@/components/BottomNav';
import './globals.css';

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
export const metadata: Metadata = {
  title: 'PrimeHub Deals | Daily Dollar Deals & Flash Sales',
  description:
    'PrimeHub Deals (phdeals) — daily flash sales, weekend glow deals, and gamified rewards. Worldwide delivery, WhatsApp ordering.',
  metadataBase: new URL('https://phdeals.example.com'),
  openGraph: {
    title: 'PrimeHub Deals',
    description: 'Daily flash sales, weekend glow deals, and gamified rewards.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#14140F',
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
        {/* Page content (each route's page.tsx renders here) */}
        {children}

        {/* SECTION 9: MOBILE BOTTOM NAVIGATION BAR — fixed, persists on
            every route. Rendered here (not in page.tsx) so it never has
            to be re-imported per page. */}
        <BottomNav />
      </body>
    </html>
  );
}
