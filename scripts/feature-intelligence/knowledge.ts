import fs from "node:fs";
import path from "node:path";
import { buildPlatformFeatureCatalog } from "../../server/services/coaching/platformFeatureCatalog";
import { getDevelopmentPlatformKnowledge } from "../../server/services/coaching/platformKnowledge";
import { MPM_CAPABILITIES } from "../../server/services/coaching/capabilityRegistry";
import type { KnowledgeFact, SourceReference } from "./types";

/** Read existing pure catalogs. No server bootstrap, DB, model, auth, or network imports. */
export function existingKnowledge(root: string): KnowledgeFact[] {
  const reference = (file: string, id: string): SourceReference => {
    const full = path.join(root, file);
    const lines = fs.existsSync(full) ? fs.readFileSync(full, "utf8").split("\n") : [];
    const line = lines.findIndex(text => text.includes(`"${id}"`) || text.includes(`${id}:`));
    return { file, line: line < 0 ? 1 : line + 1 };
  };
  const facts = new Map<string, KnowledgeFact>();
  for (const feature of buildPlatformFeatureCatalog({ featureIntelligence: true })) {
    facts.set(feature.id, {
      id: feature.id, name: feature.name, description: feature.purpose, aliases: feature.aliases,
      ...(feature.independentBackendEntry ? { independentBackendEntry: feature.independentBackendEntry } : {}),
      route: feature.route, access: feature.access, audience: feature.audience,
      availability: feature.verification === "unavailable" ? "disabled" : "unknown",
      reviewed: feature.verification === "verified", limitations: feature.doesNotDo, workflows: feature.gettingStarted,
      sources: [...new Set(["server/services/coaching/platformFeatureCatalog.ts", ...feature.evidence])]
        .map(file => reference(file, feature.id)),
    });
  }
  const platform = getDevelopmentPlatformKnowledge();
  for (const feature of [...(platform?.features ?? []), ...(platform?.unavailableFeatures ?? [])]) {
    const prior = facts.get(feature.id);
    facts.set(feature.id, prior ? {
      ...prior, availability: feature.status,
      sources: [...prior.sources, reference("server/services/coaching/platformKnowledge.ts", feature.id)],
    } : {
      id: feature.id, name: feature.label, description: feature.purpose, aliases: [],
      route: null, access: feature.access, audience: "member", availability: feature.status,
      reviewed: false, limitations: [], workflows: [feature.entryPoint],
      sources: [reference("server/services/coaching/platformKnowledge.ts", feature.id)],
    });
  }
  // Legacy capabilities are evidence to audit, not proof that old routes still work.
  for (const feature of MPM_CAPABILITIES) if (!facts.has(feature.id)) {
    facts.set(feature.id, {
      id: feature.id, name: feature.label, description: feature.description, aliases: [],
      route: feature.route, access: feature.eligibilityNote ?? "Existing destination authorization remains authoritative.",
      audience: feature.scopes.includes("procare") && !feature.scopes.includes("all") ? "professional" : "member",
      availability: "unknown", reviewed: false, limitations: [], workflows: [],
      sources: [reference("server/services/coaching/capabilityRegistry.ts", feature.id)],
    });
  }
  return [...facts.values()].sort((a, b) => a.id.localeCompare(b.id));
}
