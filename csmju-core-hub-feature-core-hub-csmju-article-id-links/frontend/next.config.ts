import type { NextConfig } from "next";
import path from "path";

/**
 * Response headers every page and route handler carries. HSTS is left to the
 * TLS-terminating reverse proxy, and there is no CSP yet — Next's inline
 * bootstrap scripts need a nonce-based policy, which is a follow-up.
 */
const securityHeaders = [
  // The portal is never meant to be framed; blocks clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Browsers must not sniff a response into a different type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send the origin (never the path/query) to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses none of these device APIs.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  // Self-contained server (node server.js) for the Docker image: only the
  // files the app really needs, instead of the whole node_modules tree.
  output: "standalone",
  // pnpm workspace: dependencies are hoisted to the repository root, so the
  // trace has to start there or the standalone bundle misses them.
  outputFileTracingRoot: path.join(__dirname, ".."),
  // No `X-Powered-By: Next.js` fingerprint.
  poweredByHeader: false,
  images: {
    // Article thumbnails on the public landing page come from csmju.com.
    remotePatterns: [
      { protocol: "https", hostname: "csmju.com", pathname: "/files/**" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
