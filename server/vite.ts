import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import {
  createStaticFileMiddleware,
  registerFreshMetadataRoutes,
  setNoStoreHeaders,
} from "./staticDelivery";
import { registerMarketingSsrRoutes } from "./marketingSsr";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: false,  // Disable HMR to avoid WebSocket port conflicts
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Only exit on truly fatal Vite startup errors, not runtime warnings
        // (e.g. WebSocket disconnect messages must not kill the server)
        if (msg.includes("Failed to load config") || msg.includes("Cannot find module")) {
          process.exit(1);
        }
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  registerMarketingSsrRoutes(app, async () => {
    const clientTemplate = path.resolve(
      import.meta.dirname,
      "..",
      "client",
      "index.html",
    );
    let template = await fs.promises.readFile(clientTemplate, "utf-8");
    template = template.replace(
      `src="/src/main.tsx"`,
      `src="/src/main.tsx?v=${nanoid()}"`,
    );
    return (await vite.transformIndexHtml("/", template))
      .replace(/<script[^>]*src="\/@vite\/client"[^>]*><\/script>\s*/g, "");
  });
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      // Strip the @vite/client script tag — HMR is disabled (hmr: false) but
      // Vite still injects it, which causes a WebSocket error in the console.
      const page = (await vite.transformIndexHtml(url, template))
        .replace(/<script[^>]*src="\/@vite\/client"[^>]*><\/script>\s*/g, "");
      setNoStoreHeaders(res);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "..", "client", "dist");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  registerFreshMetadataRoutes(app, distPath);
  for (const middleware of createStaticFileMiddleware(distPath)) app.use(middleware);

  // Serve index.html with NO cache so users always get the latest version
  app.use("*", (_req, res) => {
    setNoStoreHeaders(res);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
