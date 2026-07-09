import type { NextConfig } from "next";

const backendUrl =
  process.env.BACKEND_URL ?? "https://nearcare-backend-production.up.railway.app";

const nextConfig: NextConfig = {
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
