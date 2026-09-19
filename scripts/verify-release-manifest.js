#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicPath =
  process.env.RELEASE_PUBLIC_MANIFEST_PATH ??
  path.join(root, "client/public/release-manifest.json");
const distPath =
  process.env.RELEASE_DIST_MANIFEST_PATH ??
  path.join(root, "client/dist/release-manifest.json");

function readManifest(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read release manifest at ${filePath}: ${error.message}`);
  }
}

function releaseRecord(manifest) {
  const notes = Array.isArray(manifest.notes) ? manifest.notes : [];
  if (
    typeof manifest.releaseId !== "string" ||
    !manifest.releaseId.trim() ||
    typeof manifest.releasedAt !== "string" ||
    Number.isNaN(Date.parse(manifest.releasedAt)) ||
    !notes.length ||
    notes.some((note) => typeof note !== "string" || !note.trim())
  ) {
    throw new Error("Release manifest does not contain a coherent customer release record.");
  }
  return {
    releaseId: manifest.releaseId,
    releasedAt: manifest.releasedAt,
    notes,
  };
}

const publicManifest = readManifest(publicPath);
const distManifest = readManifest(distPath);
const publicRelease = releaseRecord(publicManifest);
const distRelease = releaseRecord(distManifest);

for (const field of ["version", "gitSha", "buildTimestamp", "environment"]) {
  if (publicManifest[field] !== distManifest[field]) {
    throw new Error(`Built release manifest is stale: ${field} differs from client/public.`);
  }
}
if (JSON.stringify(publicRelease) !== JSON.stringify(distRelease)) {
  throw new Error("Built release manifest customer release differs from client/public.");
}

console.log(`✅ Built release manifest verified: ${distRelease.releaseId}`);