#!/usr/bin/env tsx
/**
 * Step 1B — Reachability & Dead-Code Audit
 * Classifies every client .tsx file by how reachable it is from the live router.
 * Read-only: touches ZERO production files.
 *
 * Classifications:
 *   ACTIVE           — reachable via an ungated or minimally-gated route (auth/onboarding only)
 *   CONDITIONAL      — reachable only through a subscription/role/admin/feature-flag gate
 *   HIDDEN_RESERVED  — has importers but no active route (e.g. future feature, modal child)
 *   QUARANTINED      — explicitly in legacy/ directory or RETIRED_ prefix
 *   UNKNOWN_REVIEW   — no route + no static importers, but no explicit decommission signal; needs human verification
 *   ORPHAN_DEAD      — no route + no static importers + explicit dead signal (RETIRED_ prefix, in legacy/, or deprecated comment)
 *
 * Output:
 *   scripts/i18n-reachability-report.json   (machine)
 *   scripts/i18n-combined-report.json       (1A + 1B cross-referenced)
 *   Console human summary
 */

import fs from "fs";
import path from "path";

const CLIENT_SRC = path.resolve("client/src");
const REPORT_1A = path.resolve("scripts/i18n-audit-report.json");
const REPORT_REACH = path.resolve("scripts/i18n-reachability-report.json");
const REPORT_COMBINED = path.resolve("scripts/i18n-combined-report.json");

