import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: "standalone" removed — Vercel uses its own optimized build output.
  // Using "standalone" was causing serverless function timeouts for ALL dynamic pages.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    viewTransition: true,
  },
  // Exclude heavy native modules from serverless bundle
  serverExternalPackages: ["sharp"],
  images: {
    unoptimized: false,
  },
};

export default nextConfig;
