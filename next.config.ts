import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Property submissions carry up to 6 downscaled photos in the form body.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async redirects() {
    return [
      { source: "/premium", destination: "/properties?listing=premium", permanent: false },
      { source: "/resale", destination: "/properties?listing=resale", permanent: false },
      { source: "/listings", destination: "/properties", permanent: false },
      { source: "/broker", destination: "/submit", permanent: false },
    ];
  },
};

export default nextConfig;
