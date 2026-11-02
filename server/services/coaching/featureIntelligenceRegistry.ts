import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Registry } from "../../../scripts/feature-intelligence/types";
import { featureIntelligenceEnabled } from "./featureIntelligence";
const snapshotShape = z.object({
  schemaVersion: z.literal(1), environment: z.literal("development"), audience: z.literal("engineering_only"),
  authority: z.literal("evidence_not_permissions"),
  features: z.array(z.object({
    id: z.string(), kind: z.enum(["feature", "page"]), name: z.string().nullable(), description: z.string().nullable(),
    aliases: z.array(z.string()), route: z.string().nullable(),
    workflows: z.array(z.string()), limitations: z.array(z.string()), gaps: z.array(z.string()),
    sources: z.array(z.object({ file: z.string(), line: z.number().int().positive() })),
    audience: z.enum(["member", "professional", "organization_admin"]),
    availability: z.enum(["available", "coming_soon", "disabled", "unknown"]),
    verification: z.enum(["verified", "partial", "unverified", "stale", "contradictory"]),
    classification: z.object({
      status: z.enum(["active", "restricted", "coming_soon", "legacy_unused", "unverified"]),
      internal: z.boolean(), redirect: z.boolean(),
    }),
  })).max(2000),
});

/** Disabled means no filesystem reads. Never scan or execute application source.
 * The offline watcher/validator owns freshness and marks changed records stale.
 * The digest prevents consuming a partially refreshed multi-file snapshot. */
export function loadFeatureIntelligenceRegistry(
  env: Record<string, string | undefined> = process.env, root = process.cwd(),
): Registry | undefined {
  if (!featureIntelligenceEnabled(env)) return undefined;
  const file = path.join(root, "generated-artifacts/feature-intelligence/registry.json");
  try {
    if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size > 16 * 1024 * 1024)
      return undefined;
    const registry = JSON.parse(fs.readFileSync(file, "utf8")) as Registry;
    if (!snapshotShape.safeParse(registry).success) return undefined;
    const stateFile = path.join(root, "generated-artifacts/feature-intelligence/state.json");
    if (fs.lstatSync(stateFile).isSymbolicLink() || fs.statSync(stateFile).size > 64 * 1024 * 1024) return undefined;
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (state.registryFingerprint !== createHash("sha256").update(JSON.stringify(registry)).digest("hex"))
      return undefined;
    for (const [source, hash] of Object.entries(state.buildHashes ?? {})) {
      if (!["client/index.html", "package.json", "vite.config.ts", "client/vite.config.ts", ".replit"].includes(source)) return undefined;
      if (!fs.existsSync(path.join(root, source)) ||
          createHash("sha256").update(fs.readFileSync(path.join(root, source))).digest("hex") !== hash) return undefined;
    }
    if (!state.buildHashes) return undefined;
    return registry;
  } catch {
    // A missing/unreadable artifact is an explicit lack of verified knowledge,
    // never permission to query a model and invent replacement descriptions.
    return undefined;
  }
}
