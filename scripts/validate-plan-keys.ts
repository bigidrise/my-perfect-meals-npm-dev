/**
 * validate-plan-keys.ts
 *
 * Checks that every key in PAID_PLAN_KEYS (derived from LOOKUP_KEY_TO_TIER in
 * shared/planFeatures.ts) is recognised as paid on both the server and UI layers.
 *
 * Run with:  npx tsx scripts/validate-plan-keys.ts
 *
 * Exit 0 = everything is in sync.
 * Exit 1 = drift detected — details printed to stdout.
 *
 * The script is intentionally standalone so it can be wired into CI without
 * starting the full application server.
 */

import { LOOKUP_KEY_TO_TIER, PAID_PLAN_KEYS } from "../shared/planFeatures";

let ok = true;

// 1. Every key in PAID_PLAN_KEYS must exist in LOOKUP_KEY_TO_TIER with a non-free tier.
//    (This is guaranteed by construction since PAID_PLAN_KEYS is derived from
//    LOOKUP_KEY_TO_TIER, but we verify the invariant explicitly so a future
//    refactor can't silently break it.)
for (const key of PAID_PLAN_KEYS) {
  const tier = LOOKUP_KEY_TO_TIER[key];
  if (!tier || tier === "free") {
    console.error(
      `[FAIL] PAID_PLAN_KEYS contains "${key}" but LOOKUP_KEY_TO_TIER maps it to "${tier ?? "undefined"}" (expected a paid tier).`,
    );
    ok = false;
  }
}

// 2. Every non-free key in LOOKUP_KEY_TO_TIER must appear in PAID_PLAN_KEYS.
for (const [key, tier] of Object.entries(LOOKUP_KEY_TO_TIER)) {
  if (tier !== "free" && !PAID_PLAN_KEYS.has(key)) {
    console.error(
      `[FAIL] LOOKUP_KEY_TO_TIER has paid key "${key}" (tier: ${tier}) that is missing from PAID_PLAN_KEYS.`,
    );
    ok = false;
  }
}

if (ok) {
  const count = PAID_PLAN_KEYS.size;
  console.log(`[OK] All ${count} paid plan keys are in sync between LOOKUP_KEY_TO_TIER and PAID_PLAN_KEYS.`);
  process.exit(0);
} else {
  console.error(
    "\nFix: add the missing key(s) to LOOKUP_KEY_TO_TIER in shared/planFeatures.ts with the correct PlanTier.\n" +
    "PAID_PLAN_KEYS is derived automatically — you never need to edit both files separately.",
  );
  process.exit(1);
}
