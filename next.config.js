/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
    images: {
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [
          { protocol: 'https', hostname: 'i.ibb.co', pathname: '/**' },
          { protocol: 'https', hostname: 'ibb.co', pathname: '/**' },
          {
            protocol: 'https',
            hostname: 'images.primehubmall.com',
            pathname: '/**',
          },
          {
            protocol: 'https',
            hostname: 'pub-157b90419bf04016bdea666e4cbce181.r2.dev',
            pathname: '/**',
          },
        ],
    },
  async headers() {
    return [
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;