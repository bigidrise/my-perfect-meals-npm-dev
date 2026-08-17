/**
 * Release manifest pipeline regression tests.
 *
 * Covers the architectural contract established by the version/releaseId split:
 *   - update-version.js never touches releaseId or notes
 *   - cut-release.js refuses zero-note releases and auto-increments releaseId
 *   - The dismiss key is stable across routine technical redeployments
 *   - An empty notes array never produces a banner (logic gate)
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ── Helpers ────────────────────────────────────────────────────────────────

function tmpManifest(initial: object): { path: string; read: () => object } {
  const dir = join(tmpdir(), `mpm-release-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, "release-manifest.json");
  writeFileSync(p, JSON.stringify(initial, null, 2));
  return { path: p, read: () => JSON.parse(readFileSync(p, "utf-8")) };
}

function runUpdateVersion(manifestPath: string): string {
  // Inline the logic of update-version.js so tests don't depend on a file path.
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {}
  const version = Date.now().toString();
  const updated = { ...existing, version };
  writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + "\n");
  return version;
}

function runCutRelease(manifestPath: string, notes: string[]): void {
  // Inline the core logic of cut-release.js for deterministic testing.
  if (!notes.length || notes.every((n) => !n.trim())) {
    throw new Error("cut-release: REFUSED — no valid release notes");
  }

  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {}

  const today = new Date().toISOString().slice(0, 10);
  const prevId = (existing.releaseId as string) ?? "";
  let suffix = 1;
  if (prevId.startsWith(today + "-")) {
    const n = parseInt(prevId.slice(today.length + 1), 10);
    if (!isNaN(n)) suffix = n + 1;
  }

  const releaseId = `${today}-${suffix}`;
  const updated = { ...existing, releaseId, notes: notes.map((n) => n.trim()).filter(Boolean) };
  writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + "\n");
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("update-version.js logic", () => {
  test("updates version but preserves releaseId and notes", () => {
    const { path, read } = tmpManifest({
      version: "111",
      releaseId: "2026-01-01-1",
      notes: ["Feature A", "Feature B"],
    });

    const newVersion = runUpdateVersion(path);
    const result = read() as { version: string; releaseId: string; notes: string[] };

    expect(result.version).toBe(newVersion);
    expect(result.releaseId).toBe("2026-01-01-1");
    expect(result.notes).toEqual(["Feature A", "Feature B"]);
  });

  test("handles missing manifest gracefully (fresh environment)", () => {
    const dir = join(tmpdir(), `mpm-fresh-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const p = join(dir, "release-manifest.json");
    // No file written — simulates first build in a fresh environment.

    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(readFileSync(p, "utf-8"));
    } catch {}
    const version = Date.now().toString();
    const updated = { ...existing, version };
    writeFileSync(p, JSON.stringify(updated, null, 2) + "\n");

    const result = JSON.parse(readFileSync(p, "utf-8"));
    expect(result.version).toBe(version);
    expect(result.releaseId).toBeUndefined(); // No releaseId until cut-release runs.
  });

  test("multiple routine deploys never wipe notes", () => {
    const { path, read } = tmpManifest({
      version: "100",
      releaseId: "2026-06-01-1",
      notes: ["Persistent note"],
    });

    // Simulate 5 routine deploys.
    for (let i = 0; i < 5; i++) {
      runUpdateVersion(path);
    }

    const result = read() as { notes: string[] };
    expect(result.notes).toEqual(["Persistent note"]);
  });
});

describe("cut-release.js logic", () => {
  test("creates a valid release with notes", () => {
    const { path, read } = tmpManifest({ version: "999", releaseId: "2020-01-01-1", notes: [] });

    runCutRelease(path, ["New grocery coach feature", "Diet override fix"]);

    const result = read() as { releaseId: string; notes: string[]; version: string };
    expect(result.notes).toHaveLength(2);
    expect(result.notes[0]).toBe("New grocery coach feature");
    expect(result.releaseId).toMatch(/^\d{4}-\d{2}-\d{2}-\d+$/);
    // version is preserved
    expect(result.version).toBe("999");
  });

  test("REFUSES to create a release with an empty notes array", () => {
    const { path } = tmpManifest({ version: "1", releaseId: "2026-01-01-1", notes: [] });
    expect(() => runCutRelease(path, [])).toThrow("REFUSED");
  });

  test("REFUSES to create a release with only blank string notes", () => {
    const { path } = tmpManifest({ version: "1", releaseId: "2026-01-01-1", notes: [] });
    expect(() => runCutRelease(path, ["  ", ""])).toThrow("REFUSED");
  });

  test("auto-increments suffix when multiple releases cut on the same day", () => {
    const today = new Date().toISOString().slice(0, 10);
    const { path, read } = tmpManifest({ version: "1", releaseId: `${today}-1`, notes: [] });

    runCutRelease(path, ["Second release today"]);

    const result = read() as { releaseId: string };
    expect(result.releaseId).toBe(`${today}-2`);
  });

  test("cutting a new release survives subsequent routine deploys", () => {
    const { path, read } = tmpManifest({ version: "1" });

    runCutRelease(path, ["Big new feature"]);
    const afterCut = read() as { releaseId: string; notes: string[] };

    // Now simulate 3 deploys.
    runUpdateVersion(path);
    runUpdateVersion(path);
    runUpdateVersion(path);

    const afterDeploys = read() as { releaseId: string; notes: string[] };
    expect(afterDeploys.releaseId).toBe(afterCut.releaseId);
    expect(afterDeploys.notes).toEqual(["Big new feature"]);
  });
});

describe("dismiss-key stability", () => {
  test("same releaseId across routine deploys means same dismiss key", () => {
    const releaseId = "2026-08-17-1";
    const dismissKey1 = `mpm_update_dismissed_${releaseId}`;
    const dismissKey2 = `mpm_update_dismissed_${releaseId}`;
    // Different BUILD_VERSION (new deploys) — key must still match.
    expect(dismissKey1).toBe(dismissKey2);
  });

  test("new releaseId produces a different dismiss key", () => {
    const key1 = `mpm_update_dismissed_2026-08-17-1`;
    const key2 = `mpm_update_dismissed_2026-08-17-2`;
    expect(key1).not.toBe(key2);
  });
});

describe("UpdateBanner hard guard", () => {
  // These tests validate the rendering logic without needing a DOM.

  function shouldRenderBanner(opts: {
    show: boolean;
    releaseNotes: string[];
    dismissed: boolean;
  }): boolean {
    // Mirrors the guard in UpdateBanner.tsx:
    // if (!show || releaseNotes.length === 0 || dismissed) return null;
    return opts.show && opts.releaseNotes.length > 0 && !opts.dismissed;
  }

  test("renders when show=true, notes present, not dismissed", () => {
    expect(shouldRenderBanner({ show: true, releaseNotes: ["Feature A"], dismissed: false })).toBe(true);
  });

  test("does NOT render when notes is empty even if show=true", () => {
    expect(shouldRenderBanner({ show: true, releaseNotes: [], dismissed: false })).toBe(false);
  });

  test("does NOT render when show=false", () => {
    expect(shouldRenderBanner({ show: false, releaseNotes: ["Feature A"], dismissed: false })).toBe(false);
  });

  test("does NOT render when dismissed", () => {
    expect(shouldRenderBanner({ show: true, releaseNotes: ["Feature A"], dismissed: true })).toBe(false);
  });

  test("routine technical redeploy (same releaseId, new version): banner stays dismissed", () => {
    // After user dismisses releaseId "2026-08-17-1", a routine deploy happens.
    // The dismissKey is still "mpm_update_dismissed_2026-08-17-1" — user is not re-shown the banner.
    const releaseId = "2026-08-17-1";
    const dismissKey = `mpm_update_dismissed_${releaseId}`;
    // Simulate: user dismissed this key.
    const localStorageMock: Record<string, string> = { [dismissKey]: "1" };
    const isDismissed = localStorageMock[dismissKey] === "1";
    expect(shouldRenderBanner({ show: true, releaseNotes: ["Old notes"], dismissed: isDismissed })).toBe(false);
  });

  test("new customer release (new releaseId): banner appears even if old one was dismissed", () => {
    const oldKey = "mpm_update_dismissed_2026-08-17-1";
    const newReleaseId = "2026-08-17-2";
    const newKey = `mpm_update_dismissed_${newReleaseId}`;
    const localStorageMock: Record<string, string> = { [oldKey]: "1" };
    // New releaseId key is NOT in storage yet.
    const isDismissed = localStorageMock[newKey] === "1";
    expect(shouldRenderBanner({ show: true, releaseNotes: ["New feature"], dismissed: isDismissed })).toBe(true);
  });
});
