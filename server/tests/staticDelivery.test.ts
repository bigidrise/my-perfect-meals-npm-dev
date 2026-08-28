import express from "express";
import { brotliDecompressSync, gunzipSync } from "zlib";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import http, { type IncomingHttpHeaders } from "http";
import { tmpdir } from "os";
import path from "path";
import {
  cacheControlForStaticFile,
  createStaticFileMiddleware,
  registerFreshMetadataRoutes,
  setNoStoreHeaders,
} from "../staticDelivery";

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "mpm-static-delivery-"));
  mkdirSync(path.join(root, "assets"));
  writeFileSync(path.join(root, "assets", "app-entry-Abcdef12.js"), "console.log('large bundle');\n".repeat(20));
  writeFileSync(path.join(root, "assets", "plain.js"), "console.log('plain bundle');\n");
  writeFileSync(path.join(root, "index.html"), "<!doctype html><html><body>fresh shell</body></html>\n");
  writeFileSync(path.join(root, "version.json"), JSON.stringify({ version: "test" }));
  writeFileSync(path.join(root, "release-manifest.json"), JSON.stringify({ releaseId: "test-1" }));
  return root;
}

function appFor(root: string) {
  const app = express();
  registerFreshMetadataRoutes(app, root);
  for (const middleware of createStaticFileMiddleware(root)) app.use(middleware);
  app.get("/api/test", (_req, res) => res.json({ ok: true }));
  app.use("*", (_req, res) => {
    setNoStoreHeaders(res);
    res.sendFile(path.join(root, "index.html"));
  });
  return app;
}

interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

function getRaw(app: ReturnType<typeof appFor>, url: string, acceptEncoding: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Test server did not expose a TCP port"));
        return;
      }

      const request = http.get({
        host: "127.0.0.1",
        port: address.port,
        path: url,
        headers: { "Accept-Encoding": acceptEncoding },
      }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          server.close(() => {
            resolve({
              status: response.statusCode || 0,
              headers: response.headers,
              body: Buffer.concat(chunks),
            });
          });
        });
      });

      request.on("error", (error) => {
        server.close(() => reject(error));
      });
    });
  });
}

describe("static delivery policy", () => {
  let root: string;

  beforeEach(() => {
    root = createFixture();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test("fingerprinted JavaScript is immutable-cacheable", async () => {
    const response = await getRaw(appFor(root), "/assets/app-entry-Abcdef12.js", "identity");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.body.toString()).toBe(readFileSync(path.join(root, "assets", "app-entry-Abcdef12.js"), "utf8"));
  });

  test("HTML and release metadata remain fresh", async () => {
    const app = appFor(root);
    const expectedFreshness = "no-store, no-cache, must-revalidate";

    for (const url of ["/", "/index.html", "/version.json", "/release-manifest.json"]) {
      const response = await getRaw(app, url, "br, gzip");
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe(expectedFreshness);
      expect(response.headers.pragma).toBe("no-cache");
      expect(response.headers.expires).toBe("0");
    }
  });

  test("Brotli negotiation compresses eligible text and preserves the body", async () => {
    const response = await getRaw(appFor(root), "/assets/app-entry-Abcdef12.js", "br");

    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBe("br");
    expect(response.headers.vary).toContain("Accept-Encoding");
    expect(brotliDecompressSync(response.body).toString()).toBe(
      readFileSync(path.join(root, "assets", "app-entry-Abcdef12.js"), "utf8"),
    );
  });

  test("gzip is used when Brotli is not accepted", async () => {
    const response = await getRaw(appFor(root), "/assets/plain.js", "gzip");

    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBe("gzip");
    expect(gunzipSync(response.body).toString()).toBe(
      readFileSync(path.join(root, "assets", "plain.js"), "utf8"),
    );
  });

  test("unsupported encodings leave the text response uncompressed", async () => {
    const response = await getRaw(appFor(root), "/assets/plain.js", "compress");

    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.body.toString()).toBe(
      readFileSync(path.join(root, "assets", "plain.js"), "utf8"),
    );
  });

  test("API responses are not compressed or assigned static cache policy", async () => {
    const response = await getRaw(appFor(root), "/api/test", "br, gzip");

    expect(response.status).toBe(200);
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.headers["cache-control"]).toBeUndefined();
    expect(JSON.parse(response.body.toString())).toEqual({ ok: true });
  });

  test("cache policy only marks the intended asset classes immutable", () => {
    expect(cacheControlForStaticFile("/dist/assets/index-Abcdef12.js")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(cacheControlForStaticFile("/dist/assets/app-entry.js")).toBe("public, max-age=3600");
    expect(cacheControlForStaticFile("/dist/index.html")).toBe("no-store, no-cache, must-revalidate");
    expect(cacheControlForStaticFile("/dist/release-manifest.json")).toBe(
      "no-store, no-cache, must-revalidate",
    );
  });
});