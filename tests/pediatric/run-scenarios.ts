/**
 * Pediatric Scenario Test Runner
 *
 * Executes all 110 pediatric scenarios against the resolver and verifies the
 * returned context object WITHOUT calling OpenAI. The resolver is tested as a
 * pure function that builds the context; generation is tested separately.
 *
 * Usage:
 *   npx tsx tests/pediatric/run-scenarios.ts
 *   npx tsx tests/pediatric/run-scenarios.ts --filter S076   # single scenario
 *   npx tsx tests/pediatric/run-scenarios.ts --category hard_stop
 *
 * Pass thresholds (required before clinical review):
 *   Hard-stop scenarios : 100%
 *   Soft scenarios       : 95%+
 */

import type {
  PediatricScenario,
  PediatricContext,
  ScenarioResult,
} from "./types";

import {
  ALL_SCENARIOS,
  HARD_STOP_SCENARIOS,
  SOFT_SCENARIOS,
} from "./scenarios/index";

// ── Resolver import ────────────────────────────────────────────────────────────
// The resolver is built by task #425 (Pediatric Protocol Registry).
// When that task has not yet merged, this import will fail with a clear message.
let resolvePediatricContext: (
  profile: import("./types").ChildProfile,
  request: import("./types").PediatricMealRequest,
) => PediatricContext | Promise<PediatricContext>;

async function loadResolver(): Promise<void> {
  try {
    const mod = await import("../../server/services/pediatric/pediatricResolver");
    resolvePediatricContext = mod.resolvePediatricContext;
    if (typeof resolvePediatricContext !== "function") {
      throw new Error(
        "resolvePediatricContext is not exported from pediatricResolver.ts — " +
        "check the export name matches this import.",
      );
    }
  } catch (err: any) {
    if (err?.code === "ERR_MODULE_NOT_FOUND" || err?.code === "MODULE_NOT_FOUND" || err instanceof SyntaxError) {
      console.error(
        "\n❌  RESOLVER NOT FOUND\n" +
        "    server/services/pediatric/pediatricResolver.ts does not exist yet.\n" +
        "    Wait for task #425 (Pediatric Protocol Registry) to merge,\n" +
        "    then re-run this test suite.\n",
      );
      process.exit(2);
    }
    throw err;
  }
}

// ── Scenario verifier ──────────────────────────────────────────────────────────

async function verifyScenario(scenario: PediatricScenario): Promise<ScenarioResult> {
  const failures: string[] = [];
  let context: PediatricContext | undefined;

  try {
    const rawContext = await resolvePediatricContext(
      scenario.childProfile,
      scenario.request,
    );
    context = rawContext;

    // 1. Hard-stop check
    if (scenario.expectHardStop) {
      if (!context.hardStop) {
        failures.push(
          `Expected hardStop=true but got hardStop=false`,
        );
      }
      if (scenario.expectHardStopReason && context.hardStopReason !== scenario.expectHardStopReason) {
        failures.push(
          `Expected hardStopReason="${scenario.expectHardStopReason}" ` +
          `but got "${context.hardStopReason ?? "(none)"}"`,
        );
      }
      // When a hard stop fires, the context must be minimal — no protocols/exclusions should fire
      if (context.hardStop && context.protocols.length > 0) {
        failures.push(
          `Hard-stop scenario must not populate protocols, got: ${context.protocols.join(", ")}`,
        );
      }
    } else {
      if (context.hardStop) {
        failures.push(
          `Expected hardStop=false but got hardStop=true ` +
          `(reason: ${context.hardStopReason ?? "(none)"})`,
        );
      }
    }

    // 2. Rules fired check
    const firedIds = new Set(context.rulesFired.map(r => r.ruleId));
    for (const expectedRuleId of scenario.expectedRulesFired) {
      if (!firedIds.has(expectedRuleId)) {
        failures.push(`Expected rule "${expectedRuleId}" to fire, but it did not`);
      }
    }

    // 3. Exclusions check
    const exclusionsLower = context.exclusions.map(e => e.toLowerCase());
    for (const expectedExclusion of scenario.expectedExclusions) {
      const found = exclusionsLower.some(
        e => e.includes(expectedExclusion.toLowerCase()),
      );
      if (!found) {
        failures.push(
          `Expected exclusion "${expectedExclusion}" not found in context.exclusions: ` +
          `[${context.exclusions.join(", ")}]`,
        );
      }
    }

    // 4. Protocols check
    const activeProtocols = new Set(context.protocols);
    for (const expectedProtocol of scenario.expectedProtocols) {
      if (!activeProtocols.has(expectedProtocol)) {
        failures.push(
          `Expected protocol "${expectedProtocol}" to be active, ` +
          `but active protocols are: [${context.protocols.join(", ")}]`,
        );
      }
    }

    // 5. Language flags check
    const flaggedLanguage = new Set(context.languageFlags);
    for (const mustFlag of scenario.mustFlagLanguage) {
      if (!flaggedLanguage.has(mustFlag)) {
        failures.push(
          `Expected language pattern "${mustFlag}" to be flagged in context.languageFlags, ` +
          `but it was not`,
        );
      }
    }

    // 6. Meal type check (optional — only when specified)
    if (scenario.expectedMealType && context.mealType) {
      if (context.mealType !== scenario.expectedMealType) {
        failures.push(
          `Expected mealType="${scenario.expectedMealType}" ` +
          `but got "${context.mealType}"`,
        );
      }
    }

  } catch (err: any) {
    return {
      scenario,
      passed: false,
      failures: [],
      error: String(err?.message ?? err),
    };
  }

  return {
    scenario,
    passed: failures.length === 0,
    failures,
    context,
  };
}

