import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PrimeHubMall',
    short_name: 'PrimeHubMall',
    description: 'PrimeHubMall retail and wholesale shopping in Pakistan.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#14140F',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
