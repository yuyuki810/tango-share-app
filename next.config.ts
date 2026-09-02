import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {}, // Next.js 16 Turbopack 互換フラグ
};

// 開発時は Turbopack で高速起動し、本番ビルド (next build) 時のみ Serwist PWA を適用
export default isDev
  ? nextConfig
  : require("@serwist/next").default({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
      reloadOnOnline: true,
    })(nextConfig);
