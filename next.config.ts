import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_URL ?? "https://nearcare-backend-production.up.railway.app";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.10.74"],
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/homev2",
        permanent: false,
      },
      {
        source: "/dashboard/family-overview",
        destination: "/dashboard/family-overviewv2",
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
