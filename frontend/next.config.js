/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.nba.com',
        pathname: '/headshots/nba/latest/**',
      },
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
        pathname: '/**',
      },
    ],
  },
  experimental: {
  serverActions: {
    bodySizeLimit: '2mb'  // Object format required in Next.js 16+
  },
},
}

module.exports = nextConfig
