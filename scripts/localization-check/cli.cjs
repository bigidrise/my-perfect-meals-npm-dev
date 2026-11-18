#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { analyze, introduced, normalize } = require("./analyze.cjs");
const { loadResources, resourceFindings } = require("./resources.cjs");
const configPath = "docs/localization/new-interface-text.json";
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const inScope = file => /^(client\/src|server|shared)\/.*\.[jt]sx?$/.test(file) &&
  !/(?:^|\/)(__tests__|__mocks__|legacy|\.generated)\//.test(file) && !/\.(test|spec|d)\.[jt]sx?$/.test(file) &&
  !file.startsWith("client/src/i18n/") && file !== "shared/consumerStartupCopy.ts";
function check(root, { base: explicitBase } = {}) {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
  const read = file => fs.readFileSync(path.join(root, file), "utf8");
  const config = JSON.parse(read(configPath));
  if (config.version !== 1 || !/^[a-f0-9]{40}$/.test(config.adoptionBase) || !Array.isArray(config.exceptions))
    throw Error(`Invalid ${configPath}; adoptionBase must be a full commit SHA and exceptions an array.`);
  const adoption = git("rev-parse", "--verify", `${config.adoptionBase}^{commit}`);
  const requested = explicitBase || adoption;
  if (!/^[a-zA-Z0-9_./~-]+$/.test(requested) || requested.startsWith("-")) throw Error("Invalid comparison reference.");
  const base = git("rev-parse", "--verify", `${requested}^{commit}`);
  // An explicit PR base may advance the comparison, never precede the adoption boundary.
  git("merge-base", "--is-ancestor", adoption, base);
  git("merge-base", "--is-ancestor", base, "HEAD");
  const baseFiles = new Set(git("ls-tree", "-r", "--name-only", base).split("\n"));
  const oldRead = file => {
    if (!baseFiles.has(file)) throw Error(`Required comparison resource missing at base: ${file}`);
    return git("show", `${base}:${file}`);
  };
  const changed = new Set([
    ...git("diff", "--name-only", "--no-renames", base, "--", "client/src", "server", "shared").split("\n"),
    ...git("ls-files", "--others", "--exclude-standard", "--", "client/src", "server", "shared").split("\n"),
  ].filter(inScope));
  const beforeResources = loadResources(oldRead), afterResources = loadResources(read);
  function protectedTexts(reader) {
    const registry = JSON.parse(reader("docs/localization/clinical-registry.json"));
    return new Set((registry.allStrings || []).map(item => normalize(item.text)));
  }
  const beforeProtected = protectedTexts(oldRead), afterProtected = protectedTexts(read);
  let findings = introduced(resourceFindings(beforeResources), resourceFindings(afterResources));
  let scanned = 0;
  for (const file of [...changed].sort()) {
    if (!fs.existsSync(path.join(root, file))) continue; // Deletions cannot introduce rendered copy.
    const text = read(file);
    const previous = baseFiles.has(file) ? analyze(file, oldRead(file), beforeResources, beforeProtected) : [];
    findings.push(...introduced(previous, analyze(file, text, afterResources, afterProtected)));
    scanned++;
  }
  const applied = [], seen = new Set();
  for (const exception of config.exceptions) {
    if (!inScope(exception.owner) || !["non-target", "bounded-connection"].includes(exception.disposition) ||
      typeof exception.reason !== "string" || exception.reason.trim().length < 20 ||
      typeof exception.evidence !== "string" || exception.evidence.includes("..") ||
      !exception.evidence.startsWith("docs/localization/") || !fs.existsSync(path.join(root, exception.evidence)) ||
      !/^[a-f0-9]{64}$/.test(exception.sourceSha256 || "") || !exception.kind || !exception.text)
      throw Error("Invalid exception: exact owner/kind/text/hash, substantive reason, disposition and local review evidence required.");
    const id = JSON.stringify([exception.owner, exception.kind, exception.text]);
    if (seen.has(id)) throw Error("Duplicate exception.");
    seen.add(id);
    if (!fs.existsSync(path.join(root, exception.owner)) || hash(read(exception.owner)) !== exception.sourceSha256)
      throw Error(`Stale exception; review current source: ${exception.owner}`);
    findings = findings.filter(item => {
      if (item.owner !== exception.owner || item.kind !== exception.kind || item.text !== exception.text) return true;
      if (item.classification !== "review") throw Error(`Exception cannot suppress ${item.classification}: ${item.owner}:${item.line}`);
      if (exception.disposition === "bounded-connection" && item.kind !== "connection")
        throw Error("Bounded-connection exception must identify a dynamic translation call.");
      if (exception.disposition === "non-target" && item.kind === "connection")
        throw Error("A dynamic translation call needs bounded-connection evidence, not a technical/data exemption.");
      applied.push({ ...item, disposition: exception.disposition, reason: exception.reason, evidence: exception.evidence });
      return false;
    });
  }
  return {
    comparisonBase: base, adoptionBase: adoption, scannedChangedFiles: scanned,
    findings, appliedExceptions: applied,
    limits: [
      "Incremental source guard, not runtime visibility, semantic translation quality or all-platform completion.",
      "JSX/display props, selected producer/config fields, shared copy arrays and recognized translation bindings only.",
      "Dynamic/config/data ownership findings require human review; they are not confirmed customer defects.",
      "Unchanged historical debt is not waived; existing release, localization and clinical gates still apply.",
      "No accounts, application imports, network requests, provider calls or writes.",
    ],
  };
}
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    let base, json = false;
    for (let index = 0; index < args.length; index++) {
      if (args[index] === "--json") json = true;
      else if (args[index] === "--base" && args[index + 1]) base = args[++index];
      else throw Error(`Unknown/incomplete argument: ${args[index]}`);
    }
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
    const report = check(root, { base });
    if (json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`New interface text: ${report.scannedChangedFiles} changed source files; base ${report.comparisonBase}`);
      for (const item of report.findings)
        console.log(`${item.owner}:${item.line} [${item.classification}] ${item.kind}: ${JSON.stringify(item.text)}\n  ${item.detail || "Connect EN/ES at the text owner; do not translate arbitrary runtime content."}`);
      for (const item of report.appliedExceptions) console.log(`Reviewed exception: ${item.owner}:${item.line} — ${item.reason}`);
      console.log(report.findings.length ? `FAIL: ${report.findings.length} new connection/review items.` : "PASS: no new unresolved interface-copy findings within the documented scope.");
      console.log("Existing release gates are independent and are not declared passing by this check.");
    }
    process.exitCode = report.findings.length ? 1 : 0;
  } catch (error) {
    console.error(`Localization check could not run: ${error.message}\nSupply an available ancestor --base at/after adoption; fetch missing history. Never substitute HEAD or skip the check to obtain a pass.`);
    process.exitCode = 2;
  }
}
module.exports = { check, inScope };
