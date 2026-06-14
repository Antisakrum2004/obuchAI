import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: "standalone" removed — Vercel uses its own optimized build output.
  // Using "standalone" was causing serverless function timeouts for ALL dynamic pages.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  experimental: {
    viewTransition: true,
  },
  images: {
    unoptimized: false,
  },
};

export default nextConfig;
