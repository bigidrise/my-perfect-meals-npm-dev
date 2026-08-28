import express, { type Express, type Request, type Response } from "express";
import compression from "compression";
import fs from "fs";
import path from "path";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const IMAGE_CACHE_CONTROL = "public, max-age=86400";
const DEFAULT_CACHE_CONTROL = "public, max-age=3600";
const FRESH_METADATA_CACHE_CONTROL = "no-store, no-cache, must-revalidate";

const COMPRESSIBLE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".map",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);

const ALREADY_COMPRESSED_EXTENSIONS = new Set([
  ".br",
  ".gz",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".zip",
  ".pdf",
  ".woff",
  ".woff2",
]);

function extensionOf(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Vite's production fingerprints are eight or more alphanumeric characters
 * immediately before the final extension (for example, app-entry-BspDkiXr.js).
 * Requiring the fingerprint keeps human-named files from becoming immutable.
 */
export function isFingerprintedAsset(filePath: string): boolean {
  return /[-_.][a-z0-9]{8,}\.(?:js|css)$/i.test(path.basename(filePath));
}

export function isFreshMetadata(filePath: string): boolean {
  const fileName = path.basename(filePath).toLowerCase();
  return fileName === "version.json" || fileName === "release-manifest.json";
}

export function cacheControlForStaticFile(filePath: string): string {
  const fileName = path.basename(filePath).toLowerCase();

  if (isFreshMetadata(filePath) || fileName === "index.html" || extensionOf(filePath) === ".html") {
    return FRESH_METADATA_CACHE_CONTROL;
  }

  if (isFingerprintedAsset(filePath)) {
    return IMMUTABLE_CACHE_CONTROL;
  }

  if (/\.(?:png|jpg|jpeg|gif|svg|webp|avif|woff2?)$/i.test(filePath)) {
    return IMAGE_CACHE_CONTROL;
  }

  return DEFAULT_CACHE_CONTROL;
}

export function setNoStoreHeaders(res: Response): void {
  res.setHeader("Cache-Control", FRESH_METADATA_CACHE_CONTROL);
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

export function setStaticCacheHeaders(res: Response, filePath: string): void {
  const cacheControl = cacheControlForStaticFile(filePath);
  res.setHeader("Cache-Control", cacheControl);

  if (cacheControl === FRESH_METADATA_CACHE_CONTROL) {
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}

function isCompressibleRequest(req: Request): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (req.path.startsWith("/api/") || req.path === "/api") return false;
  if (req.path.startsWith("/objects/") || req.path.startsWith("/public-objects/")) return false;
  if (req.headers.range) return false;

  const requestPath = req.path.toLowerCase();
  const extension = extensionOf(requestPath);
  if (ALREADY_COMPRESSED_EXTENSIONS.has(extension)) return false;

  // Extensionless routes are SPA HTML fallbacks. Explicitly avoid treating
  // unknown file types as text assets.
  return !extension || COMPRESSIBLE_EXTENSIONS.has(extension);
}

/**
 * Compress eligible responses using the standard Express transport middleware.
 *
 * This intentionally does not touch API, object-storage, ranged, or already
 * compressed responses. Unsupported encodings fall through unchanged.
 */
export function createStaticCompressionMiddleware() {
  return compression({
    threshold: 0,
    filter: (req, res) => isCompressibleRequest(req) && compression.filter(req, res),
  });
}

export function createStaticFileMiddleware(distPath: string) {
  return [
    createStaticCompressionMiddleware(),
    express.static(distPath, {
      setHeaders: setStaticCacheHeaders,
    }),
  ];
}

export function registerFreshMetadataRoutes(app: Express, distPath: string): void {
  for (const metadataFile of ["version.json", "release-manifest.json"]) {
    app.get(`/${metadataFile}`, (_req, res, next) => {
      const filePath = path.join(distPath, metadataFile);
      if (!fs.existsSync(filePath)) return next();

      setNoStoreHeaders(res);
      return res.sendFile(filePath);
    });
  }
}