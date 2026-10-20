import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Proxy the FastAPI inference service so relative-path API calls work
  // regardless of entry point:
  //  - through the Caddy gateway (?XTransformPort=8000 routes to :8000)
  //  - directly against this server (:3000) in local dev / preview
  async rewrites() {
    const api = process.env.CREDIT_RISK_API_ORIGIN ?? "http://localhost:8000";
    return [
      { source: "/health", destination: `${api}/health` },
      { source: "/predict", destination: `${api}/predict` },
      { source: "/model/:path*", destination: `${api}/model/:path*` },
    ];
  },
};

export default nextConfig;