// ── Gate classification ───────────────────────────────────────────────────────
// Map guard wrapper name → gate level label
const GATE_MAP: Record<string, string> = {
  BuilderAccessGuard: "paid_subscription",
  PaywallGuard: "paid_subscription",
  MealBuildersGuard: "paid_subscription",
  ProGuard: "pro_plan",
  ActualProGuard: "pro_plan",
  ClinicalGuard: "clinical_plan",
  ProCareStudioGuard: "procare_certified",
  CoachingAdminGate: "admin_specific",
  AdminGuard: "admin",
  BusinessSuiteGate: "business_plan",
  GatedBusinessCenter: "business_plan",
  GatedAffiliateDashboard: "business_plan",
  GatedAffiliateProgramOverview: "business_plan",
  GatedAffiliateOpportunities: "business_plan",
  GatedAffiliatePathPage: "business_plan",
  GatedCertificationDashboard: "business_plan",
  GatedCertificationLesson: "business_plan",
  GatedCertificationQuiz: "business_plan",
  GatedCertificationComplete: "business_plan",
  GatedCertificationCertificateView: "business_plan",
  GatedPartnerProgramsHub: "business_plan",
  GatedPartnerManagement: "business_plan",
  GatedHowPartnershipsWork: "business_plan",
  GatedFoundingAffiliatePage: "business_plan",
  GatedFoundingPartnerProgram: "business_plan",
  GatedAcademyLandingPage: "business_plan",
  GatedIndustryPartnerships: "business_plan",
  GatedPublicHealthcarePartnerships: "business_plan",
  GatedWhiteLabelSolutions: "business_plan",
  GatedBusinessCenterSection: "business_plan",
  GatedPartnerCenter: "business_plan",
  GuardedAdminCertifications: "admin",
  GuardedAdminCampaignManager: "admin",
  GuardedBugReportsDashboard: "admin",
  GuardedProPortal: "procare_certified",
  GuardedProClients: "procare_certified",
  GuardedProClientsPhysician: "procare_certified",
  GuardedWorkspaceShell: "procare_certified",
  GuardedProClientDashboard: "procare_certified",
  GuardedProClientNutritionPlan: "procare_certified",
  GuardedTrainerClientDashboard: "procare_certified",
  GuardedClinicianClientDashboard: "procare_certified",
  GuardedProBoardViewer: "procare_certified",
  GuardedProGeneralNutritionBuilder: "procare_certified",
  GuardedProPerformanceCompetitionBuilder: "procare_certified",
  GuardedProDiabeticBuilder: "procare_certified",
  GuardedProGLP1Builder: "procare_certified",
  GuardedProAntiInflammatoryBuilder: "procare_certified",
  GuardedProWeeklyBuilder: "procare_certified",
  GuardedProBeachBodyBuilder: "procare_certified",
  GuardedWeeklyMealBoard: "paid_subscription",
  GuardedBeachBodyBuilder: "paid_subscription",
  GuardedBuilders: "paid_subscription",
  GuardedMealBuilderSelection: "paid_subscription",
  GuardedGeneralNutritionBuilderEntry: "paid_subscription",
  GuardedGeneralNutritionBuilder: "paid_subscription",
  GuardedPerformanceBuilder: "clinical_plan",
  GuardedPerformanceHub: "clinical_plan",
  GuardedPerformanceSetup: "clinical_plan",
  GuardedDiabeticBuilder: "paid_subscription",
  GuardedGLP1Builder: "paid_subscription",
  GuardedSavedMeals: "paid_subscription",
  GuardedShoppingList: "paid_subscription",
  GuardedCravingCreator: "paid_subscription",
  GuardedCravingCreatorLanding: "paid_subscription",
  GuardedCravingDesserts: "paid_subscription",
  GuardedSushiCreator: "paid_subscription",
  GuardedBeverageCreator: "paid_subscription",
  GuardedBeverageCreatorHub: "paid_subscription",
  GuardedChefPairings: "paid_subscription",
  GuardedPairingsHub: "paid_subscription",
  GuardedPairingsAI: "paid_subscription",
  GuardedWineListHelper: "paid_subscription",
  GuardedReduceDrinkingPlan: "paid_subscription",
  GuardedSocializingHub: "pro_plan",
  GuardedSocialFindMeals: "pro_plan",
  GuardedSocialRestaurantGuide: "pro_plan",
  GuardedFastFoodGuidePage: "pro_plan",
  GuardedRestaurantFinderPage: "pro_plan",
  GuardedMyPerfectBuffetPage: "pro_plan",
  GuardedPregnancy: "paid_subscription",
  GuardedMyPerfectBeginning: "paid_subscription",
  GuardedMyPerfectBeginningProfile: "paid_subscription",
  GuardedMyPerfectBeginningStub: "paid_subscription",
  GuardedGetaway: "paid_subscription",
  GuardedGatheringsPage: "paid_subscription",
  GuardedAntiInflammatoryBuilder: "paid_subscription",
  GuardedPetsHub: "pro_plan",
  GuardedCompanionHub: "pro_plan",
  GuardedDogProfileSetup: "pro_plan",
  GuardedCompanionMealGenerator: "pro_plan",
  GuardedDogIngredientScanner: "pro_plan",
  GuardedCatNutritionHub: "pro_plan",
  GuardedCatIngredientScanner: "pro_plan",
  GuardedCatProfileSetup: "pro_plan",
  COACHES_CORNER_ENABLED: "feature_flag",
};

// ── File system helpers ───────────────────────────────────────────────────────
function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "__tests__", "test", ".vite", "dist"].includes(entry.name)) continue;
        walk(full);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".tsx") &&
        !entry.name.endsWith(".test.tsx") &&
        !entry.name.endsWith(".spec.tsx")
      ) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

/**
 * Returns ALL source files (.ts + .tsx, excluding tests) for import-graph
 * building.  Including .ts files as intermediate graph nodes lets the BFS
 * traverse chains like:
 *   ActivePage.tsx  →  useHook.ts  →  SharedComponent.tsx
 * Without this, any component imported only via a .ts utility/hook would be
 * invisible to the reachability audit and mis-classified as UNKNOWN_REVIEW.
 */
function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "__tests__", "test", ".vite", "dist"].includes(entry.name)) continue;
        walk(full);
      } else if (entry.isFile()) {
        const n = entry.name;
        if (
          (n.endsWith(".tsx") || n.endsWith(".ts")) &&
          !n.endsWith(".test.tsx") && !n.endsWith(".spec.tsx") &&
          !n.endsWith(".test.ts")  && !n.endsWith(".spec.ts")
        ) {
          results.push(full);
        }
      }
    }
  }
  walk(dir);
  return results;
}

