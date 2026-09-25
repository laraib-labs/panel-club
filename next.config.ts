import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(process.cwd()),
  serverExternalPackages: ["node:sqlite"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        // /upcoming folded into Discover's hero + upcoming strip (redesign-2026.md).
        source: "/upcoming",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
