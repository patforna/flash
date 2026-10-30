import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const desk = "#11131A";
const server = "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [
    react(),
    // Kill switch for a broken service worker: add `selfDestroying: true` and redeploy.
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      manifest: {
        id: "/",
        name: "flash",
        short_name: "flash",
        lang: "en-GB",
        start_url: "/",
        scope: "/",
        display: "fullscreen",
        orientation: "landscape",
        background_color: desk,
        theme_color: desk,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // The manifest is precached by the plugin itself.
        globPatterns: ["**/*.{js,css,html,woff2,svg,png}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/healthz/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === "/api/cards",
            handler: "NetworkFirst",
            options: { cacheName: "flash-deck", networkTimeoutSeconds: 2, expiration: { maxEntries: 1 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: { "/api": server, "/healthz": server },
  },
});