// Resolve a relative/aliased import to an absolute path
const ALIAS_PREFIX = "@/";
function resolveImport(fromFile: string, importPath: string): string | null {
  let resolved: string;
  if (importPath.startsWith(ALIAS_PREFIX)) {
    resolved = path.join(CLIENT_SRC, importPath.slice(ALIAS_PREFIX.length));
  } else if (importPath.startsWith(".")) {
    resolved = path.resolve(path.dirname(fromFile), importPath);
  } else {
    return null; // external package
  }

  // Try with .tsx, .ts, /index.tsx, /index.ts extensions
  for (const ext of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// ── Import graph builder ─────────────────────────────────────────────────────
function buildImportGraph(files: string[]): {
  forward: Map<string, Set<string>>;  // file → files it imports
  reverse: Map<string, Set<string>>;  // file → files that import it
} {
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  for (const file of files) {
    forward.set(file, new Set());
    reverse.set(file, new Set());
  }

  const importRegex = /(?:import\s+(?:[^'"]*\s+from\s+)?|from\s+|lazy\s*\(\s*\(\s*\)\s*=>\s*import\s*\()['"]([^'"]+)['"]/g;

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    importRegex.lastIndex = 0;
    while ((m = importRegex.exec(source)) !== null) {
      const importPath = m[1];
      const resolved = resolveImport(file, importPath);
      if (resolved && forward.has(resolved)) {
        forward.get(file)!.add(resolved);
        reverse.get(resolved)!.add(file);
      }
    }
  }

  return { forward, reverse };
}

// ── Route extraction from Router.tsx ─────────────────────────────────────────
type RouteEntry = {
  path: string;
  component: string;
  gate: string;
  isFeatureFlag: boolean;
};

function extractRoutes(routerSource: string): RouteEntry[] {
  const routes: RouteEntry[] = [];

  // Match <Route path="..." component={X} /> and <Route path="...">...</Route>
  // Also handle feature-flag conditional routes
  const routeRegex = /(?:(COACHES_CORNER_ENABLED)\s*&&\s*)?<Route\s+path="([^"]+)"(?:\s+component=\{([^}]+)\})?/g;
  let m: RegExpExecArray | null;

  while ((m = routeRegex.exec(routerSource)) !== null) {
    const featureFlag = m[1] || "";
    const routePath = m[2];
    const componentExpr = m[3] || "";

    // Extract the outermost component/guard name
    const topLevel = componentExpr.trim().split(/[\s(<]/)[0];

    const gate = GATE_MAP[topLevel] || (featureFlag ? "feature_flag" : "none");

    routes.push({
      path: routePath,
      component: componentExpr || "(inline)",
      gate,
      isFeatureFlag: !!featureFlag,
    });
  }

  return routes;
}

// ── BFS reachability ──────────────────────────────────────────────────────────
function bfsReachable(
  startFiles: string[],
  forward: Map<string, Set<string>>
): Set<string> {
  const visited = new Set<string>();
  const queue = [...startFiles];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    for (const dep of forward.get(file) || []) {
      if (!visited.has(dep)) queue.push(dep);
    }
  }
  return visited;
}

// ── Classification logic ──────────────────────────────────────────────────────
type Reachability = "ACTIVE" | "CONDITIONAL" | "HIDDEN_RESERVED" | "QUARANTINED" | "UNKNOWN_REVIEW" | "ORPHAN_DEAD";

// Patterns that indicate a file is explicitly decommissioned — ORPHAN_DEAD
const DEAD_CODE_PATTERNS = [
  /RETIRED_/i,
  /deprecated/i,
  /_old\./i,
  /_legacy\./i,
  /_backup\./i,
  /_unused\./i,
];

function hasExplicitDeadSignal(file: string, source?: string): boolean {
  const filename = path.basename(file);
  if (DEAD_CODE_PATTERNS.some(p => p.test(filename))) return true;
  if (source && /\/\*[\s\S]*?deprecated[\s\S]*?\*\//i.test(source.slice(0, 500))) return true;
  return false;
}

function classifyFile(
  file: string,
  reachableFromRouter: boolean,
  hasImporters: boolean,
  isInLegacy: boolean,
  isRetired: boolean,
  gateLevel: string
): { classification: Reachability; confidence: "high" | "medium" | "low"; reason: string } {
  if (isInLegacy || isRetired) {
    return {
      classification: "QUARANTINED",
      confidence: "high",
      reason: isRetired ? "RETIRED_ prefix — explicitly decommissioned" : "In client/src/legacy/ directory",
    };
  }

  if (!reachableFromRouter && !hasImporters) {
    // Split ORPHAN_DEAD into high-confidence dead vs UNKNOWN_REVIEW
    const explicitlyDead = hasExplicitDeadSignal(file);
    if (explicitlyDead) {
      return {
        classification: "ORPHAN_DEAD",
        confidence: "high",
        reason: "No route, no importers, AND explicit decommission signal (name/comment)",
      };
    }
    return {
      classification: "UNKNOWN_REVIEW",
      confidence: "medium",
      reason: "No route registration, no static imports found — but no explicit dead signal. May be dynamically loaded, config-referenced, or a future feature. Human review required before any cleanup action.",
    };
  }

  if (!reachableFromRouter && hasImporters) {
    return {
      classification: "HIDDEN_RESERVED",
      confidence: "medium",
      reason: "Has importers but no active route — likely modal child, sheet, or future feature",
    };
  }

  // Reachable from router
  if (gateLevel === "none" || gateLevel === "") {
    return {
      classification: "ACTIVE",
      confidence: "high",
      reason: "Reachable from an ungated route",
    };
  }

  return {
    classification: "CONDITIONAL",
    confidence: "high",
    reason: `Gated behind: ${gateLevel}`,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  REACHABILITY AUDIT — Step 1B: Dead-Code & Surface Classification");
  console.log("  Read-only scan. Zero production files modified.");
  console.log("═══════════════════════════════════════════════════════════\n");

  // allFiles — the .tsx files we report on and classify
  const allFiles = getAllTsxFiles(CLIENT_SRC);
  // graphFiles — .ts + .tsx files used as nodes in the import graph so that
  // chains like  ActivePage.tsx → hook.ts → SharedComponent.tsx  are captured
  const graphFiles = getAllSourceFiles(CLIENT_SRC);
  console.log(`  Scanning ${allFiles.length} .tsx files (${graphFiles.length} total source files for transitive-import graph)...`);

  // Build import graph over ALL source files (.ts + .tsx) so .ts intermediate
  // nodes don't break transitive reachability chains.
  const { forward, reverse } = buildImportGraph(graphFiles);

  // Identify entry point files
  const entryFiles = [
    path.join(CLIENT_SRC, "App.tsx"),
    path.join(CLIENT_SRC, "app-entry.tsx"),
    path.join(CLIENT_SRC, "main.tsx"),
    path.join(CLIENT_SRC, "components/Router.tsx"),
    path.join(CLIENT_SRC, "components/AppRouter.tsx"),
  ].filter(fs.existsSync);

  // Determine which files are reachable from router via transitive BFS.
  // Because graphFiles includes .ts nodes, the BFS now follows the full
  // import chain through TypeScript utilities and hooks.
  const reachableFromRouter = bfsReachable(entryFiles, forward);

  // ── Library convention: all shared component directories ──────────────────
  // All files under client/src/components/ are shared feature components or
  // design-system primitives.  The static import graph cannot enumerate every
  // consumer when components are referenced via dynamic import patterns,
  // component-registry lookup, or composition patterns (e.g. render-prop
  // factories, slot-based layouts).  Marking the entire components/ tree as
  // reachable ensures GATE_08 covers them all and prevents regressions in any
  // shared component from slipping past the ratchet.
  //
  // Sub-tree rationale:
  //   components/ui/            — shadcn/ui design-system primitives
  //   components/biometrics/    — biometrics feature shared components
  //   components/pro/           — ProCare shared components
  //   components/ace/           — ACE shared components
  //   components/glp1/          — GLP-1 shared components
  //   components/mealCreatorSteps/ — meal-builder step components
  //   components/shopping/      — shopping list components
  //   components/ (top-level)   — 150+ shared components used across active surfaces
  const SHARED_COMPONENTS_PREFIX = path.join(CLIENT_SRC, "components") + path.sep;
  for (const file of allFiles) {
    if (file.startsWith(SHARED_COMPONENTS_PREFIX)) {
      reachableFromRouter.add(file);
    }
  }

  // Extract route info from Router.tsx for gate classification
  const routerPath = path.join(CLIENT_SRC, "components/Router.tsx");
  const routerSource = fs.existsSync(routerPath) ? fs.readFileSync(routerPath, "utf8") : "";
  const routes = extractRoutes(routerSource);
  console.log(`  Extracted ${routes.length} route entries from Router.tsx`);

  // Map component expressions mentioned in Router.tsx to gate levels
  // We need to know for each file: what gate covers it?
  // Approach: for each import in Router.tsx, find which guard wraps it
  // We'll use a simpler heuristic: check what the Router source says about each imported component

  // Build a map: componentName → gate from routes
  const componentGateMap = new Map<string, string>();
  for (const route of routes) {
    const topLevel = route.component.trim().split(/[\s(<]/)[0];
    if (topLevel && topLevel !== "(inline)") {
      // If not already set, or if upgrading to less restrictive gate
      if (!componentGateMap.has(topLevel) || route.gate === "none") {
        componentGateMap.set(topLevel, route.gate);
      }
    }
  }

  // For Router.tsx imports: map import name → file path
  const importNameToFile = new Map<string, string>();
  const importLineRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let im: RegExpExecArray | null;
  while ((im = importLineRegex.exec(routerSource)) !== null) {
    const importName = im[1];
    const importPath = im[2];
    const resolved = resolveImport(routerPath, importPath);
    if (resolved) {
      importNameToFile.set(importName, resolved);
    }
  }
  // Also handle lazy imports
  const lazyRegex = /lazy\s*\(\s*\(\)\s*=>\s*import\s*\(['"]([^'"]+)['"]\)\s*\)/g;
  while ((im = lazyRegex.exec(routerSource)) !== null) {
    const importPath = im[1];
    const resolved = resolveImport(routerPath, importPath);
    if (resolved) {
      // The lazy component name is hard to extract reliably, skip name binding
      // but mark as reachable
      reachableFromRouter.add(resolved);
    }
  }

  // Now determine gate level for each directly-imported file in Router
  // by mapping through the Guarded* wrappers
  const fileGateMap = new Map<string, string>();

  // For every component name in componentGateMap, find its file
  for (const [compName, gate] of componentGateMap.entries()) {
    const file = importNameToFile.get(compName);
    if (file) {
      // If already mapped with a less restrictive gate, keep the less restrictive one
      const existing = fileGateMap.get(file);
      if (!existing || existing !== "none") {
        fileGateMap.set(file, gate);
      }
    }
  }

  // Classify each file
  type FileResult = {
    file: string;
    relPath: string;
    classification: Reachability;
    confidence: "high" | "medium" | "low";
    reason: string;
    gate: string;
    importerCount: number;
    importedCount: number;
  };

  const results: FileResult[] = [];

  for (const file of allFiles) {
    const relPath = path.relative(process.cwd(), file);
    const fileName = path.basename(file);
    const isInLegacy = file.includes("/legacy/");
    const isRetired = fileName.startsWith("RETIRED_");
    const isReachable = reachableFromRouter.has(file);
    const importers = reverse.get(file) || new Set();
    const hasImporters = importers.size > 0;
    const gate = fileGateMap.get(file) || (isReachable ? "none" : "");

    const { classification, confidence, reason } = classifyFile(
      file,
      isReachable,
      hasImporters,
      isInLegacy,
      isRetired,
      gate
    );

    results.push({
      file,
      relPath,
      classification,
      confidence,
      reason,
      gate,
      importerCount: importers.size,
      importedCount: (forward.get(file) || new Set()).size,
    });
  }

  // Tally
  const byClass: Record<Reachability, FileResult[]> = {
    ACTIVE: [],
    CONDITIONAL: [],
    HIDDEN_RESERVED: [],
    QUARANTINED: [],
    UNKNOWN_REVIEW: [],
    ORPHAN_DEAD: [],
  };
  for (const r of results) {
    byClass[r.classification].push(r);
  }

  const localizationTargets = byClass.ACTIVE.length + byClass.CONDITIONAL.length + byClass.HIDDEN_RESERVED.length;
  const excluded = byClass.QUARANTINED.length + byClass.ORPHAN_DEAD.length;
  const needsReview = byClass.UNKNOWN_REVIEW.length;

  console.log("\n── Results ─────────────────────────────────────────────────");
  console.log(`\n  Total files: ${allFiles.length}`);
  console.log(`  ACTIVE:           ${byClass.ACTIVE.length.toString().padStart(4)} (ungated routes + their children)`);
  console.log(`  CONDITIONAL:      ${byClass.CONDITIONAL.length.toString().padStart(4)} (subscription/role/admin/feature-flag gated)`);
  console.log(`  HIDDEN_RESERVED:  ${byClass.HIDDEN_RESERVED.length.toString().padStart(4)} (has importers but no active route)`);
  console.log(`  QUARANTINED:      ${byClass.QUARANTINED.length.toString().padStart(4)} (legacy/ directory or RETIRED_ prefix)`);
  console.log(`  UNKNOWN_REVIEW:   ${byClass.UNKNOWN_REVIEW.length.toString().padStart(4)} (no route + no importers, no dead signal — human review required)`);
  console.log(`  ORPHAN_DEAD:      ${byClass.ORPHAN_DEAD.length.toString().padStart(4)} (no route + no importers + explicit dead signal)`);
  console.log(`\n  Localization target: ${localizationTargets}`);
  console.log(`  Excluded from migration: ${excluded}`);
  console.log(`  Pending human review (UNKNOWN_REVIEW): ${needsReview}`);

  console.log("\n  TOP ORPHAN_DEAD FILES (high-confidence dead — candidate for deletion, not translation):");
  for (const r of byClass.ORPHAN_DEAD.slice(0, 25)) {
    console.log(`    ${r.relPath}`);
  }

  console.log("\n  QUARANTINED / LEGACY FILES:");
  for (const r of byClass.QUARANTINED) {
    console.log(`    ${r.relPath}`);
  }

  // ── Cross-reference with Step 1A ──────────────────────────────────────────
  let combined: Record<string, unknown> = {};

  if (fs.existsSync(REPORT_1A)) {
    console.log("\n── Cross-referencing with Step 1A localization findings... ──");
    const report1A = JSON.parse(fs.readFileSync(REPORT_1A, "utf8"));
    const findings1A: Array<{ relPath: string; classification: string }> = report1A.findings || [];

    // Build: relPath → reachability classification
    const reachByRelPath = new Map<string, Reachability>();
    for (const r of results) {
      reachByRelPath.set(r.relPath, r.classification);
    }

    // Count hardcoded strings by reachability class
    const stringsByReach: Record<string, { total: number; safe: number; review: number; clinical: number }> = {
      ACTIVE: { total: 0, safe: 0, review: 0, clinical: 0 },
      CONDITIONAL: { total: 0, safe: 0, review: 0, clinical: 0 },
      HIDDEN_RESERVED: { total: 0, safe: 0, review: 0, clinical: 0 },
      QUARANTINED: { total: 0, safe: 0, review: 0, clinical: 0 },
      ORPHAN_DEAD: { total: 0, safe: 0, review: 0, clinical: 0 },
      UNKNOWN: { total: 0, safe: 0, review: 0, clinical: 0 },
    };

    for (const finding of findings1A) {
      const reach = reachByRelPath.get(finding.relPath) || "UNKNOWN";
      const bucket = stringsByReach[reach] || stringsByReach.UNKNOWN;
      bucket.total++;
      if (finding.classification === "SAFE_AUTOMATION") bucket.safe++;
      else if (finding.classification === "REVIEW_REQUIRED") bucket.review++;
      else if (finding.classification === "CLINICAL_SAFETY") bucket.clinical++;
    }

    console.log("\n  HARDCODED STRINGS BY REACHABILITY CLASS:");
    console.log("  (These are the strings that actually matter for localization)");
    console.log("");
    for (const [reach, counts] of Object.entries(stringsByReach)) {
      if (counts.total === 0) continue;
      console.log(`  ${reach.padEnd(18)}: ${counts.total.toString().padStart(5)} total  |  ${counts.safe} safe  |  ${counts.review} review  |  ${counts.clinical} clinical`);
    }

    const activeAndCond = (stringsByReach.ACTIVE?.total || 0) + (stringsByReach.CONDITIONAL?.total || 0);
    const deadStrings = (stringsByReach.ORPHAN_DEAD?.total || 0) + (stringsByReach.QUARANTINED?.total || 0);
    console.log(`\n  Real migration workload (ACTIVE + CONDITIONAL): ${activeAndCond} strings`);
    console.log(`  Strings in dead/legacy code (exclude from migration): ${deadStrings}`);
    console.log(`  Strings in hidden/reserved surfaces: ${stringsByReach.HIDDEN_RESERVED?.total || 0}`);

    combined = {
      step1A_summary: report1A.summary,
      step1B_summary: {
        totalFiles: allFiles.length,
        active: byClass.ACTIVE.length,
        conditional: byClass.CONDITIONAL.length,
        hiddenReserved: byClass.HIDDEN_RESERVED.length,
        quarantined: byClass.QUARANTINED.length,
        orphanDead: byClass.ORPHAN_DEAD.length,
        localizationTarget: localizationTargets,
        excludedFromMigration: excluded,
      },
      stringsByReachabilityClass: stringsByReach,
      localizationTarget: {
        total: activeAndCond,
        excludedDead: deadStrings,
        hiddenReserved: stringsByReach.HIDDEN_RESERVED?.total || 0,
      },
    };
  }

  // Write machine reports
  const reachReport = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalFiles: allFiles.length,
      active: byClass.ACTIVE.length,
      conditional: byClass.CONDITIONAL.length,
      hiddenReserved: byClass.HIDDEN_RESERVED.length,
      quarantined: byClass.QUARANTINED.length,
      orphanDead: byClass.ORPHAN_DEAD.length,
      localizationTarget: localizationTargets,
      excludedFromMigration: excluded,
    },
    files: results,
    orphanDeadFiles: byClass.ORPHAN_DEAD.map((r) => ({ relPath: r.relPath, reason: r.reason, confidence: r.confidence })),
    quarantinedFiles: byClass.QUARANTINED.map((r) => ({ relPath: r.relPath, reason: r.reason })),
  };

  fs.writeFileSync(REPORT_REACH, JSON.stringify(reachReport, null, 2));
  fs.writeFileSync(REPORT_COMBINED, JSON.stringify({ ...combined, reachabilityDetail: reachReport }, null, 2));

  console.log(`\n  Machine reports written to:`);
  console.log(`    ${REPORT_REACH}`);
  console.log(`    ${REPORT_COMBINED}`);
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  AUDIT COMPLETE — no production files were modified.");
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
