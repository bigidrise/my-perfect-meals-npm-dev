const crypto = require("node:crypto");
const { analyze } = require("./analyze.cjs");
const { lookup } = require("./resources.cjs");
const digest = text => crypto.createHash("sha256").update(text).digest("hex");
// Exact, founder-approved source moves/retirements, not clinical wording approval.
// Registry identities remain protected, including every retired identity.
function sourceDispositionIdentity(entry) {
  const base = `${entry.file}#${entry.proposedKey}`;
  return entry.line === undefined ? base : `${base}@${entry.line}`;
}

function hasSourceDisposition(accepted, entry) {
  return accepted.has(sourceDispositionIdentity(entry)) ||
    accepted.has(`${entry.file}#${entry.proposedKey}`);
}

function validateSourceDispositions(registry, document, read, resources) {
  if (document.version !== 1 || !Array.isArray(document.entries)) throw Error("Invalid clinical source disposition document");
  const accepted = new Map(), seen = new Set();
  for (const entry of document.entries) {
    const identity = sourceDispositionIdentity(entry);
    if (seen.has(identity)) throw Error(`Duplicate clinical source disposition: ${identity}`);
    seen.add(identity);
    const registered = registry.allStrings.filter(s =>
      s.file === entry.file &&
      s.proposedKey === entry.proposedKey &&
      (entry.line === undefined || s.line === entry.line));
    if (entry.line !== undefined &&
        (!Number.isInteger(entry.line) || entry.line < 1))
      throw Error(`Invalid clinical source occurrence: ${identity}`);
    if (registered.length !== 1 || registered[0].text !== entry.text || !entry.reason || !entry.evidence ||
        !entry.evidence.startsWith("docs/localization/") || entry.evidence.includes(".."))
      throw Error(`Invalid or stale clinical source identity: ${identity}`);
    read(entry.evidence);
    const source = read(entry.file);
    if (digest(source) !== entry.sourceSha256) throw Error(`Clinical source disposition needs renewed review: ${entry.file}`);
    if (entry.disposition === "retired") {
      if (source.includes(entry.text)) throw Error(`Retired clinical reference is active again: ${identity}`);
    } else if (entry.disposition === "localized-display-owner") {
      const { namespace, key } = entry.resource || {};
      if (!namespace || !key || lookup(resources, "en", namespace, key) !== entry.text ||
          typeof lookup(resources, "es", namespace, key) !== "string" ||
          !lookup(resources, "es", namespace, key).trim())
        throw Error(`Clinical display source/resource mismatch: ${identity}`);
      const findings = analyze(entry.file, source, resources, new Set([entry.text]));
      if (!findings.some(item => item.kind === "connection" &&
          item.text === `${namespace}:${key}` && item.classification === "protected-review"))
        throw Error(`Clinical display has no recognized bound translation call: ${identity}`);
    } else if (entry.disposition === "localized-rich-text-owner") {
      const { namespace, key, enSha256, esSha256 } = entry.resource || {};
      const en = lookup(resources, "en", namespace, key);
      const es = lookup(resources, "es", namespace, key);
      if (!Number.isInteger(entry.line) || !namespace || !key ||
          typeof en !== "string" || !en.trim() ||
          typeof es !== "string" || !es.trim() ||
          digest(en) !== enSha256 || digest(es) !== esSha256 ||
          !en.replace(/<\/?\d+>/g, "").includes(entry.text))
        throw Error(`Clinical rich-text source/resource mismatch: ${identity}`);

      const findings = analyze(entry.file, source, resources, new Set([entry.text]));
      const connections = findings.filter(item =>
        item.kind === "connection" && item.text === `${namespace}:${key}`);
      if (connections.length !== 1 ||
          connections[0].classification !== "protected-review")
        throw Error(`Clinical rich-text has no unique protected translation connection: ${identity}`);
    } else throw Error(`Unknown clinical source disposition: ${identity}`);
    accepted.set(identity, entry.disposition);
  }
  return accepted;
}
module.exports = { validateSourceDispositions, sourceDispositionIdentity, hasSourceDisposition };
