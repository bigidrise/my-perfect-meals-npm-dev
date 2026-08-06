/**
 * Pediatric Resolver Inspector
 *
 * Read-only diagnostic pass: renders the full resolver output for three
 * canonical profiles WITHOUT making any AI calls. This is the gating step
 * before connecting Create a Dish to the pediatric adapter.
 *
 * Usage:
 *   npx tsx scripts/pediatric-resolver-inspector.ts
 */

import { resolvePediatricContext, type PediatricContext } from "../server/services/pediatric/pediatricResolver";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const PROFILES = [
  {
    label: "Profile 1 — Healthy Preschooler (school lunch, no allergies, no conditions)",
    profile: {
      ageStage: "preschool",
      allergies: [] as Array<{ allergenId: string; severity?: string }>,
      medicalConditions: [] as string[],
      behavioralFlags: [] as string[],
    },
    request: {
      foodRequest: "a healthy lunch",
      mealContext: "school_lunch",
      requiresSchoolSafe: true,
      requiresPackable: true,
      servings: 1,
    },
    checks: {
      expectHardStop: false,
      expectStage: "preschool",
      expectRulesContain: ["MPB-S005", "MPB-CTX001"],
      expectProtocolsContain: ["school-safe-protocol", "packable-lunch", "preschool-portions"],
      expectExclusionsContain: [] as string[],
      expectLanguageFlagsEmpty: false,
      // languageFlags should be clean (no condition-specific red flags)
      expectLanguageFlagsNotContain: ["insulin", "GLP-1", "force to eat"],
      expectMealType: "lunch",
    },
  },
  {
    label: "Profile 2 — Celiac + Sesame Allergy + Iron Deficiency + Sensory Texture Restriction (Toddler)",
    profile: {
      ageStage: "toddler",
      allergies: [
        { allergenId: "wheat", severity: "confirmed_allergy" },
        { allergenId: "sesame", severity: "confirmed_allergy" },
      ],
      medicalConditions: ["celiac_disease", "iron_deficiency"],
      behavioralFlags: ["sensory_texture_restriction"],
    },
    request: {
      foodRequest: "a dinner meal",
      mealContext: undefined,
      servings: 1,
    },
    checks: {
      expectHardStop: false,
      expectStage: "toddler",
      expectRulesContain: ["MPB-MED014", "MPB-MED005", "MPB-BEH005"],
      expectProtocolsContain: [
        "celiac-strict-gluten-free",
        "iron-rich-foods-priority",
        "vitamin-c-iron-pairing",
      ],
      expectExclusionsContain: ["wheat", "sesame", "gluten"],
      expectLanguageFlagsNotContain: [] as string[],
      expectMealType: "dinner",
    },
  },
  {
    label: "Profile 3 — PKU Hard Stop",
    profile: {
      ageStage: "preschool",
      allergies: [] as Array<{ allergenId: string; severity?: string }>,
      medicalConditions: ["pku"],
      behavioralFlags: [] as string[],
    },
    request: {
      foodRequest: "any meal",
      servings: 1,
    },
    checks: {
      expectHardStop: true,
      expectHardStopReason: "pku",
      expectProtocolsEmpty: true,
      expectExclusionsEmpty: true,
    },
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// PRINT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function hr(ch = "─", width = 70) {
  return ch.repeat(width);
}

function printContext(label: string, ctx: PediatricContext) {
  console.log(`\n${hr("═")}`);
  console.log(`  ${label}`);
  console.log(hr("═"));
  console.log(`  stage          : ${ctx.stage}`);
  console.log(`  hardStop       : ${ctx.hardStop}`);
  if (ctx.hardStopReason) {
    console.log(`  hardStopReason : ${ctx.hardStopReason}`);
  }
  console.log(`  mealType       : ${ctx.mealType ?? "(none)"}`);
  console.log(`\n  rulesFired (${ctx.rulesFired.length}):`);
  if (ctx.rulesFired.length === 0) {
    console.log("    (none)");
  } else {
    for (const r of ctx.rulesFired) {
      console.log(`    [${r.level}] ${r.ruleId}  —  ${r.description}`);
      console.log(`           action: ${r.action}`);
    }
  }
  console.log(`\n  protocols (${ctx.protocols.length}):`);
  if (ctx.protocols.length === 0) {
    console.log("    (none)");
  } else {
    for (const p of ctx.protocols) {
      console.log(`    • ${p}`);
    }
  }
  console.log(`\n  exclusions (${ctx.exclusions.length}):`);
  if (ctx.exclusions.length === 0) {
    console.log("    (none)");
  } else {
    for (const e of ctx.exclusions) {
      console.log(`    • ${e}`);
    }
  }
  console.log(`\n  languageFlags (${ctx.languageFlags.length}):`);
  if (ctx.languageFlags.length === 0) {
    console.log("    (none)");
  } else {
    for (const f of ctx.languageFlags) {
      console.log(`    • ${f}`);
    }
  }
  console.log(`\n  conditionGuidanceBlocks (${ctx.conditionGuidanceBlocks.length}):`);
  if (ctx.conditionGuidanceBlocks.length === 0) {
    console.log("    (none)");
  } else {
    for (const b of ctx.conditionGuidanceBlocks) {
      console.log(`    • ${b}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

interface CheckResult {
  label: string;
  passed: boolean;
  failures: string[];
}

function verifyProfile(
  label: string,
  ctx: PediatricContext,
  checks: (typeof PROFILES)[number]["checks"],
): CheckResult {
  const failures: string[] = [];
  const c = checks as Record<string, unknown>;

  // Hard-stop
  if ("expectHardStop" in checks) {
    if (ctx.hardStop !== checks.expectHardStop) {
      failures.push(
        `hardStop: expected ${checks.expectHardStop}, got ${ctx.hardStop}`,
      );
    }
  }

  // Hard-stop reason
  if ("expectHardStopReason" in checks && checks.expectHardStopReason) {
    if (ctx.hardStopReason !== checks.expectHardStopReason) {
      failures.push(
        `hardStopReason: expected "${checks.expectHardStopReason}", got "${ctx.hardStopReason ?? "(none)"}"`,
      );
    }
  }

  // Stage
  if ("expectStage" in checks && checks.expectStage) {
    if (ctx.stage !== checks.expectStage) {
      failures.push(`stage: expected "${checks.expectStage}", got "${ctx.stage}"`);
    }
  }

  // Protocols must be empty
  if ("expectProtocolsEmpty" in checks && checks.expectProtocolsEmpty) {
    if (ctx.protocols.length > 0) {
      failures.push(
        `Hard-stop must have empty protocols, got: [${ctx.protocols.join(", ")}]`,
      );
    }
  }

  // Exclusions must be empty
  if ("expectExclusionsEmpty" in checks && checks.expectExclusionsEmpty) {
    if (ctx.exclusions.length > 0) {
      failures.push(
        `Hard-stop must have empty exclusions, got: [${ctx.exclusions.join(", ")}]`,
      );
    }
  }

  // Rules fired must contain
  if ("expectRulesContain" in checks && Array.isArray(c["expectRulesContain"])) {
    const firedIds = new Set(ctx.rulesFired.map(r => r.ruleId));
    for (const ruleId of c["expectRulesContain"] as string[]) {
      if (!firedIds.has(ruleId)) {
        failures.push(`Expected rule "${ruleId}" to fire — not found in rulesFired`);
      }
    }
  }

  // Protocols must contain
  if ("expectProtocolsContain" in checks && Array.isArray(c["expectProtocolsContain"])) {
    const activeSet = new Set(ctx.protocols);
    for (const proto of c["expectProtocolsContain"] as string[]) {
      if (!activeSet.has(proto)) {
        failures.push(`Expected protocol "${proto}" — not found in protocols`);
      }
    }
  }

  // Exclusions must contain (substring match)
  if ("expectExclusionsContain" in checks && Array.isArray(c["expectExclusionsContain"])) {
    const excLower = ctx.exclusions.map(e => e.toLowerCase());
    for (const term of c["expectExclusionsContain"] as string[]) {
      if (!excLower.some(e => e.includes(term.toLowerCase()))) {
        failures.push(
          `Expected exclusion containing "${term}" — not found in [${ctx.exclusions.join(", ")}]`,
        );
      }
    }
  }

  // Language flags must NOT contain
  if (
    "expectLanguageFlagsNotContain" in checks &&
    Array.isArray(c["expectLanguageFlagsNotContain"])
  ) {
    for (const flag of c["expectLanguageFlagsNotContain"] as string[]) {
      if (ctx.languageFlags.includes(flag)) {
        failures.push(
          `Language flag "${flag}" should NOT appear for this profile but was present`,
        );
      }
    }
  }

  // Meal type
  if ("expectMealType" in checks && checks.expectMealType) {
    if (ctx.mealType !== checks.expectMealType) {
      failures.push(
        `mealType: expected "${checks.expectMealType}", got "${ctx.mealType ?? "(none)"}"`,
      );
    }
  }

  return { label, passed: failures.length === 0, failures };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔬  Pediatric Resolver Inspector");
  console.log("    Read-only — no AI calls fired\n");

  const checkResults: CheckResult[] = [];

  for (const entry of PROFILES) {
    let ctx: PediatricContext;
    try {
      ctx = await resolvePediatricContext(
        entry.profile as Parameters<typeof resolvePediatricContext>[0],
        entry.request as Parameters<typeof resolvePediatricContext>[1],
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n❌  RESOLVER ERROR for "${entry.label}":\n    ${msg}\n`);
      checkResults.push({ label: entry.label, passed: false, failures: [`Resolver threw: ${msg}`] });
      continue;
    }

    printContext(entry.label, ctx);

    const result = verifyProfile(entry.label, ctx, entry.checks as Parameters<typeof verifyProfile>[2]);
    checkResults.push(result);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${hr("═")}`);
  console.log("  INSPECTOR SUMMARY");
  console.log(hr("═"));

  let allPassed = true;
  for (const r of checkResults) {
    const mark = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`\n  ${mark}  ${r.label}`);
    for (const f of r.failures) {
      console.log(`         · ${f}`);
    }
    if (!r.passed) allPassed = false;
  }

  console.log("");
  if (allPassed) {
    console.log("🟢  All 3 profiles passed — engine output verified, safe to proceed to Create a Dish connection.\n");
  } else {
    console.log("🔴  One or more profiles failed — fix mismatches before connecting AI generation.\n");
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error("Fatal inspector error:", err);
  process.exit(1);
});
