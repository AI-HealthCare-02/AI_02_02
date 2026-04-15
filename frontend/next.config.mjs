/** @type {import('next').NextConfig} */
const backendProxyTarget = process.env.BACKEND_PROXY_TARGET || 'http://127.0.0.1:8000';
const distDir = process.env.NODE_ENV === 'development' ? '.next-dev' : '.next';

const nextConfig = {
  distDir,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
