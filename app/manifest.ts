import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PrimeHub Deals',
    short_name: 'phdeals',
    description: 'Daily deals, flash sales and gamified shopping from PrimeHub Deals.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F4F1',
    theme_color: '#14140F',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
}
