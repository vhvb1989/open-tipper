import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google user avatars
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // GitHub user avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Microsoft / Entra ID user avatars
      { protocol: "https", hostname: "graph.microsoft.com" },
      // Football competition emblems & team logos (API-Football / media.api-sports.io)
      { protocol: "https", hostname: "media.api-sports.io" },
      // DiceBear avatars (used by demo seed data)
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
