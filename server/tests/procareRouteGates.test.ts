/**
 * Structural gate test for procareRoutes.ts
 *
 * INVARIANT: every route that uses requirePhase1Cert MUST also use requireProAccess.
 *
 * Why this matters:
 *   requirePhase1Cert and requirePhase2Training guard clinical capability (training +
 *   certification), but they do NOT enforce the billing tier gate. requireProAccess
 *   is the subscription gate. A route that wires up certification gates but omits
 *   the subscription gate silently allows free-tier users into ProCare Studio
 *   endpoints — no compile error, no runtime warning.
 *
 * How this test works:
 *   It reads procareRoutes.ts as plain text, extracts every route registration line
 *   (lines that call router.get / .post / .put / .patch / .delete), and asserts
 *   that any such line containing "requirePhase1Cert" also contains "requireProAccess".
 *
 * When a route is legitimately exempt from both gates (e.g. client-facing webhooks
 * or self-service flows), it should carry a "[PHASE2-EXEMPT]" comment above it and
 * will naturally not contain requirePhase1Cert — so it won't trigger this check.
 */

import * as fs from "fs";
import * as path from "path";

const ROUTES_FILE = path.resolve(__dirname, "../routes/procareRoutes.ts");

function extractRouteLines(source: string): Array<{ lineNo: number; text: string }> {
  const lines = source.split("\n");
  const results: Array<{ lineNo: number; text: string }> = [];

  // A route registration starts with `router.` followed by an HTTP method.
  // All middleware args are on the same line as the method call in this file.
  const ROUTE_RE = /^\s*router\.(get|post|put|patch|delete)\s*\(/;

  for (let i = 0; i < lines.length; i++) {
    if (ROUTE_RE.test(lines[i])) {
      // Accumulate continuation lines until the async handler opening brace
      // so we capture spread middleware arrays if they ever span lines.
      let combined = lines[i];
      let j = i + 1;
      // Stop at the first line that opens the async handler body (=> {)
      while (j < lines.length && !combined.includes("async (req") && !combined.includes("async(req")) {
        combined += " " + lines[j].trim();
        j++;
      }
      results.push({ lineNo: i + 1, text: combined });
    }
  }

  return results;
}

describe("procareRoutes.ts — subscription gate invariant", () => {
  let source: string;
  let routeLines: Array<{ lineNo: number; text: string }>;

  beforeAll(() => {
    expect(() => {
      source = fs.readFileSync(ROUTES_FILE, "utf-8");
    }).not.toThrow();
    routeLines = extractRouteLines(source);
  });

  it("finds at least one route registration in procareRoutes.ts", () => {
    expect(routeLines.length).toBeGreaterThan(0);
  });

  it("every route using requirePhase1Cert also uses requireProAccess", () => {
    const violations: string[] = [];

    for (const { lineNo, text } of routeLines) {
      const hasCert = text.includes("requirePhase1Cert");
      const hasProAccess = text.includes("requireProAccess");

      if (hasCert && !hasProAccess) {
        violations.push(`Line ${lineNo}: requirePhase1Cert present but requireProAccess is MISSING`);
      }
    }

    if (violations.length > 0) {
      fail(
        [
          "",
          "❌ ProCare subscription gate violation(s) detected in procareRoutes.ts:",
          "",
          ...violations.map(v => `  • ${v}`),
          "",
          "Every route that gates on requirePhase1Cert must also gate on requireProAccess.",
          "requirePhase1Cert enforces clinical certification; requireProAccess enforces",
          "the billing subscription tier. Without requireProAccess, free-tier users can",
          "reach protected Studio endpoints.",
          "",
          "Fix: add requireProAccess to the middleware chain before requirePhase1Cert.",
          "If the route is intentionally exempt (e.g. client self-service, webhooks),",
          "remove requirePhase1Cert from it and add a [PHASE2-EXEMPT] comment instead.",
        ].join("\n")
      );
    }
  });

  it("every route using requirePhase2Training also uses requireProAccess", () => {
    const violations: string[] = [];

    for (const { lineNo, text } of routeLines) {
      const hasPhase2 = text.includes("requirePhase2Training");
      const hasProAccess = text.includes("requireProAccess");

      if (hasPhase2 && !hasProAccess) {
        violations.push(`Line ${lineNo}: requirePhase2Training present but requireProAccess is MISSING`);
      }
    }

    if (violations.length > 0) {
      fail(
        [
          "",
          "❌ ProCare subscription gate violation(s) detected in procareRoutes.ts:",
          "",
          ...violations.map(v => `  • ${v}`),
          "",
          "Every route that gates on requirePhase2Training must also gate on requireProAccess.",
        ].join("\n")
      );
    }
  });
});
