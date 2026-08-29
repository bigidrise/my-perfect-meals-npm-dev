import { getMarketingPage, renderMarketingSsr } from "../marketingSsr";
import fs from "fs";
import path from "path";
import { isExactPublicMarketingRoute } from "../../client/src/lib/publicRoutePolicy";

const ROUTES = [
  "/welcome",
  "/pricing",
  "/guest-builder",
  "/lifestyle",
  "/learn",
  "/creator-studio",
] as const;

const CLIENT_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta name="description" content="generic" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="generic" />
    <meta name="twitter:title" content="generic" />
    <title>My Perfect Meals</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/app-entry-test.js"></script>
  </body>
</html>`;

describe("marketing SSR", () => {
  it.each(ROUTES)("renders crawlable content and route metadata for %s", (route) => {
    const page = getMarketingPage(route);
    const html = renderMarketingSsr(route, CLIENT_TEMPLATE);

    expect(page).not.toBeNull();
    expect(html).toContain(`rel="canonical" href="https://app.myperfectmeals.com${route}"`);
    expect(html).toContain(`<h1>${page!.heading}</h1>`);
    expect(html).toContain(page!.description);
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:title"');
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain("/assets/app-entry-test.js");
  });

  it("replaces generic metadata instead of creating duplicate titles and descriptions", () => {
    const html = renderMarketingSsr("/pricing", CLIENT_TEMPLATE)!;

    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.match(/name="twitter:title"/g)).toHaveLength(1);
    expect(html).not.toContain('content="generic"');
  });

  it("uses route-specific absolute social images", () => {
    const images = ROUTES.map((route) => {
      const html = renderMarketingSsr(route, CLIENT_TEMPLATE)!;
      return html.match(/property="og:image" content="([^"]+)"/)?.[1];
    });

    expect(images.every((image) => image?.startsWith("https://app.myperfectmeals.com/"))).toBe(true);
    expect(new Set(images).size).toBe(ROUTES.length);
  });

  it("does not render unknown or authenticated routes", () => {
    expect(getMarketingPage("/dashboard")).toBeNull();
    expect(renderMarketingSsr("/dashboard", CLIENT_TEMPLATE)).toBeNull();
  });

  it("keeps every marketing route public in client-side auth guards", () => {
    const appRouter = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/components/AppRouter.tsx"),
      "utf-8",
    );
    const authContext = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/contexts/AuthContext.tsx"),
      "utf-8",
    );
    const router = fs.readFileSync(
      path.resolve(__dirname, "../../client/src/components/Router.tsx"),
      "utf-8",
    );

    for (const route of ROUTES) {
      if (route === "/lifestyle" || route === "/learn" || route === "/creator-studio") {
        expect(isExactPublicMarketingRoute(route)).toBe(true);
      } else {
        expect(appRouter).toContain(`"${route}"`);
        expect(authContext).toContain(`"${route}"`);
        expect(router).toContain(`"${route}"`);
      }
    }

    expect(appRouter).toContain("isExactPublicMarketingRoute(location)");
    expect(authContext).toContain("isExactPublicMarketingRoute(window.location.pathname)");
    expect(router).toContain("isExactPublicMarketingRoute(location)");
  });

  it("does not make protected descendants of marketing landing pages public", () => {
    expect(isExactPublicMarketingRoute("/lifestyle/chefs-kitchen")).toBe(false);
    expect(isExactPublicMarketingRoute("/lifestyle/my-perfect-pregnancy")).toBe(false);
    expect(isExactPublicMarketingRoute("/learn/topic")).toBe(false);
    expect(isExactPublicMarketingRoute("/creator-studio/application")).toBe(false);
  });
});