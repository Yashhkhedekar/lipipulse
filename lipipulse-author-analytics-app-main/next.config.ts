import type { NextConfig } from "next";

/**
 * Hosted web app  → normal build, keeps /api/scan so a key is optional.
 * APK build       → STATIC_EXPORT=1 emits plain files into ./out for Capacitor.
 */
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = staticExport
  ? {
      output: "export",
      trailingSlash: false,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
