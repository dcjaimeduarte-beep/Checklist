import type { NextConfig } from "next";

const apiInternalUrl = process.env["API_INTERNAL_URL"] ?? "http://127.0.0.1:3333";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3333",
  },
  async rewrites() {
    return [
      {
        source: "/api-backend/:path*",
        destination: `${apiInternalUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