// ── CLI argument parsing ───────────────────────────────────────────────────────

function parseArgs(): { filter?: string; category?: string } {
  const args = process.argv.slice(2);
  const out: { filter?: string; category?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--filter" && args[i + 1]) out.filter = args[++i];
    if (args[i] === "--category" && args[i + 1]) out.category = args[++i];
  }
  return out;
}

// ── Reporter ───────────────────────────────────────────────────────────────────

function printResult(result: ScenarioResult): void {
  const { scenario, passed, failures, error } = result;
  const tag = passed ? "✅ PASS" : "❌ FAIL";
  const hardStopBadge = scenario.expectHardStop ? " [HARD-STOP]" : "";
  console.log(`  ${tag}  ${scenario.id}${hardStopBadge}  ${scenario.description}`);
  if (error) {
    console.log(`       ERROR: ${error}`);
  }
  for (const f of failures) {
    console.log(`       · ${f}`);
  }
}

function printSummary(
  results: ScenarioResult[],
  label: string,
  requiredRate: number,
): boolean {
  const passed   = results.filter(r => r.passed).length;
  const total    = results.length;
  const rate     = total === 0 ? 1 : passed / total;
  const pct      = (rate * 100).toFixed(1);
  const ok       = rate >= requiredRate;
  const mark     = ok ? "✅" : "❌";
  const required = (requiredRate * 100).toFixed(0);

  console.log(
    `\n${mark} ${label}: ${passed}/${total} passed (${pct}%) ` +
    `— required ≥${required}%`,
  );
  return ok;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await loadResolver();

  const { filter, category } = parseArgs();

  let scenarios = ALL_SCENARIOS;
  if (filter) {
    scenarios = scenarios.filter(s => s.id === filter);
    if (scenarios.length === 0) {
      console.error(`No scenario found with id "${filter}"`);
      process.exit(1);
    }
  }
  if (category) {
    scenarios = scenarios.filter(s => s.category === category);
    if (scenarios.length === 0) {
      console.error(`No scenarios found in category "${category}"`);
      process.exit(1);
    }
  }

  const hardStopInRun = scenarios.filter(s => s.expectHardStop);
  const softInRun     = scenarios.filter(s => !s.expectHardStop);

  console.log(
    `\n🧪  Pediatric Scenario Runner — ${scenarios.length} scenario(s)\n` +
    `    Hard-stop: ${hardStopInRun.length}   Soft: ${softInRun.length}\n`,
  );

  // Run all scenarios (parallelised in batches of 10 to avoid overwhelming the system)
  const results: ScenarioResult[] = [];
  const BATCH = 10;
  for (let i = 0; i < scenarios.length; i += BATCH) {
    const batch = scenarios.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(verifyScenario));
    results.push(...batchResults);
  }

  // Print per-scenario results
  const hardStopResults = results.filter(r => r.scenario.expectHardStop);
  const softResults     = results.filter(r => !r.scenario.expectHardStop);

  if (hardStopResults.length > 0) {
    console.log("─── Hard-Stop Scenarios ────────────────────────────────────");
    hardStopResults.forEach(printResult);
  }
  if (softResults.length > 0) {
    console.log("\n─── Soft Scenarios ─────────────────────────────────────────");
    softResults.forEach(printResult);
  }

  // Summary and pass/fail determination
  const hardOk = printSummary(hardStopResults, "Hard-stop scenarios", 1.0);
  const softOk = printSummary(softResults,     "Soft scenarios",      0.95);

  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log("\n─── Failed Scenarios Detail ────────────────────────────────");
    failures.forEach(r => {
      console.log(`\n  [${r.scenario.id}] ${r.scenario.description}`);
      if (r.error) console.log(`    Error: ${r.error}`);
      r.failures.forEach(f => console.log(`    · ${f}`));
    });
  }

  const allOk = hardOk && softOk;
  console.log(
    allOk
      ? "\n🟢  All thresholds met — engine is ready for clinical review.\n"
      : "\n🔴  Thresholds not met — DO NOT proceed to clinical review.\n",
  );

  process.exit(allOk ? 0 : 1);
}

main().catch(err => {
  console.error("Fatal runner error:", err);
  process.exit(1);
});
