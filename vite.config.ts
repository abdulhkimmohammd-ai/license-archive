import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const PROJECT_ROOT = import.meta.dirname;
const CLIENT_ROOT = path.resolve(PROJECT_ROOT, "client");
const CLIENT_SRC = path.resolve(CLIENT_ROOT, "src");
const CLIENT_PUBLIC = path.resolve(CLIENT_ROOT, "public");

export default defineConfig(({ mode }) => {
  const cloudflarePreview = mode === "cloudflare-preview";

  const manualChunks: Record<string, string[]> = {
    "react-vendor": [
      "react",
      "react-dom",
    ],

    "query-vendor": [
      "@tanstack/react-query",
      "@trpc/client",
      "@trpc/react-query",
    ],

    "supabase-vendor": [
      "@supabase/supabase-js",
    ],

    "ui-vendor": [
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "lucide-react",
    ],

    "charts-vendor": [
      "recharts",
    ],
  };

  return {
    /*
     * المسار الأساسي للتطبيق
     */
    base: "/license-archive/",

    /*
     * جذر مشروع Vite
     * index.html موجود في جذر المشروع
     */
    root: PROJECT_ROOT,

    /*
     * إضافات Vite
     */
    plugins: [
      react(),
      tailwindcss(),
    ],

    /*
     * مسارات الاستيراد المختصرة
     */
    resolve: {
      alias: {
        "@": CLIENT_SRC,

        "@shared": path.resolve(
          PROJECT_ROOT,
          "shared"
        ),

        "@assets": path.resolve(
          PROJECT_ROOT,
          "attached_assets"
        ),
      },
    },

    /*
     * مكان ملفات البيئة .env
     */
    envDir: PROJECT_ROOT,

    /*
     * مجلد الملفات العامة
     */
    publicDir: CLIENT_PUBLIC,

    /*
     * إعدادات البناء
     */
    build: {
      outDir: path.resolve(
        PROJECT_ROOT,
        "dist",
        "public"
      ),

      emptyOutDir: true,

      rollupOptions: {
        input: path.resolve(
          PROJECT_ROOT,
          "index.html"
        ),

        output: {
          manualChunks,
        },
      },
    },

    /*
     * إعدادات خادم التطوير
     */
    server: {
      host: true,

      allowedHosts: [
        ".manuspre.computer",
        ".manus.computer",
        ".manus-asia.computer",
        ".manuscomputer.ai",
        ".manusvm.computer",
        "localhost",
        "127.0.0.1",
      ],

      fs: {
        strict: true,

        deny: [
          "**/.*",
        ],
      },
    },

    /*
     * تحسينات خاصة بمعاينة Cloudflare
     */
    ...(cloudflarePreview
      ? {
          optimizeDeps: {
            include: [
              "react",
              "react-dom",
              "@tanstack/react-query",
              "@supabase/supabase-js",
            ],
          },
        }
      : {}),
  };
});
