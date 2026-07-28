import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  worker: {
    format: "es",
  },

  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("react")) {
            return "vendor-react";
          }

          if (
            id.includes("docx") ||
            id.includes("jspdf") ||
            id.includes("file-saver")
          ) {
            return "vendor-docx";
          }

          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
        },
      },
    },
  },

  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",

      includeAssets: [
        "logo.png",
        "logo-192.png",
        "logo-512.png",
        "favicon.ico",
        "apple-touch-icon.png",
        "manifest.webmanifest",
        "manifest.json"
      ],

      workbox: {
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,

        // Protege a API do cache do PWA
        navigateFallbackDenylist: [/^\/api/],

        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff,woff2}",
        ],

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/huggingface\.co\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "hf-models",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/cdn-lfs\.huggingface\.co\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "hf-lfs",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/image\.pollinations\.ai\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "generated-images",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },

      manifest: {
        id: "/",
        name: "DocSwiss",
        short_name: "DocSwiss",
        description:
          "DocSwiss - Canivete Suíço para OCR, IA, Transcrição de Áudio, Tradução, PDF e Edição de Documentos",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        prefer_related_applications: false,

        categories: [
          "productivity",
          "utilities",
        ],

        icons: [
          {
            src: "/logo-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/logo-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/logo-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/logo-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      devOptions: {
        enabled: true,
      },
    }),
  ],
});