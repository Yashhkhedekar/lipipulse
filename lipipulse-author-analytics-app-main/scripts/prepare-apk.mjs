#!/usr/bin/env node
/**
 * Prepares a static (server-less) build for the Capacitor Android APK.
 *
 * The hosted web app uses /api/scan as a proxy so the author never needs a key,
 * but an installed APK has no server. This script therefore:
 *   1. removes the API route handlers (unsupported by `next build --export`)
 *   2. runs `next build` with STATIC_EXPORT=1 so it emits plain files into ./out
 *
 * The Gemini call itself already works fully client-side (src/lib/gemini.ts),
 * so screenshot scanning keeps working on the phone.
 */
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const apiDir = join(root, "src", "app", "api");
const outDir = join(root, "out");

for (const dir of [apiDir, outDir]) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`[apk] removed ${dir}`);
  }
}

execSync("npx next build", {
  stdio: "inherit",
  env: { ...process.env, STATIC_EXPORT: "1" },
});

if (!existsSync(join(outDir, "index.html"))) {
  console.error("[apk] static export did not produce out/index.html");
  process.exit(1);
}
console.log("[apk] static export ready in ./out");
