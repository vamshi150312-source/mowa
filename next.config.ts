import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the project root (a stray lockfile higher up confuses Next's auto-detection).
  outputFileTracingRoot: path.resolve(__dirname),
  // The API is the Spring Boot backend in backend/. Proxying it keeps the browser on one
  // origin, so the session cookie, uploads and media URLs work the same as before.
  experimental: {
    // Proxied request bodies are capped at 10 MB by default; videos can be up to 50 MB.
    middlewareClientMaxBodySize: "60mb",
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.API_URL ?? "http://127.0.0.1:8080"}/api/:path*` }];
  },
};

export default nextConfig;
