#!/usr/bin/env node
/**
 * scripts/modal-screenshot-capture.mjs
 *
 * Standalone Playwright screenshot capture for the Gate 2 modal diff workflow.
 * Captures dialog variants at the three Gate 2 viewports and saves PNGs.
 *
 * Usage:
 *   node scripts/modal-screenshot-capture.mjs --dir=<output-dir> [--base-url=http://localhost:5000]
 *
 * Called by scripts/modal-screenshot-diff.sh (before / after subcommands).
 * NOT the same as the Gate 1 captureBaseline() helper in universal-modal-viewport.spec.ts —
 * this script runs standalone without the test runner, so it can be invoked
 * from a bash script before or after editing primitives.
 */

import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// ── Gate 2 viewports (subset of Gate 1 — the three specified in the guard doc) ──
const VIEWPORTS = [
  { name: "small-iphone-portrait", width: 375, height: 667 },
  { name: "iphone-landscape",      width: 844, height: 390 },
  { name: "desktop",               width: 1280, height: 800 },
];

// ── All modal variants exposed by ModalTestHarness ─────────────────────────────
const VARIANTS = [
  "universal",
  "confirmation",
  "form",
  "picker",
  "information",
  "workflow",
  "wizard",
];

// ── Parse CLI args ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(prefix) {
  const match = args.find((a) => a.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

const OUTPUT_DIR = getArg("--dir=");
const BASE_URL   = getArg("--base-url=") ?? "http://localhost:5000";

if (!OUTPUT_DIR) {
  console.error("Error: --dir=<output-dir> is required");
  process.exit(1);
}

// ── Main capture ────────────────────────────────────────────────────────────────

async function capture() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  let captured = 0;
  let errors   = 0;

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();

    for (const variant of VARIANTS) {
      const label    = `${variant}-${viewport.name}`;
      const filePath = path.join(OUTPUT_DIR, `${label}.png`);

      try {
        await page.goto(`${BASE_URL}/__modal-test__?variant=${variant}`, {
          waitUntil: "networkidle",
          timeout:   20_000,
        });

        // Confirm the harness rendered — gate on the test-id sentinel element
        await page.waitForSelector('[data-testid="modal-test-harness"]', {
          timeout: 10_000,
        });

        // Clip to the dialog region + 16px breathing room on each side
        const dialog = page.locator('[role="dialog"]').first();
        const box    = await dialog.boundingBox().catch(() => null);

        const clip = box
          ? {
              x:      Math.max(0, box.x - 16),
              y:      Math.max(0, box.y - 16),
              width:  Math.min(viewport.width,  box.width  + 32),
              height: Math.min(viewport.height, box.height + 32),
            }
          : undefined; // full-viewport fallback when dialog box is unavailable

        await page.screenshot({ path: filePath, clip });
        console.log(`  ✓  ${label}`);
        captured++;
      } catch (err) {
        console.error(`  ✗  ${label}: ${err.message}`);
        errors++;
      }
    }

    await context.close();
  }

  await browser.close();

  console.log(
    `\nCapture complete: ${captured} saved, ${errors} error${errors === 1 ? "" : "s"}.`
  );

  if (errors > 0) process.exit(1);
}

capture().catch((err) => {
  console.error("Fatal capture error:", err.message);
  process.exit(1);
});
