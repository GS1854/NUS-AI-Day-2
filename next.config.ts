import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ];
    const contentSecurityPolicy = process.env.NODE_ENV === 'production'
      ? { key: 'Content-Security-Policy', value: "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" }
      : null;
    return [{
      source: '/(.*)',
      headers: contentSecurityPolicy ? [contentSecurityPolicy, ...securityHeaders] : securityHeaders,
    }];
  },
};

export default nextConfig;
