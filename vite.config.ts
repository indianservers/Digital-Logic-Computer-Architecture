import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Digital Electronics & Computing Lab",
        short_name: "Electronics Lab",
        description: "Interactive labs for digital electronics, VLSI, microcontrollers, and computer architecture.",
        theme_color: "#2F6FED",
        background_color: "#F4F7FB",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,woff}"],
        // Anatomy originals are downloaded on demand, rather than at app installation.
        globIgnores: ["**/devices/parts/**"],
        runtimeCaching: [{
          urlPattern: /\/devices\/parts\/previews\/.*\.webp$/,
          handler: "CacheFirst",
          options: {
            cacheName: "hdw-part-previews",
            expiration: {maxEntries:250,maxAgeSeconds:30*24*60*60},
            cacheableResponse: {statuses:[0,200]},
          },
        }],
        navigateFallback: "index.html",
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  optimizeDeps: {
    include: [
      "@material/web/switch/switch.js",
      "@material/web/button/filled-button.js",
      "@material/web/button/outlined-button.js",
      "@material/web/button/text-button.js",
      "@material/web/iconbutton/icon-button.js",
    ],
  },
});
