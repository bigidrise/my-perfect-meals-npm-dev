/** Offline engineering evidence. None of these objects grant access or navigation. */
export interface SourceReference {
  file: string;
  line: number;
}
export interface ControlFact {
  label: string | null;
  handler: string | null;
  destinations: string[];
  requests: string[];
  disabledState: "always" | "conditional" | "not_declared";
  source: SourceReference;
}
export interface RouteFact {
  path: string;
  components: string[];
  source: SourceReference;
}
export interface ApiFact {
  method: string;
  path: string;
  middleware: string[];
  source: SourceReference;
}
export interface SymbolFact {
  references: string[];
  modules: string[];
}
export interface FileFacts {
  hash: string;
  imports: Record<string, string>;
  moduleSpecifiers: Record<string, string | null>;
  dependencies: string[];
  renderedModules: string[];
  symbols: Record<string, SymbolFact>;
  routes: RouteFact[];
  controls: ControlFact[];
  api: ApiFact[];
  mounts: Array<{ path: string; module: string }>;
  requests: string[];
  headings: string[];
  primaryHeadings: string[];
  availabilityMarkers: SourceReference[];
  unresolvedRoutes: SourceReference[];
  legacyFeatures: Array<{ id: string; name: string; route: string; aliases: string[]; source: SourceReference }>;
}
export interface KnowledgeFact {
  id: string;
  name: string;
  description: string;
  aliases: string[];
  route: string | null;
  access: string;
  audience: "member" | "professional" | "organization_admin";
  availability: "available" | "coming_soon" | "disabled" | "unknown";
  reviewed: boolean;
  limitations: string[];
  workflows: string[];
  sources: SourceReference[];
}
export interface FeatureRecord {
  id: string;
  kind: "feature" | "page";
  name: string | null;
  nameEvidence: "existing_knowledge" | "source_heading" | "missing";
  nameCandidates: string[];
  description: string | null;
  aliases: string[];
  route: string | null;
  audience: "member" | "professional" | "organization_admin";
  access: { documented: string | null; observedGuards: string[]; authoritativeAtRuntime: true };
  availability: KnowledgeFact["availability"];
  verification: "verified" | "partial" | "unverified" | "stale" | "contradictory";
  verificationScope: "source_backed_documentation_only";
  confidence: "reviewed_metadata" | "structural_evidence_only" | "insufficient";
  limitations: string[];
  workflows: string[];
  controls: ControlFact[];
  backendEvidence: Array<ApiFact & { match: "exact" | "suffix_only" }>;
  relatedFeatureIds: string[];
  navigationTargetIds: string[];
  sources: SourceReference[];
  dependencyFiles: string[];
  gaps: string[];
  knowledgeFingerprint: string;
  implementationFingerprint: string;
}
export interface Registry {
  schemaVersion: 1;
  environment: "development";
  runtimeIntegration: "not_connected";
  audience: "engineering_only";
  authority: "evidence_not_permissions";
  features: FeatureRecord[];
}
export interface ScanState {
  schemaVersion: 1;
  analyzerFingerprint: string;
  files: Record<string, FileFacts>;
  records: Record<string, {
    knowledgeFingerprint: string;
    implementationFingerprint: string;
    fingerprint: string;
    stale: boolean;
  }>;
}
export interface ScanResult {
  files: Record<string, FileFacts>;
  changedFiles: string[];
  removedFiles: string[];
  parsedFiles: number;
  reusedFiles: number;
}
