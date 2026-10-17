import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Property submissions carry up to 8 downscaled photos (15 for rentals) in the form body, within
    // one shared photo budget (docs/photo-uploads.md).
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
