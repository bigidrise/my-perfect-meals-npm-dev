/**
 * Health endpoint source-scan tests
 *
 * Verifies that BOTH server entrypoints (prod.ts and index.ts) expose
 * `billingEnforced` in their `/api/health` handler, so the production
 * value of BILLING_ENFORCED can be confirmed via a public curl without
 * reading the raw secret.
 *
 * These are source-scan tests (no network I/O) so they stay fast and
 * reliable regardless of whether a server is running.
 */

import fs from "fs";
import path from "path";

describe("prod.ts /api/health handler exposes billingEnforced", () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(
      path.resolve(__dirname, "../prod.ts"),
      "utf-8"
    );
  });

  it("has an /api/health GET handler", () => {
    expect(source).toContain('"/api/health"');
  });

  it('includes billingEnforced in the health response', () => {
    // Confirm the field appears in the handler body
    const handlerStart = source.indexOf('app.get("/api/health"');
    const handlerEnd = source.indexOf("});", handlerStart);
    const handlerBlock = source.slice(handlerStart, handlerEnd);
    expect(handlerBlock).toContain("billingEnforced");
  });

  it('derives billingEnforced from BILLING_ENFORCED env var', () => {
    const handlerStart = source.indexOf('app.get("/api/health"');
    const handlerEnd = source.indexOf("});", handlerStart);
    const handlerBlock = source.slice(handlerStart, handlerEnd);
    expect(handlerBlock).toContain('BILLING_ENFORCED');
  });
});

describe("index.ts /api/health handler exposes billingEnforced", () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(
      path.resolve(__dirname, "../index.ts"),
      "utf-8"
    );
  });

  it("has an /api/health GET handler", () => {
    expect(source).toContain('"/api/health"');
  });

  it('includes billingEnforced in the health response', () => {
    const handlerStart = source.indexOf('app.get("/api/health"');
    const handlerEnd = source.indexOf("});", handlerStart);
    const handlerBlock = source.slice(handlerStart, handlerEnd);
    expect(handlerBlock).toContain("billingEnforced");
  });

  it('derives billingEnforced from BILLING_ENFORCED env var', () => {
    const handlerStart = source.indexOf('app.get("/api/health"');
    const handlerEnd = source.indexOf("});", handlerStart);
    const handlerBlock = source.slice(handlerStart, handlerEnd);
    expect(handlerBlock).toContain('BILLING_ENFORCED');
  });
});
