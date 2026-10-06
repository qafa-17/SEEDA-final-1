import type { NextConfig } from "next";

// Security headers sent with every response.
const securityHeaders = [
  // Stop other sites embedding this app in a frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  // Stop browsers guessing file types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send the origin (not full URLs) to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // This app never needs these device features.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Always use HTTPS once visited.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The Dashboard used to live at /board; old links and bookmarks still work.
  async redirects() {
    return [{ source: "/board", destination: "/dashboard", permanent: true }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
