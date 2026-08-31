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
      "file-saver": path.resolve(__dirname, "./src/lib/nativeFileSaver.ts"),
    },
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

          if (moduleId.includes("/@imagemagick/magick-wasm/")) return "vendor-image-convert";
          if (moduleId.includes("/docx/") || moduleId.includes("/mammoth/")) return "vendor-doc-processing";
          if (moduleId.includes("/jszip/")) return "vendor-zip";
          if (moduleId.includes("/jspdf/") || moduleId.includes("/html2canvas/")) return "vendor-pdf";
          if (moduleId.includes("/pptxgenjs/")) return "vendor-pptx";
          if (moduleId.includes("/xlsx/")) return "vendor-xlsx";

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
      manifestFilename: "manifest.json",
      includeAssets: [
        "brand/orbidoc-symbol-light.svg",
        "brand/orbidoc-symbol-dark.svg",
        "brand/orbidoc-app-icon.svg",
        "brand/orbidoc-app-maskable.svg",
        "logo.png",
        "logo-192.png",
        "logo-512.png",
        "logo-maskable-192.png",
        "logo-maskable-512.png",
        "favicon-32.png",
        "apple-touch-icon.png",
      ],
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/\.well-known\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,mjs}"],
        runtimeCaching: [
          {
            urlPattern: /\.wasm$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "orbidoc-wasm-runtime",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-font-styles",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-font-files",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/(?:tesseract\.js(?:-core)?|@tesseract\.js-data)\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "tesseract-runtime",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "tesseract-language-data",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
        name: "OrbiDoc",
        short_name: "OrbiDoc",
        description: "Workspace local-first para documentos, planilhas, apresentações, design, PDF, scanner, OCR e conversão de arquivos.",
        lang: "pt-BR",
        dir: "ltr",
        theme_color: "#3157F6",
        background_color: "#F7F9FC",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "any",
        start_url: "/",
        scope: "/",
        prefer_related_applications: false,
        categories: ["productivity", "business", "education", "utilities"],
        icons: [
          { src: "/brand/orbidoc-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/logo-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/logo-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/logo-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        file_handlers: [
          {
            action: "/",
            accept: {
              "application/pdf": [".pdf"],
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              "application/vnd.ms-excel": [".xls"],
              "application/vnd.oasis.opendocument.spreadsheet": [".ods"],
              "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
              "application/epub+zip": [".epub"],
              "application/zip": [".zip"],
              "text/plain": [".txt", ".log", ".md", ".markdown", ".csv", ".tsv", ".json", ".xml", ".yaml", ".yml", ".toml", ".ini", ".sql"],
              "text/html": [".html", ".htm"],
              "image/png": [".png"],
              "image/jpeg": [".jpg", ".jpeg"],
              "image/webp": [".webp"],
              "image/svg+xml": [".svg"],
            },
          },
        ],
        launch_handler: { client_mode: "focus-existing" },
      },
      devOptions: { enabled: false },
    }),
  ],
});
