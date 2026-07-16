import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdfjs-dist",
    "@napi-rs/canvas",
    "@napi-rs/canvas-win32-x64-msvc",
  ],

  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;