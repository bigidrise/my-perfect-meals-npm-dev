/**
 * Pediatric Resolver Inspector
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs 4 canonical profiles through resolvePediatricContext and prints the
 * complete resolver output. Zero AI calls — pure deterministic engine output.
 *
 * Usage:
 *   npx tsx scripts/pediatric-resolver-inspector.ts
 */

import { resolvePediatricContext, type PediatricContext } from "../server/services/pediatric/pediatricResolver";

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
  red:   "\x1b[31m",
  green: "\x1b[32m",
  yellow:"\x1b[33m",
  cyan:  "\x1b[36m",
  white: "\x1b[37m",
  blue:  "\x1b[34m",
  magenta: "\x1b[35m",
};

function header(title: string) {
  const bar = "═".repeat(70);
  console.log(`\n${C.cyan}${C.bold}${bar}${C.reset}`);
  console.log(`${C.cyan}${C.bold}  ${title}${C.reset}`);
  console.log(`${C.cyan}${C.bold}${bar}${C.reset}`);
}

function section(label: string) {
  console.log(`\n${C.yellow}${C.bold}── ${label} ──────────────────────────────${C.reset}`);
}

function printContext(ctx: PediatricContext, profileLabel: string) {
  header(`PROFILE: ${profileLabel}`);

  // Hard stop — short-circuit display
  if (ctx.hardStop) {
    section("⛔  HARD STOP");
    console.log(`  ${C.red}${C.bold}hardStop: true${C.reset}`);
    console.log(`  reason:  ${C.red}${ctx.hardStopReason}${C.reset}`);
    console.log(`  stage:   ${ctx.stage}`);
    console.log(`\n  ${C.bold}Rules fired:${C.reset}`);
    for (const r of ctx.rulesFired) {
      const lvlColor = r.level === "A" ? C.red : r.level === "B" ? C.yellow : C.green;
      console.log(`    [${lvlColor}${r.level}${C.reset}] ${C.bold}${r.ruleId}${C.reset}  ${C.dim}${r.description}${C.reset}`);
      console.log(`         → ${r.action}`);
    }
    console.log(`\n  ${C.bold}protocols:${C.reset}          ${JSON.stringify(ctx.protocols)}`);
    console.log(`  ${C.bold}exclusions:${C.reset}         ${JSON.stringify(ctx.exclusions)}`);
    console.log(`  ${C.bold}languageFlags:${C.reset}      ${JSON.stringify(ctx.languageFlags)}`);
    console.log(`  ${C.bold}conditionGuidance:${C.reset}  ${JSON.stringify(ctx.conditionGuidanceBlocks)}`);
    console.log(`\n  ${C.green}✓ Zero AI calls made${C.reset}\n`);
    return;
  }

  // Stage + mealType
  section("Stage & Meal Type");
  console.log(`  stage:    ${C.bold}${ctx.stage}${C.reset}`);
  console.log(`  mealType: ${C.bold}${ctx.mealType ?? "any"}${C.reset}`);

  // Rules fired
  section(`Rules Fired (${ctx.rulesFired.length})`);
  for (const r of ctx.rulesFired) {
    const lvlColor = r.level === "A" ? C.red : r.level === "B" ? C.yellow : C.green;
    console.log(`  [${lvlColor}${r.level}${C.reset}] ${C.bold}${r.ruleId}${C.reset}`);
    console.log(`       ${C.dim}${r.description}${C.reset}`);
    console.log(`       → ${r.action}`);
  }

  // Protocols
  section(`Protocols Applied (${ctx.protocols.length})`);
  for (const p of ctx.protocols.sort()) {
    console.log(`  • ${p}`);
  }

  // Exclusions
  section(`Hard Exclusions (${ctx.exclusions.length})`);
  const excCols = chunk(ctx.exclusions.sort(), 4);
  for (const row of excCols) {
    console.log("  " + row.map(e => e.padEnd(30)).join(""));
  }

  // Language flags
  section(`Language Flags (${ctx.languageFlags.length})`);
  if (ctx.languageFlags.length === 0) {
    console.log(`  ${C.dim}(none)${C.reset}`);
  } else {
    for (const f of ctx.languageFlags.sort()) {
      console.log(`  🚩 "${f}"`);
    }
  }

  // Condition guidance blocks
  section("Condition Guidance Blocks");
  if (ctx.conditionGuidanceBlocks.length === 0) {
    console.log(`  ${C.dim}(none)${C.reset}`);
  } else {
    for (const b of ctx.conditionGuidanceBlocks) {
      console.log(`  📋 ${b}`);
    }
  }

  // Clinician / dietitian flags
  section("Clinician & Dietitian Flags");
  const clinFlags = ctx.protocols.filter(p =>
    p.includes("consult") || p.includes("clinician") || p.includes("dietitian") ||
    p.includes("pediatrician")
  );
  const anaphylaxisRule = ctx.rulesFired.find(r => r.ruleId === "MPB-ALLERGY-EPINEPHRINE");
  if (clinFlags.length > 0) {
    for (const f of clinFlags) console.log(`  🏥 ${f}`);
  }
  if (anaphylaxisRule) {
    console.log(`  ⚡ ${C.red}Epinephrine on file — anaphylaxis risk flagged${C.reset}`);
  }
  if (clinFlags.length === 0 && !anaphylaxisRule) {
    console.log(`  ${C.dim}(no escalation flags for this profile)${C.reset}`);
  }

  // Conflict log
  section("Conflict Log");
  const conflictRules = ctx.rulesFired.filter(r =>
    r.ruleId.includes("CONFLICT") || r.description.toLowerCase().includes("conflict")
  );
  if (conflictRules.length === 0) {
    console.log(`  ${C.dim}(no cross-rule conflicts detected)${C.reset}`);
  } else {
    for (const r of conflictRules) {
      console.log(`  ⚠️  ${r.ruleId}: ${r.description}`);
    }
  }

  // Hard stop
  section("Hard Stop Status");
  console.log(`  ${C.green}hardStop: false — generation is permitted${C.reset}`);

  // Full JSON
  section("Full Context JSON");
  console.log(JSON.stringify(ctx, null, 2));

  console.log(`\n  ${C.green}✓ Zero AI calls made${C.reset}\n`);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILES
// ─────────────────────────────────────────────────────────────────────────────

async function runAll() {
  console.log(`\n${C.bold}${C.magenta}PEDIATRIC RESOLVER INSPECTOR — $(new Date().toISOString())${C.reset}`);
  console.log(`${C.dim}Runs resolvePediatricContext (adapter) on 4 canonical profiles.`);
  console.log(`No database reads. No AI calls. Pure deterministic engine output.${C.reset}`);

  // ── PROFILE 1: Healthy Preschooler ─────────────────────────────────────────
  const p1 = await resolvePediatricContext(
    {
      ageStage: "preschool",
      allergies: [],
      medicalConditions: [],
    },
    {
      foodRequest: "school lunch",
      mealContext: "school_lunch",
      requiresSchoolSafe: true,
      requiresPackable: true,
    }
  );
  printContext(p1, "Healthy Preschooler — school lunch, no conditions");

  // ── PROFILE 2: Complex Medical Child ──────────────────────────────────────
  const p2 = await resolvePediatricContext(
    {
      ageStage: "toddler",
      allergies: [
        { allergenId: "sesame",  severity: "confirmed_allergy" },
        { allergenId: "wheat",   severity: "clinician_elimination" },
      ],
      medicalConditions: ["celiac_disease", "iron_deficiency_anemia"],
      behavioralFlags: ["sensory_texture_restriction"],
    },
    {
      foodRequest: "dinner",
      mealContext: "school_lunch",
      requiresSchoolSafe: true,
    }
  );
  printContext(p2, "Complex Medical — celiac + sesame + iron deficiency + texture restriction, school-safe");

  // ── PROFILE 3a: PKU Hard Stop ─────────────────────────────────────────────
  const p3a = await resolvePediatricContext(
    {
      ageStage: "preschool",
      allergies: [],
      medicalConditions: ["pku"],
    },
    { foodRequest: "dinner" }
  );
  printContext(p3a, "Hard Stop — PKU");

  // ── PROFILE 3b: G-Tube Hard Stop ──────────────────────────────────────────
  const p3b = await resolvePediatricContext(
    {
      ageStage: "toddler",
      allergies: [],
      medicalConditions: ["g_tube"],
    },
    { foodRequest: "dinner" }
  );
  printContext(p3b, "Hard Stop — G-tube");

  // ── PROFILE 3c: Early Infant Hard Stop ────────────────────────────────────
  const p3c = await resolvePediatricContext(
    {
      ageStage: "early_infant",
      allergies: [],
      medicalConditions: [],
    },
    { foodRequest: "purée" }
  );
  printContext(p3c, "Hard Stop — Early Infant");

  // ── PROFILE 4: Family Meal — conflicting growth contexts ──────────────────
  const p4 = await resolvePediatricContext(
    {
      ageStage: "preschool",      // anchor: no conditions
      allergies: [],
      medicalConditions: [],
    },
    {
      foodRequest: "dinner for the whole family",
      mealContext: "family_meal",
      familyProfiles: [
        {
          childId: "inspect-celiac",
          ageStage: "toddler",
          allergies: [{ allergenId: "wheat", severity: "clinician_elimination" }],
          medicalConditions: ["celiac_disease"],
        },
        {
          childId: "inspect-iron",
          ageStage: "early_school_age",
          allergies: [],
          medicalConditions: ["iron_deficiency_anemia"],
        },
        {
          childId: "inspect-sensory",
          ageStage: "preschool",
          allergies: [],
          medicalConditions: ["autism_spectrum"],
          behavioralFlags: ["sensory_texture_restriction"],
        },
        {
          childId: "inspect-ftt",
          ageStage: "young_toddler",
          allergies: [],
          medicalConditions: ["failure_to_thrive"],
        },
      ],
    }
  );
  printContext(p4, "Family Meal — celiac + iron deficiency + sensory restriction + FTT");

  console.log(`\n${C.bold}${C.green}Inspector complete — zero AI calls made across all profiles.${C.reset}\n`);
}

runAll().catch(err => {
  console.error("Inspector error:", err);
  process.exit(1);
});
