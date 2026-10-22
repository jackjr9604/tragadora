import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === 'development'

function supabaseBrowserOrigins() {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!configured) return []
  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return []
    const realtime = new URL(url.origin)
    realtime.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return [url.origin, realtime.origin]
  } catch {
    return []
  }
}

const connectSources = ["'self'", ...supabaseBrowserOrigins()]
if (isDevelopment) connectSources.push('http:', 'ws:')

const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'" + (isDevelopment ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSources.join(' ')}`,
  "frame-src 'self'",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=(), clipboard-write=(self), fullscreen=(self)',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicyReportOnly },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
};

export default nextConfig;
