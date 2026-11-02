import type { FeatureRecord } from "./types";

/** Mechanical descriptions of witnessed navigation, never inferred promises. */
export function enrich(records: FeatureRecord[]) {
  for (const record of records) {
    if (record.description) {
      record.enrichment = { summary: record.description, evidence: record.sources,
        kind: record.verification === "verified" ? "reviewed_documentation" : "insufficient" };
      continue;
    }
    const targets = records.filter(target => record.navigationTargetIds.includes(target.id) &&
      target.name && target.verification === "verified" &&
      ["active", "restricted"].includes(target.classification?.status ?? "") && !target.classification?.internal);
    const names = [...new Set(targets.map(target => target.name!))].sort();
    const eligible = !!record.name && ["active", "restricted"].includes(record.classification?.status ?? "") &&
      !record.classification?.internal && !record.classification?.redirect;
    record.enrichment = { summary: eligible && names.length
      ? `${record.name} includes navigation to ${names.join(", ")}. Each destination owns its actions and access checks.` : null,
      evidence: eligible && names.length ? record.controls.filter(control => control.destinations.length).map(control => control.source) : [],
      kind: eligible && names.length ? "structural_summary" : "insufficient" };
    // Structural enrichment is deliberately not promoted to verified purpose.
  }
}
