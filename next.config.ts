import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "exceljs", "pg"],
  experimental: {
    // Product photos are resized in the browser before upload, so 4 MB is plenty.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
