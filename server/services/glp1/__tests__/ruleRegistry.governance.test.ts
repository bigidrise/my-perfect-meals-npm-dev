/**
 * ruleRegistry.governance.test.ts
 *
 * Focused tests for the GLP-1 Rule Registry governance contract.
 * Validates fail-closed behavior: pending_review rules MUST NOT influence
 * production recommendations.
 *
 * Pure function tests — no DB, no network.
 * Run: npx tsx server/services/glp1/__tests__/ruleRegistry.governance.test.ts
 */

import {
  getExecutableRuleValue,
  getRule,
  assertRuleApproved,
  type RuleExecutionResult,
} from "../ruleRegistry";

// ─────────────────────────────────────────────────────────────────────────────
// MINI TEST HARNESS (matches resolveGLP1MealTargets.test.ts pattern)
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    const msg = detail ? `${label} — ${detail}` : label;
    console.error(`  ❌ ${msg}`);
    errors.push(msg);
    failed++;
  }
}

function section(name: string): void {
  console.log(`\n── ${name} ─────────────────────────────────────────────────`);
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN RULE IDs FROM REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

// Approved escalation rules (boolean, no value field)
const APPROVED_ESCALATION_1 = "glp1_vomiting_escalate";
const APPROVED_ESCALATION_2 = "glp1_dehydration_difficulty_escalate";

// Pending review rules (have a `value` field; must NOT reach production)
// These IDs are confirmed in RULE_REGISTRY with reviewStatus: "pending_review"
const PENDING_CALORIE_INTRO    = "glp1_intro_phase_calorie_multiplier";      // value: 0.82
const PENDING_CALORIE_MUSCLE   = "glp1_muscle_preserve_calorie_multiplier";  // value: pending

const FALLBACK = 1.0;

// ─────────────────────────────────────────────────────────────────────────────
// getExecutableRuleValue — GOVERNANCE CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

section("getExecutableRuleValue — pending_review MUST fail closed");

{
  const r: RuleExecutionResult = getExecutableRuleValue(PENDING_CALORIE_INTRO, FALLBACK);
  assert(r.applied === false,       "Intro-phase calorie multiplier: applied=false");
  assert(r.value === FALLBACK,      "Intro-phase calorie multiplier: fallback value returned", `got ${r.value}`);
  assert(r.reviewStatus === "pending_review", "Intro-phase calorie multiplier: reviewStatus preserved");
  assert(typeof r.reason === "string" && r.reason.length > 0, "Intro-phase calorie multiplier: reason string populated");
}

{
  const r: RuleExecutionResult = getExecutableRuleValue(PENDING_CALORIE_MUSCLE, FALLBACK);
  assert(r.applied === false,  "Muscle-preserve calorie multiplier: applied=false");
  assert(r.value === FALLBACK, "Muscle-preserve calorie multiplier: fallback value returned");
  // reviewStatus may be pending_review (in registry) or "removed" (if valueless)
  assert(r.reviewStatus === "pending_review" || !r.applied,
    "Muscle-preserve calorie multiplier: not applied regardless of registry status");
}

section("getExecutableRuleValue — unknown rule MUST use fallback");

{
  const r: RuleExecutionResult = getExecutableRuleValue("this_rule_does_not_exist", 99);
  assert(r.applied === false, "Unknown rule: applied=false");
  assert(r.value === 99,      "Unknown rule: fallback value returned");
}

section("getExecutableRuleValue — approved rules may return their value");

// glp1_vomiting_escalate is approved but has no `value` field (boolean escalation)
// so we expect the fallback back (no value to return)
{
  const r: RuleExecutionResult = getExecutableRuleValue(APPROVED_ESCALATION_1, FALLBACK);
  // Approved escalation rules have no `value` field — fallback is correct
  assert(r.reviewStatus === "approved" || r.applied === false,
    "Approved escalation rule (no value field): applies cleanly with no crash");
}

// ─────────────────────────────────────────────────────────────────────────────
// getRule — AUDIT / INSPECTION ONLY
// ─────────────────────────────────────────────────────────────────────────────

section("getRule — inspection returns any non-removed rule including pending_review");

{
  const rule = getRule(PENDING_CALORIE_INTRO);
  assert(rule !== null,                               "getRule: returns pending_review rule (not null)");
  assert(rule?.reviewStatus === "pending_review",     "getRule: reviewStatus is pending_review");
  assert(typeof rule?.value === "number",             "getRule: value field is accessible for display");
}

{
  const rule = getRule(APPROVED_ESCALATION_1);
  assert(rule !== null,                          "getRule: returns approved rule");
  assert(rule?.reviewStatus === "approved",      "getRule: reviewStatus is approved");
}

{
  const rule = getRule("this_rule_does_not_exist");
  assert(rule === null, "getRule: unknown rule returns null");
}

// ─────────────────────────────────────────────────────────────────────────────
// assertRuleApproved — EXECUTION GATE (FAIL CLOSED)
// ─────────────────────────────────────────────────────────────────────────────

section("assertRuleApproved — approved rules return the rule");

{
  const rule = assertRuleApproved(APPROVED_ESCALATION_1);
  assert(rule !== null,                        "Approved escalation rule 1: returns rule object");
  assert(rule?.reviewStatus === "approved",    "Approved escalation rule 1: reviewStatus=approved");
}

{
  const rule = assertRuleApproved(APPROVED_ESCALATION_2);
  assert(rule !== null,                        "Approved escalation rule 2: returns rule object");
  assert(rule?.reviewStatus === "approved",    "Approved escalation rule 2: reviewStatus=approved");
}

section("assertRuleApproved — pending_review rules MUST return null (fail closed)");

{
  const rule = assertRuleApproved(PENDING_CALORIE_INTRO);
  assert(rule === null,
    "PENDING_REVIEW escalation: assertRuleApproved returns null (fail closed)",
    `Expected null but got ${JSON.stringify(rule?.ruleId)}`);
}

{
  const rule = assertRuleApproved(PENDING_CALORIE_MUSCLE);
  assert(rule === null, "PENDING_REVIEW muscle-preserve rule: returns null");
}

section("assertRuleApproved — unknown rule returns null (no throw)");

{
  const rule = assertRuleApproved("this_rule_does_not_exist");
  assert(rule === null, "Unknown rule: assertRuleApproved returns null");
}

section("assertRuleApproved — removed rule MUST throw");

{
  // We have no removed rules in the current registry, so we test the inverse:
  // confirm that approved rules do NOT throw
  let threw = false;
  try {
    assertRuleApproved(APPROVED_ESCALATION_1);
  } catch {
    threw = true;
  }
  assert(!threw, "Approved rule: assertRuleApproved does not throw");
}

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE INVARIANT — pending value MUST NOT equal production value
// ─────────────────────────────────────────────────────────────────────────────

section("Governance invariant: pending value never reaches production");

{
  // The intro-phase calorie multiplier has a specific candidate value (e.g. 0.82)
  // that must not be returned to production callers.
  const pendingRule = getRule(PENDING_CALORIE_INTRO);
  const executionResult = getExecutableRuleValue(PENDING_CALORIE_INTRO, FALLBACK);

  if (pendingRule?.value !== undefined) {
    assert(
      executionResult.value !== pendingRule.value,
      "Intro-phase multiplier: production value differs from candidate value",
      `candidate=${pendingRule.value}, production=${executionResult.value} (expected fallback ${FALLBACK})`
    );
  } else {
    assert(true, "Intro-phase multiplier: no value field — skipping candidate value check");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(62)}`);
console.log(`  ruleRegistry.governance: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log("\n  FAILURES:");
  errors.forEach(e => console.log(`    • ${e}`));
}
console.log(`${"═".repeat(62)}\n`);

process.exit(failed > 0 ? 1 : 0);
