import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_URL ?? "https://nearcare-backend-production.up.railway.app";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.10.74"],
  // The v2 pages became the only pages and took the clean URLs. These entries
  // ran the other way while v1 still existed; they are kept, reversed, so old
  // bookmarks and tabs still land somewhere real.
  async redirects() {
    return [
      {
        source: "/dashboard/homev2",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/dashboard/family-overviewv2",
        destination: "/dashboard/family-overview",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${backendUrl}/auth/:path*`,
      },
      {
        source: "/family/:path*",
        destination: `${backendUrl}/family/:path*`,
      },
    ];
  },
};

export default nextConfig;
