import type { NextConfig } from "next";

const cloudflareFreeBuild = process.env.CLOUDFLARE_FREE_BUILD === "true";

const nextConfig: NextConfig = {
  turbopack: cloudflareFreeBuild
    ? {
        resolveAlias: {
          "@/gift-certificates/cleanup":
            "./src/gift-certificates/cloudflare-free/cleanup.ts",
          "@/gift-certificates/outbox":
            "./src/gift-certificates/cloudflare-free/outbox.ts",
          "@/gift-certificates/stripe-client":
            "./src/gift-certificates/cloudflare-free/stripe-client.ts",
        },
      }
    : undefined,
};

export default nextConfig;
