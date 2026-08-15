/**
 * update-version.js
 *
 * Runs as the first step of `npm run build`.
 *
 * 1. Reads the last deployed commit SHA from the manifest.
 * 2. Collects commits between that SHA and HEAD, filters internal noise.
 * 3. If meaningful commits exist: calls OpenAI to generate 1–5 user-facing notes.
 *    - Summarization fails → one generic fallback bullet.
 *    - No meaningful commits → empty notes (banner hides "What's New" section).
 * 4. Writes { version, commit, releasedAt, notes } to release-manifest.json.
 * 5. Never throws — deployment can never be blocked by this script.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "../client/public/release-manifest.json");
const buildVersionPath = path.join(__dirname, "../client/src/buildVersion.ts");

// ── Noise patterns — commits that carry no user-facing meaning ────────────
const NOISE_PATTERNS = [
  /^regenerate mockup/i,
  /^update generated mockup/i,
  /^published your app/i,
  /^snapshot \d/i,
  /^update project documentation/i,
  /^update the build version/i,
  /^update dependencies/i,
  /^(chore|ci|fix-lint|style|refactor|test|docs)\b/i,
  /^merge (pull request|branch)/i,
  /replit-commit-author/i,
];

function isNoise(msg) {
  return NOISE_PATTERNS.some((p) => p.test(msg.trim()));
}

// ── Git helpers ────────────────────────────────────────────────────────────
function getHeadSHA() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

function getMeaningfulCommits(sinceCommit) {
  try {
    // Use stored commit as baseline; fall back to last 40 commits if unavailable.
    const range = sinceCommit ? `${sinceCommit}..HEAD` : "HEAD~40..HEAD";
    const log = execSync(`git log ${range} --oneline --no-merges`, {
      encoding: "utf-8",
      timeout: 10000,
    }).trim();

    if (!log) return [];

    return log
      .split("\n")
      .map((line) => line.replace(/^[a-f0-9]+ /, "").trim()) // strip leading SHA
      .filter((msg) => msg && !isNoise(msg));
  } catch {
    return [];
  }
}

// ── OpenAI summarizer ─────────────────────────────────────────────────────
async function summarizeCommits(commits) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const commitList = commits.slice(0, 40).join("\n");
  const prompt =
    "Convert these technical commit messages into 1–5 concise user-facing release notes " +
    "for a nutrition and meal planning app called My Perfect Meals. " +
    "Do not invent features. Do not mention internal file names, tests, CI, refactors, " +
    "or implementation details. Only describe changes clearly supported by the commits. " +
    "Return a JSON array of strings and nothing else — no markdown, no explanation.\n\n" +
    "Commits:\n" +
    commitList;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`OpenAI API returned ${res.status}`);

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "[]";

  // Extract JSON array even if the model wraps it in markdown code fences.
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Response did not contain a JSON array");

  const notes = JSON.parse(match[0]);
  if (!Array.isArray(notes)) throw new Error("Parsed value is not an array");

  return notes
    .filter((n) => typeof n === "string" && n.trim().length > 0)
    .slice(0, 5);
}

// ── Main (top-level await — ESM only) ────────────────────────────────────
const version = Date.now().toString();
const releasedAt = new Date().toISOString();
const headSHA = getHeadSHA();

// Read last deployed commit SHA from the manifest.
let lastCommit = null;
try {
  const existing = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (typeof existing.commit === "string" && existing.commit.length >= 7) {
    lastCommit = existing.commit;
  }
} catch {
  // Manifest missing or malformed — will fall back to last-40 range.
}

const commits = getMeaningfulCommits(lastCommit);

let notes = [];

if (commits.length === 0) {
  // No user-facing changes detected — hide the "What's New" section.
  notes = [];
  console.log("ℹ️  No meaningful user-facing commits — What's New section will be hidden.");
} else {
  try {
    notes = await summarizeCommits(commits);
    if (notes.length === 0) throw new Error("Summarizer returned empty array");
    console.log(`✅ Release notes: generated ${notes.length} bullet(s) from ${commits.length} commit(s).`);
  } catch (err) {
    // Summarization failed — use a safe generic fallback rather than old notes.
    notes = ["Performance and stability improvements."];
    console.warn(`⚠️  Release note summarization failed (${err.message}) — using generic fallback.`);
  }
}

// Write manifest — always includes commit SHA and timestamp for traceability.
fs.writeFileSync(
  manifestPath,
  JSON.stringify({ version, commit: headSHA, releasedAt, notes }, null, 2)
);

// Write build version constant consumed by the client.
fs.writeFileSync(buildVersionPath, `export const BUILD_VERSION = "${version}";\n`);

console.log(`✅ Build version set to: ${version}`);
if (headSHA) console.log(`📦 Commit: ${headSHA}  Released: ${releasedAt}`);
