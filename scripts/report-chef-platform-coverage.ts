/**
 * Owner-facing source audit, not a runtime service or member knowledge source.
 * Run: tsx scripts/report-chef-platform-coverage.ts
 */
import fs from "node:fs";
import path from "node:path";
import { buildPlatformFeatureCatalog } from "../server/services/coaching/platformFeatureCatalog";
import { getDevelopmentPlatformKnowledge } from "../server/services/coaching/platformKnowledge";

const catalog = buildPlatformFeatureCatalog();
const knowledge = getDevelopmentPlatformKnowledge();
const routerSource = fs.readFileSync("client/src/components/Router.tsx", "utf8");
const routes = [...routerSource.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]);
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const list = (values: string[]) => `<ul>${values.map(value => `<li>${escape(value)}</li>`).join("")}</ul>`;
const featureRows = catalog.map(fact => `<section><h2>${escape(fact.name)}</h2>
<p><strong>${escape(fact.verification)} · ${escape(fact.audience)}</strong></p>
<dl><dt>Aliases</dt><dd>${list(fact.aliases)}</dd>
<dt>Purpose</dt><dd>${escape(fact.purpose)}</dd>
<dt>Member goals</dt><dd>${list(fact.goals)}</dd>
<dt>Does not do</dt><dd>${list(fact.doesNotDo)}</dd>
<dt>Getting started</dt><dd>${list(fact.gettingStarted)}</dd>
<dt>Outputs</dt><dd>${escape(fact.outputs)}</dd>
<dt>Destination</dt><dd>${escape(fact.route ?? "No verified general destination / contextual entry only")}</dd>
<dt>Access</dt><dd>${escape(fact.access)}</dd>
<dt>Source evidence</dt><dd>${list(fact.evidence)}</dd></dl></section>`).join("");
const routeRows = routes.map(route => {
  const facts = catalog.filter(fact => fact.route === route);
  return `<tr><td>${escape(route)}</td><td>${escape(facts.map(fact => fact.name).join("; ") || "No detailed catalog record")}</td>
  <td>${escape(facts.length ? facts.map(fact => fact.verification).join("; ") : "UNCERTAIN: route registration only; controls, outputs and access not completely audited")}</td></tr>`;
}).join("");
const overview = knowledge?.features.map(fact =>
  `<tr><td>${escape(fact.label)}</td><td>${escape(fact.purpose)}</td><td>${escape(fact.entryPoint)}</td><td>${escape(fact.access)}</td></tr>`).join("") ?? "";
const unavailable = knowledge?.unavailableFeatures.map(fact =>
  `<li><strong>${escape(fact.label)} — ${escape(fact.status)}</strong>: ${escape(fact.purpose)}</li>`).join("") ?? "";
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ask Chef Platform Knowledge Coverage</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:1200px;margin:32px auto;padding:0 20px;background:#faf9f6;color:#262220}h1,h2{color:#863c12}section{border-top:1px solid #d4c7bc;margin-top:32px;padding-top:16px}dt{font-weight:700;margin-top:10px}dd{margin-left:16px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #cbbfb4;padding:8px;text-align:left;vertical-align:top}li{margin:4px 0}strong{font-weight:700}.notice{background:#fff0d5;border-left:4px solid #a14c15;padding:16px}</style>
<h1>Ask Chef: Source-Verified Knowledge Coverage</h1>
<p>Owner review report. Generated ${escape(new Date().toISOString())}. No private account or conversation data.</p>
<div class="notice"><strong>This is not a claim of complete platform coverage.</strong>
The route inventory contains ${routes.length} literal registrations; these are not ${routes.length} independent features.
The structured catalog documents ${catalog.length} workflows: ${catalog.filter(fact => fact.verification === "verified").length} verified and ${catalog.filter(fact => fact.verification === "partial").length} partial.
Unmatched routes remain explicitly uncertain. “Verified” means the listed interface facts have source evidence, not clinical validation or a live test of every control.
The inventory does not resolve dynamically computed routes, feature flags, deployment state or personalized eligibility.</div>
<h2>Corrections and limits</h2><ul>
<li>Academy location and existing certification controls were missing from detailed guidance; now documented.</li>
<li>Organization invitations and professional account boundaries are scoped to server-proven authority, not member claims. No client evidence is supplied.</li>
<li>Find Meals Near Me uses restaurant-filtered search. Dedicated ice cream shops, bars, retailers, live inventory and exact menu availability are not verified.</li>
<li>Existing approved destination descriptions and controls are reused; the new catalog does not duplicate them in the model prompt.</li>
<li>All other route-only entries need source-level review before detailed guidance is added. Do not infer steps or eligibility from a registered route.</li>
<li>Complete allergy/avoidance and persistent food-preference context coverage remains a separate limitation; destination safeguards stay authoritative.</li>
</ul><h2>Unavailable and paused features</h2><ul>${unavailable}</ul>
<h2>Existing broad knowledge retained</h2><p>These descriptions predate this change; retention is not a fresh end-to-end verification of every feature.</p>
<table><tr><th>Feature</th><th>Purpose</th><th>Entry</th><th>Access</th></tr>${overview}</table>
<h2>Detailed feature records</h2>${featureRows}
<h2>Complete literal route inventory</h2><p>Source: client/src/components/Router.tsx. Registration does not establish activation, authorization, safe deep linking or complete feature knowledge. This internal inventory is never sent to members or the model.</p>
<table><tr><th>Registered route</th><th>Detailed record</th><th>Review status</th></tr>${routeRows}</table></html>`;
const output = path.resolve("generated-artifacts/ask-chef-platform-coverage.html");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log(`Coverage report: ${output} (${routes.length} routes; ${catalog.length} detailed records)`);
