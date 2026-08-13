/**
 * runBugReportButtonSessionExpiry.mjs
 *
 * Standalone runner for the BugReportButton session-expiry contract tests.
 * Uses Node.js 18+ built-in test runner (node:test) — zero external deps.
 *
 * Usage:  node server/tests/runBugReportButtonSessionExpiry.mjs
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUTTON_PATH = join(
  __dirname,
  "../../client/src/components/BugReportButton.tsx"
);
const MODAL_PATH = join(
  __dirname,
  "../../client/src/components/BugReportModal.tsx"
);

const buttonSource = readFileSync(BUTTON_PATH, "utf-8");
const modalSource  = readFileSync(MODAL_PATH,  "utf-8");

describe("BugReportButton — session expiry contract", () => {
  test("returns null when user is falsy (the session-expiry guard)", () => {
    const hasGuard = /if\s*\(\s*!user\s*\)\s*return\s+null/.test(buttonSource);
    assert.equal(hasGuard, true,
      "Expected 'if (!user) return null' guard in BugReportButton.tsx");
  });

  test("BugReportModal JSX element is rendered AFTER the null guard (not before it)", () => {
    const guardIndex = buttonSource.search(/if\s*\(\s*!user\s*\)\s*return\s+null/);
    // Use `<BugReportModal` to match the JSX element, not the import at the top of the file
    const modalJsxIndex = buttonSource.indexOf("<BugReportModal");

    assert.ok(guardIndex > -1,    "Null guard must exist in BugReportButton.tsx");
    assert.ok(modalJsxIndex > -1, "<BugReportModal JSX must be present in BugReportButton.tsx");
    assert.ok(
      modalJsxIndex > guardIndex,
      `<BugReportModal JSX (pos ${modalJsxIndex}) must come AFTER null guard (pos ${guardIndex}). ` +
      "A refactor moved the modal above the auth guard — session expiry would no longer close it."
    );
  });

  test("the rendered JSX output (button element) appears after the null guard", () => {
    const guardIndex = buttonSource.search(/if\s*\(\s*!user\s*\)\s*return\s+null/);
    assert.ok(guardIndex > -1, "Null guard must exist");

    const jsxFragmentIndex = buttonSource.search(/<>\s*\n\s*<button/);
    if (jsxFragmentIndex !== -1) {
      assert.ok(
        jsxFragmentIndex > guardIndex,
        "JSX fragment (<> ... </>) must come after the null guard"
      );
    } else {
      const buttonTestIdIndex = buttonSource.indexOf("bug-report-button");
      assert.ok(
        buttonTestIdIndex > guardIndex,
        "data-testid='bug-report-button' must appear after the null guard"
      );
    }
  });

  test("BugReportModal is imported and referenced in BugReportButton", () => {
    assert.ok(
      buttonSource.includes("BugReportModal"),
      "BugReportButton.tsx must reference BugReportModal"
    );
  });

  test("does not render BugReportModal outside the main return (no rogue portal)", () => {
    const occurrences = (buttonSource.match(/<BugReportModal/g) || []).length;
    assert.equal(
      occurrences, 1,
      `Expected exactly 1 <BugReportModal in BugReportButton.tsx, found ${occurrences}`
    );
  });

  test("BugReportModal does not reference BugReportButton (no circular open-state)", () => {
    assert.equal(
      modalSource.includes("BugReportButton"), false,
      "BugReportModal.tsx must not reference BugReportButton — " +
      "a circular reference could keep the modal alive independently of the auth guard"
    );
  });
});
