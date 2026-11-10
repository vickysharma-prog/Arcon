import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // local checks sign in a different test role on each host (scripts/role-sessions.ts); dev only
  allowedDevOrigins: ["127.0.0.1", "*.localhost"],
  // The service worker is always fetched fresh, so an update reaches installed apps at once.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Mounts every agent under agents/<name>/ at /eve/<name>/v1/* on the same origin as the app.
export default withEve(nextConfig);
