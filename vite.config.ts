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
        name: "LogicLab — Digital Logic & Computer Architecture",
        short_name: "LogicLab",
        description: "Interactive digital logic and computer architecture labs that run entirely in the browser.",
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
        navigateFallback: "index.html",
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
