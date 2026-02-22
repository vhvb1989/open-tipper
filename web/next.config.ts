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
    ],
  },
};

export default nextConfig;
