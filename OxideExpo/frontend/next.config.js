/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Proxy API calls to backend
  // This allows the frontend to use relative URLs (/api/...)
  // which works from both host browser and Playwright inside container
  async rewrites() {
    // Use backend container name when running in Docker, localhost otherwise
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
