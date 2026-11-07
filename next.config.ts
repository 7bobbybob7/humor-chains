import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled deliberately: every admin page must show live database state,
  // so each route is force-dynamic. Cache Components would remove that segment
  // config and require Suspense around every uncached read for no benefit here.
  cacheComponents: false,
  // partialPrefetching requires cacheComponents, which is off above.
  images: {
    // Image thumbnails on the run screen come straight from the public
    // Storage bucket, so that host has to be declared here.
    remotePatterns: [
      { protocol: "https", hostname: "czwpbbgwzylybqetyivd.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
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

export default nextConfig;
