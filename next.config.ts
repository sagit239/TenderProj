import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a phone on the home Wi-Fi open the dev server by the computer's local IP
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
