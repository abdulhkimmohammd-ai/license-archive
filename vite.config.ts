import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import {
  defineConfig,
  type Plugin,
  type ViteDevServer,
} from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Project paths
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;

const CLIENT_ROOT = path.resolve(
  PROJECT_ROOT,
  "client"
);

const CLIENT_SRC = path.resolve(
  CLIENT_ROOT,
  "src"
);

const CLIENT_PUBLIC = path.resolve(
  CLIENT_ROOT,
  "public"
);

const LOG_DIR = path.join(
  PROJECT_ROOT,
  ".manus-logs"
);

// =============================================================================
// Manus log settings
// =============================================================================

const MAX_LOG_SIZE_BYTES =
  1 * 1024 * 1024;

const TRIM_TARGET_BYTES = Math.floor(
  MAX_LOG_SIZE_BYTES * 0.6
);

type LogSource =
  | "browserConsole"
  | "networkRequests"
  | "sessionReplay";

// =============================================================================
// Manus Debug Collector - helpers
// =============================================================================

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, {
      recursive: true,
    });
  }
}

function trimLogFile(
  logPath: string,
  maxSize: number
) {
  try {
    if (
      !fs.existsSync(logPath) ||
      fs.statSync(logPath).size <= maxSize
    ) {
      return;
    }

    const lines = fs
      .readFileSync(
        logPath,
        "utf-8"
      )
      .split("\n");

    const keptLines: string[] = [];
    let keptBytes = 0;

    for (
      let i = lines.length - 1;
      i >= 0;
      i--
    ) {
      const lineBytes =
        Buffer.byteLength(
          `${lines[i]}\n`,
          "utf-8"
        );

      if (
        keptBytes + lineBytes >
        TRIM_TARGET_BYTES
      ) {
        break;
      }

      keptLines.unshift(
        lines[i]
      );

      keptBytes += lineBytes;
    }

    fs.writeFileSync(
      logPath,
      keptLines.join("\n"),
      "utf-8"
    );
  } catch {
    // Ignore trim errors
  }
}

function writeToLogFile(
  source: LogSource,
  entries: unknown[]
) {
  if (entries.length === 0) {
    return;
  }

  ensureLogDir();

  const logPath = path.join(
    LOG_DIR,
    `${source}.log`
  );

  const lines = entries.map(
    (entry) => {
      const timestamp =
        new Date().toISOString();

      return `[${timestamp}] ${JSON.stringify(entry)}`;
    }
  );

  fs.appendFileSync(
    logPath,
    `${lines.join("\n")}\n`,
    "utf-8"
  );

  trimLogFile(
    logPath,
    MAX_LOG_SIZE_BYTES
  );
}

// =============================================================================
// Manus Debug Collector Plugin
// =============================================================================

function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      // Do not inject the Manus debug collector
      // into production builds.
      if (
        process.env.NODE_ENV ===
        "production"
      ) {
        return html;
      }

      return {
        html,

        tags: [
          {
            tag: "script",

            attrs: {
              src:
                "/__manus__/debug-collector.js",
              defer: true,
            },

            injectTo: "head",
          },
        ],
      };
    },

    configureServer(
      server: ViteDevServer
    ) {
      server.middlewares.use(
        "/__manus__/logs",
        (req, res, next) => {
          if (
            req.method !== "POST"
          ) {
            return next();
          }

          const handlePayload = (
            payload: any
          ) => {
            if (
              payload
                ?.consoleLogs
                ?.length > 0
            ) {
              writeToLogFile(
                "browserConsole",
                payload.consoleLogs
              );
            }

            if (
              payload
                ?.networkRequests
                ?.length > 0
            ) {
              writeToLogFile(
                "networkRequests",
                payload.networkRequests
              );
            }

            if (
              payload
                ?.sessionEvents
                ?.length > 0
            ) {
              writeToLogFile(
                "sessionReplay",
                payload.sessionEvents
              );
            }

            res.writeHead(
              200,
              {
                "Content-Type":
                  "application/json",
              }
            );

            res.end(
              JSON.stringify({
                success: true,
              })
            );
          };

          const reqBody = (
            req as {
              body?: unknown;
            }
          ).body;

          if (
            reqBody &&
            typeof reqBody ===
              "object"
          ) {
            try {
              handlePayload(
                reqBody
              );
            } catch (error) {
              res.writeHead(
                400,
                {
                  "Content-Type":
                    "application/json",
                }
              );

              res.end(
                JSON.stringify({
                  success: false,
                  error: String(
                    error
                  ),
                })
              );
            }

            return;
          }

          let body = "";

          req.on(
            "data",
            (chunk) => {
              body += chunk.toString();
            }
          );

          req.on(
            "end",
            () => {
              try {
                const payload =
                  JSON.parse(
                    body
                  );

                handlePayload(
                  payload
                );
              } catch (error) {
                res.writeHead(
                  400,
                  {
                    "Content-Type":
                      "application/json",
                  }
                );

                res.end(
                  JSON.stringify({
                    success: false,
                    error: String(
                      error
                    ),
                  })
                );
              }
            }
          );
        }
      );
    },
  };
}

// =============================================================================
// Vite configuration
// =============================================================================

export default defineConfig(
  ({ mode }) => {
    const cloudflarePreview =
      mode ===
      "cloudflare-preview";

    // =========================================================================
    // Plugins
    // =========================================================================

    const plugins = [
      react(),
      tailwindcss(),
      jsxLocPlugin(),

      ...(cloudflarePreview
        ? []
        : [
            vitePluginManusRuntime(),
            vitePluginManusDebugCollector(),
          ]),
    ];

    // =========================================================================
    // Manual chunks
    // =========================================================================

    const manualChunks: Record<
      string,
      string[]
    > = cloudflarePreview
      ? {
          "react-vendor": [
            "react",
            "react-dom",
          ],

          "query-vendor": [
            "@tanstack/react-query",
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
        }
      : {
          "react-vendor": [
            "react",
            "react-dom",
          ],

          "query-vendor": [
            "@tanstack/react-query",
            "@trpc/client",
            "@trpc/react-query",
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

    // =========================================================================
    // Return configuration
    // =========================================================================

    return {
      // =======================================================================
      // GitHub Pages
      // =======================================================================

      base: "/license-archive/",

      // =======================================================================
      // IMPORTANT
      //
      // index.html is located at:
      //
      // client/index.html
      //
      // Therefore the Vite root must remain the repository root.
      // =======================================================================

      root: PROJECT_ROOT,

      // =======================================================================
      // Plugins
      // =======================================================================

      plugins,

      // =======================================================================
      // Resolve aliases
      // =======================================================================

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

      // =======================================================================
      // Environment
      // =======================================================================

      envDir: PROJECT_ROOT,

      // =======================================================================
      // Public directory
      //
      // Your public files are inside:
      // client/public
      // =======================================================================

      publicDir: CLIENT_PUBLIC,

      // =======================================================================
      // Build
      // =======================================================================

      build: {
        // GitHub Actions expects:
        // dist/public

        outDir: path.resolve(
          PROJECT_ROOT,
          "dist",
          "public"
        ),

        emptyOutDir: true,

        rollupOptions: {
          // IMPORTANT:
          // The actual index.html is:
          // client/index.html
          input: path.resolve(
  PROJECT_ROOT,
  "index.html"
),

          output: {
            manualChunks,
          },
        },
      },

      // =======================================================================
      // Development server
      // =======================================================================

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
    };
  }
);
