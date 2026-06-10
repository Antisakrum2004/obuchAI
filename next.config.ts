import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    viewTransition: true,
  },
  // Exclude heavy native modules from serverless bundle
  // sharp (33MB) is NOT used in source code — Vercel handles image optimization
  // These cause serverless function timeouts on Vercel due to 79MB bundle
  serverExternalPackages: ["sharp"],
  images: {
    // Use Vercel's image optimization instead of sharp
    unoptimized: false,
  },
};

export default nextConfig;
