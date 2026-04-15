import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Remove X-Powered-By header to reduce response size + hide tech stack
  poweredByHeader: false,

  // Enable gzip/brotli compression
  compress: true,

  experimental: {
    // Tree-shake large icon/UI packages — only import what's used
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      'recharts',
    ],

    // Client-side router cache TTL tuning
    // dynamic: 0  → don't cache dynamic pages (each navigation re-fetches from server)
    // static: 300 → cache static pages for 5 min (public marketing pages)
    // This prevents stale dashboard data while keeping public page transitions instant.
    staleTimes: {
      dynamic: 0,
      static: 300,
    },
  },

  async rewrites() {
    return [
      {
        source: "/:city([a-z0-9-]+)-veteriner",
        destination: "/veteriner-sehir/:city",
      },
    ];
  },

  images: {
    // Serve WebP + AVIF automatically
    formats: ["image/avif", "image/webp"],
    // Accept images from Supabase Storage and Unsplash
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    // Allowed resize widths (covers avatars 400px, pets 800px, OG 1200px)
    deviceSizes: [400, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 128, 256, 400, 800],
    // Minimum cache TTL for optimised images: 7 days
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  async headers() {
    return [
      // Security headers on all routes
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + inline eval needed for Next.js hydration
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Styles: self + inline (Tailwind / shadcn inject inline styles)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts: self + Google Fonts CDN (loaded by next/font)
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + data URIs + Supabase Storage + Unsplash
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://images.unsplash.com",
              // API connections: self + Supabase REST/WS + Agora
              "connect-src 'self' https://*.supabase.co https://*.supabase.in " +
                "wss://*.supabase.co wss://*.supabase.in " +
                "https://*.agora.io wss://*.agora.io " +
                "https://api.ileti-merkezi.com",
              // Media: blob for video/audio streams
              "media-src 'self' blob:",
              // Workers: blob for Agora SDK
              "worker-src 'self' blob:",
              // Frames: deny
              "frame-src 'none'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      // Cache public assets (fonts, icons, etc.) — /_next/* managed by Next.js internally
      {
        source: "/(.*)\\.(ico|svg|png|jpg|jpeg|webp|woff2|woff)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=3600" },
        ],
      },
    ];
  },

};

// Sentry — uploads source maps and instruments server/edge routes.
// Silent in CI; set SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT in env.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only upload source maps when auth token is provided (CI/CD)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  // Disable source map upload in local dev
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },
  // Suppress "Sentry SDK is not configured" warning when DSN is not set
  disableLogger: true,
  // Avoid adding Sentry to every API route bundle — opt-in per route instead
  automaticVercelMonitors: false,
});
