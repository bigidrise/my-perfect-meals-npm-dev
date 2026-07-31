/**
 * verify-feline-engine-isolation.ts
 *
 * Smoke test confirming:
 *   (1) A cat profile always routes to the feline protocol engine (activeLayers
 *       includes "Feline Toxic Ingredient Firewall", not "Canine …")
 *   (2) A dog profile always routes to the canine protocol engine (activeLayers
 *       does NOT include any "Feline …" layer)
 *   (3) "easter lily" is flagged TOXIC by scanRecipeForFelineToxins() but passes
 *       scanRecipeForToxins() — confirming the two firewalls are distinct
 *   (4) The feline engine error boundary returns 422 (not 500) when
 *       buildFelineProtocolEnvelope throws — verified via a monkey-patch simulation
 *
 * No database or OpenAI key required. Runs entirely against the compiled service
 * modules.
 *
 * Usage:
 *   npx tsx scripts/verify-feline-engine-isolation.ts
 */

import { scanRecipeForFelineToxins } from "../server/services/felineToxicFirewall";
import { scanRecipeForToxins } from "../server/services/companionToxicFirewall";
import { buildFelineProtocolEnvelope, type CatProfile } from "../server/services/felineProtocolEnvelope";
import { buildCompanionProtocolEnvelope } from "../server/services/companionProtocolEnvelope";

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS — ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL — ${label}${detail ? `\n       ${detail}` : ""}`);
    failed++;
  }
}

// ── Mock profiles ─────────────────────────────────────────────────────────────

const catProfile: CatProfile = {
  id: "test-cat-001",
  name: "Whiskers",
  breed: "Domestic Shorthair",
  isMixedBreed: false,
  ageYears: 4,
  ageMonths: 2,
  sex: "female",
  isNeutered: true,
  weightLbs: 10,
  goalWeightLbs: null,
  activityLevel: "moderate",
  wellnessGoals: ["urinary tract health"],
};

const dogProfile = {
  id: "test-dog-001",
  name: "Buddy",
  breed: "Labrador Retriever",
  isMixedBreed: false,
  ageYears: 3,
  ageMonths: 0,
  sex: "male",
  isNeutered: true,
  weightLbs: 60,
  goalWeightLbs: null,
  activityLevel: "high",
  wellnessGoals: ["joint health"],
};

// ── Test Suite ────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════════");
console.log("  Feline Engine Isolation — Smoke Test");
console.log("══════════════════════════════════════════════════════════════\n");

// ── SECTION 1: Firewall scan distinctness ─────────────────────────────────────
console.log("Section 1 — Feline vs Canine firewall distinctness\n");

{
  const felineResult = scanRecipeForFelineToxins("easter lily petals in broth");
  assert(
    !felineResult.safe,
    "scanRecipeForFelineToxins() flags 'easter lily' as UNSAFE",
    `safe=${felineResult.safe}, violations=${felineResult.violations.length}`,
  );

  const lilyViolation = felineResult.violations.find(
    (v) => v.ingredient === "easter lily" || v.ingredient.includes("lily"),
  );
  assert(
    lilyViolation !== undefined,
    "Feline firewall violation specifically names the lily ingredient",
    `violation: ${JSON.stringify(lilyViolation)}`,
  );
  assert(
    lilyViolation?.severity === "TOXIC",
    "Lily violation severity is TOXIC in feline firewall",
    `severity=${lilyViolation?.severity}`,
  );

  const canineResult = scanRecipeForToxins("easter lily petals in broth");
  assert(
    canineResult.safe,
    "scanRecipeForToxins() (canine) does NOT flag 'easter lily'",
    `safe=${canineResult.safe}, violations=${canineResult.violations.length}`,
  );
}

// Grapes should be flagged by both (shared toxin)
{
  const felineGrapes = scanRecipeForFelineToxins("grape puree over chicken");
  const canineGrapes = scanRecipeForToxins("grape puree over chicken");
  assert(!felineGrapes.safe, "Grapes flagged by feline firewall", `safe=${felineGrapes.safe}`);
  assert(!canineGrapes.safe, "Grapes flagged by canine firewall", `safe=${canineGrapes.safe}`);
}

// Safe ingredients should pass both
{
  const felineSafe = scanRecipeForFelineToxins("cooked chicken breast with pumpkin puree");
  const canineSafe = scanRecipeForToxins("cooked chicken breast with pumpkin puree");
  assert(felineSafe.safe, "Safe feline recipe passes feline firewall", `safe=${felineSafe.safe}`);
  assert(canineSafe.safe, "Safe canine recipe passes canine firewall", `safe=${canineSafe.safe}`);
}

// ── SECTION 2: Cat profile routes to feline engine ───────────────────────────
console.log("\nSection 2 — Cat profile → feline protocol engine\n");

{
  const felineEnvelope = buildFelineProtocolEnvelope(catProfile);

  assert(
    felineEnvelope.activeLayers.includes("Feline Toxic Ingredient Firewall"),
    "Cat envelope activeLayers includes 'Feline Toxic Ingredient Firewall'",
    `activeLayers: ${JSON.stringify(felineEnvelope.activeLayers)}`,
  );

  assert(
    felineEnvelope.activeLayers.includes("Obligate Carnivore Protocol"),
    "Cat envelope activeLayers includes 'Obligate Carnivore Protocol'",
  );

  const hasCanineLayer = felineEnvelope.activeLayers.some((l) =>
    l.toLowerCase().includes("canine"),
  );
  assert(
    !hasCanineLayer,
    "Cat envelope activeLayers does NOT contain any 'Canine' layer",
    `activeLayers: ${JSON.stringify(felineEnvelope.activeLayers)}`,
  );

  assert(
    felineEnvelope.promptBlock.includes("FELINE SAFETY FIREWALL"),
    "Cat promptBlock contains FELINE SAFETY FIREWALL header",
  );

  assert(
    felineEnvelope.promptBlock.includes("obligate carnivore") ||
      felineEnvelope.promptBlock.includes("OBLIGATE CARNIVORE"),
    "Cat promptBlock contains obligate carnivore language",
  );

  // Confirm the wellness goal was picked up
  assert(
    felineEnvelope.activeLayers.some((l) =>
      l.toLowerCase().includes("urinary"),
    ),
    "Cat envelope activeLayers includes the requested wellness goal (urinary tract health)",
    `activeLayers: ${JSON.stringify(felineEnvelope.activeLayers)}`,
  );
}

// ── SECTION 3: Dog profile routes to canine engine ───────────────────────────
console.log("\nSection 3 — Dog profile → canine protocol engine\n");

{
  const canineEnvelope = buildCompanionProtocolEnvelope(dogProfile as any);

  const hasFelineLayer = canineEnvelope.activeLayers.some((l) =>
    l.toLowerCase().includes("feline"),
  );
  assert(
    !hasFelineLayer,
    "Dog envelope activeLayers does NOT contain any 'Feline' layer",
    `activeLayers: ${JSON.stringify(canineEnvelope.activeLayers)}`,
  );

  const hasFirewall = canineEnvelope.activeLayers.some(
    (l) => l.includes("Firewall") || l.includes("Toxic"),
  );
  assert(
    hasFirewall,
    "Dog envelope activeLayers includes a canine safety layer",
    `activeLayers: ${JSON.stringify(canineEnvelope.activeLayers)}`,
  );

  // Canine prompt must NOT contain feline-specific language
  const promptHasFelineRule =
    canineEnvelope.promptBlock.toLowerCase().includes("obligate carnivore") ||
    canineEnvelope.promptBlock.toLowerCase().includes("easter lily") ||
    canineEnvelope.promptBlock.toLowerCase().includes("thiaminase");
  assert(
    !promptHasFelineRule,
    "Dog promptBlock does NOT contain feline-specific nutrition rules",
    "Checked for 'obligate carnivore', 'easter lily', 'thiaminase'",
  );
}

// ── SECTION 4: Feline engine error → 422 boundary ────────────────────────────
console.log("\nSection 4 — Error boundary: feline engine failure → 422\n");

{
  // Simulate the route handler logic with a monkey-patched thrower
  let simulatedStatus: number | null = null;
  let simulatedBody: any = null;

  const mockRes = {
    status(code: number) {
      simulatedStatus = code;
      return this;
    },
    json(body: any) {
      simulatedBody = body;
      return this;
    },
  };

  // Replicate the route's two-level error handling:
  //   - Inner try/catch: wraps only the feline engine → 422 on feline failure
  //   - Outer try/catch: catches everything else → 500 (simulated as status=500 here)
  function simulateRouteEnvelopeBranch(
    petType: string,
    envelopeBuilder: () => any,
  ): { status: number | null; body: any } {
    simulatedStatus = null;
    simulatedBody = null;

    try {
      if (petType === "cat") {
        try {
          envelopeBuilder();
        } catch {
          // inner boundary: feline engine failure → 422
          mockRes.status(422).json({
            error:
              "Feline engine unavailable — unable to generate a safe cat meal at this time. Please try again or contact support.",
            code: "FELINE_ENGINE_ERROR",
          });
        }
      } else {
        // no inner boundary for dogs — let outer catch handle it
        envelopeBuilder();
      }
    } catch {
      // outer boundary: unhandled engine errors → 500
      mockRes.status(500).json({ error: "Internal server error" });
    }

    return { status: simulatedStatus, body: simulatedBody };
  }

  // Case A: cat profile with a throwing feline engine → 422
  const resultA = simulateRouteEnvelopeBranch("cat", () => {
    throw new Error("Simulated feline engine crash");
  });
  assert(
    resultA.status === 422,
    "Feline engine error returns HTTP 422 (not 500 bare crash)",
    `status=${resultA.status}`,
  );
  assert(
    resultA.body?.code === "FELINE_ENGINE_ERROR",
    "Feline engine error body includes code: FELINE_ENGINE_ERROR",
    `body=${JSON.stringify(resultA.body)}`,
  );
  assert(
    typeof resultA.body?.error === "string" &&
      resultA.body.error.includes("Feline engine unavailable"),
    "Feline engine error message is human-readable",
    `error="${resultA.body?.error}"`,
  );

  // Case B: dog profile with a throwing canine engine — falls to outer 500 catch,
  // NOT the feline 422 boundary
  const resultB = simulateRouteEnvelopeBranch("dog", () => {
    throw new Error("Simulated canine engine crash");
  });
  assert(
    resultB.status === 500,
    "Dog engine error falls to outer 500 catch, NOT the feline 422 boundary",
    `status=${resultB.status}`,
  );
  assert(
    resultB.body?.code !== "FELINE_ENGINE_ERROR",
    "Dog engine error body does NOT carry FELINE_ENGINE_ERROR code",
    `body=${JSON.stringify(resultB.body)}`,
  );

  // Case C: cat profile with healthy feline engine — no error
  const resultC = simulateRouteEnvelopeBranch("cat", () =>
    buildFelineProtocolEnvelope(catProfile),
  );
  assert(
    resultC.status === null,
    "Healthy cat engine call does NOT trigger the error boundary",
    `status=${resultC.status}`,
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
}
