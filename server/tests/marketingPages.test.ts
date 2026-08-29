import express from "express";
import http from "http";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import {
  MARKETING_PATHS,
  registerMarketingPageRoutes,
  renderMarketingPage,
} from "../marketingPages";

const template = `<!doctype html><html><head>
<meta name="description" content="generic" />
<meta property="og:title" content="generic" />
<meta property="og:description" content="generic" />
<meta property="og:url" content="https://app.myperfectmeals.com/" />
<title>My Perfect Meals</title>
</head><body><div id="root"><!-- SEO fallback --></div></body></html>`;

function get(app: express.Express, pathname: string): Promise<{
  status: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("test server did not expose a port"));
        return;
      }
      http.get({ host: "127.0.0.1", port: address.port, path: pathname }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          server.close(() =>
            resolve({
              status: response.statusCode || 0,
              body: Buffer.concat(chunks).toString("utf8"),
              headers: response.headers,
            }),
          );
        });
      }).on("error", (error) => {
        server.close(() => reject(error));
      });
    });
  });
}

describe("public marketing HTML", () => {
  let templatePath: string;

  beforeEach(() => {
    const root = mkdtempSync(path.join(tmpdir(), "mpm-marketing-"));
    templatePath = path.join(root, "index.html");
    writeFileSync(templatePath, template);
  });

  afterEach(() => {
    rmSync(path.dirname(templatePath), { recursive: true, force: true });
  });

  test.each(MARKETING_PATHS)("renders readable content for %s", (pathname) => {
    const html = renderMarketingPage(template, pathname);
    expect(html).toContain("<h1>");
    expect(html).toContain("data-seo-page");
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain(`href="https://app.myperfectmeals.com${pathname}"`);
    expect(html).not.toContain("<!-- SEO fallback -->");
  });

  test("registers only the intended marketing routes", async () => {
    const app = express();
    registerMarketingPageRoutes(app, templatePath);

    const page = await get(app, "/pricing");
    expect(page.status).toBe(200);
    expect(page.body).toContain("Plans for personalized nutrition");
    expect(page.body).toContain("$29.99 per month");
    expect(page.headers["cache-control"]).toBe("no-store, no-cache, must-revalidate");

    const missing = await get(app, "/private-dashboard");
    expect(missing.status).toBe(404);
  });
});