import type { Registry } from "../../../scripts/feature-intelligence/types";
import type { ChefKnowledgeAccess } from "./platformKnowledgeAccess";
import { COACH_DESTINATIONS } from "../../../shared/coaching/navigation";

export interface FeatureScreenContext { currentRoute?: string }
export interface FeatureExplanation {
  id: string; name: string; description: string; aliases: string[]; route: string | null;
  workflows: string[]; limitations: string[];
}
export function featureIntelligenceEnabled(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV === "development" && !env.REPLIT_DEPLOYMENT &&
    env.ASK_CHEF_FEATURE_INTELLIGENCE === "true";
}
export function safeScreenContext(value: unknown): FeatureScreenContext | undefined {
  const route = (value as FeatureScreenContext | null)?.currentRoute;
  return typeof route === "string" && route.length <= 200 && /^\/[a-zA-Z0-9_/-]*$/.test(route) &&
    !/\/(?:admin|dev|debug|test|demo)(?:\/|$)/i.test(route) ? { currentRoute: route } : undefined;
}
const norm = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const clean = (text: unknown): text is string => typeof text === "string" && !!text.trim() && text.length <= 6000 &&
  !/(?:\b(?:server|client|shared)\/|\.tsx?\b|\/api\/|javascript:)/i.test(text);

/** Whitelist projection only: never send source refs, raw routes, guards or APIs. */
export function projectFeatureKnowledge(registry: Registry, access: ChefKnowledgeAccess | undefined, toolIds: string[]): FeatureExplanation[] {
  if (registry?.schemaVersion !== 1 || registry.environment !== "development" ||
      registry.audience !== "engineering_only" || registry.authority !== "evidence_not_permissions" ||
      !Array.isArray(registry.features)) return [];
  return registry.features.filter(record => record?.kind === "feature" && record.verification === "verified" &&
    record.confidence === "reviewed_metadata" && record.verificationScope === "source_backed_documentation_only" &&
    clean(record.name) && clean(record.description) && Array.isArray(record.sources) && record.sources.length > 0 &&
    Array.isArray(record.gaps) && !record.gaps.some(gap => /changed|contradict|disagreement|not_registered|missing/.test(gap)) &&
    ["active", "restricted"].includes(record.classification?.status ?? "") &&
    !record.classification?.internal && !record.classification?.redirect &&
    !["coming_soon", "disabled"].includes(record.availability) &&
    (record.audience === "member" || (record.audience === "professional" && access?.professional === true) ||
      (record.audience === "organization_admin" && access?.organizationAdmin === true)) &&
    (!(record.id.slice(8) in COACH_DESTINATIONS) || toolIds.includes(record.id.slice(8))))
    .map(record => ({ id: record.id, name: record.name!, description: record.description!,
      aliases: (record.aliases ?? []).filter(clean), route: record.route,
      workflows: (record.workflows ?? []).filter(clean).slice(0, 4),
      limitations: (record.limitations ?? []).filter(clean).slice(0, 3) }));
}

/** Bounded feature-help recognition, not general nutrition/medical intent routing.
 * Every answer is explanation-only. Navigation/execution stay in existing code. */
export function explainFeatureQuestion(input: {
  message: string; records: FeatureExplanation[]; context?: FeatureScreenContext; withheldLabels?: string[];
}): { kind: "explanation" | "clarification" | "unsupported"; message: string } | null {
  const question = norm(input.message);
  const self = /^(?:what (?:do|can) you do|what (?:is|does|can) ask chef(?: do)?|(?:tell me about|explain) (?:yourself|ask chef)|how (?:does ask chef work|can you help)(?: me)?)$/.test(question);
  const contextual = /\b(?:this (?:feature|tool|screen|page)|what am i looking at)\b/.test(question);
  const clarification = { kind: "clarification" as const,
    message: "Which My Perfect Meals feature do you mean? Please use its name or tell me which screen you are viewing. I won't guess what an unverified feature can do." };
  if (/\b(?:diagnose|prescribe|grant (?:me )?access|bypass|automatically (?:save|send|generate)|execute)\b/.test(question))
    return { kind: "unsupported", message: "Ask Chef can explain supported My Perfect Meals workflows. It cannot diagnose, prescribe, grant access, bypass safeguards or automatically execute feature actions from this explanation." };
  // Explicit navigation/consent remains owned by the established pipeline.
  if (/^(?:open|launch|take me to|go to|yes|please open)\b/.test(question)) return null;
  let matches = self ? input.records.filter(record => record.id === "feature:ask_chef") : [];
  if (!self) {
    const padded = ` ${question} `;
    const hits = input.records.flatMap(record => [record.name, ...record.aliases].map(alias => ({
      record, label: norm(alias),
    }))).filter(hit => hit.label.length >= 3 && padded.includes(` ${hit.label} `));
    // Longer official names win over contained aliases, but independent feature
    // names/duplicate aliases remain ambiguous rather than defaulting to one.
    const maximal = hits.filter(hit => !hits.some(other => other.label !== hit.label &&
      ` ${other.label} `.includes(` ${hit.label} `)));
    matches = [...new Map(maximal.map(hit => [hit.record.id, hit.record])).values()];
    if (!matches.length && contextual) {
      const route = safeScreenContext(input.context)?.currentRoute;
      if (route) matches = input.records.filter(record => record.route === route);
    }
  }
  const featureQuestion = self || contextual || matches.length > 0 && /\b(?:what|how|explain|about|difference|compare|help)\b/.test(question) ||
    (input.withheldLabels ?? []).some(label => label.length >= 3 && ` ${question} `.includes(` ${norm(label)} `)) &&
      /\b(?:what|how|explain|about|compare)\b/.test(question) ||
    /\b(?:feature|tool|capability|creator|builder|studio|grocery|my perfect|mpm|scan)\b/.test(question) &&
      /\b(?:what|how|explain|can)\b/.test(question);
  if (!featureQuestion) return null;
  if (!matches.length) return clarification;
  const comparison = /\b(?:compare|difference|different|versus|vs)\b/.test(question);
  if (matches.length > 1 && (!comparison || matches.length > 2))
    return { kind: "clarification", message: `Do you mean ${matches.map(record => record.name).join(" or ")}? These are different workflows; I won't choose one without clarification.` };
  const howTo = /\b(?:how|use|start)\b/.test(question) && !self;
  const answer = matches.map(record => [
    `${record.name}: ${record.description}`,
    ...(howTo ? record.workflows : []), ...record.limitations,
  ].join(" ")).join("\n\n");
  return { kind: "explanation", message: answer +
    "\n\nThis explains the feature; it does not open it or execute an action. Existing subscription, role, clinical and destination checks still apply." };
}
