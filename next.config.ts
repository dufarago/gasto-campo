import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA service worker is registered from /public/sw.js
  // Permite abrir o dev server no iPhone / rede local
  allowedDevOrigins: ["192.168.0.179", "192.168.0.110"],
};

export default nextConfig;
