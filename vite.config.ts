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
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  worker: { format: "es" },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, "/");
          if (!moduleId.includes("/node_modules/")) return undefined;

          if (moduleId.includes("/@tabler/icons-react/") || moduleId.includes("/lucide-react/")) return "vendor-icons";
          if (
            moduleId.includes("/node_modules/react/")
            || moduleId.includes("/node_modules/react-dom/")
            || moduleId.includes("/node_modules/scheduler/")
          ) return "vendor-react";
          if (moduleId.includes("/motion/") || moduleId.includes("/framer-motion/")) return "vendor-motion";

          // Mammoth and docx share document/ZIP internals. Keeping them together
          // avoids a Rollup circular chunk while remaining comfortably below the
          // workspace chunk-size budget.
          if (moduleId.includes("/docx/") || moduleId.includes("/mammoth/")) return "vendor-doc-processing";
          if (moduleId.includes("/jszip/")) return "vendor-zip";
          if (moduleId.includes("/jspdf/") || moduleId.includes("/html2canvas/")) return "vendor-pdf";
          if (moduleId.includes("/pptxgenjs/")) return "vendor-pptx";
          if (moduleId.includes("/xlsx/")) return "vendor-xlsx";
          if (moduleId.includes("/file-saver/")) return "vendor-file-saver";

          if (moduleId.includes("/tesseract.js/") || moduleId.includes("/pdfjs-dist/")) return "vendor-ocr";
          if (moduleId.includes("/firebase/") || moduleId.includes("/@firebase/")) return "vendor-firebase";
          if (
            moduleId.includes("/react-markdown/")
            || moduleId.includes("/remark-")
            || moduleId.includes("/rehype-")
            || moduleId.includes("/micromark")
          ) return "vendor-markdown";

          return undefined;
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
        "logo-maskable-192.png",
        "logo-maskable-512.png",
        "favicon.ico",
        "apple-touch-icon.png"
      ],
      workbox: {
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/huggingface\.co\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "hf-models",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/cdn-lfs\.huggingface\.co\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "hf-lfs",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/image\.pollinations\.ai\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "generated-images",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 3 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        id: "/",
        name: "DocPlus+",
        short_name: "DocPlus+",
        description: "Suite para OCR, IA, áudio, tradução, PDF e edição de documentos.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        prefer_related_applications: false,
        categories: ["productivity", "utilities"],
        icons: [
          { src: "/logo-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/logo-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/logo-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
