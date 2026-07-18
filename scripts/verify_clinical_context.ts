import { db } from "../server/db/index.js";
import { users } from "../shared/schema.js";
import { eq, count } from "drizzle-orm";
import { deriveClinicalStatus } from "../shared/dailyNutritionPrescription.js";
import { getTierForLookupKey } from "../shared/planFeatures.js";
import { clinicalLabs } from "../server/db/schema/clinicalLabs.js";
import { companionProfiles } from "../server/db/schema/companionProfiles.js";

async function checkUser(userId: string, label: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) { console.log(`  [${label}] user not found`); return; }

  const [labResult, cpResult] = await Promise.all([
    db.select({ count: count() }).from(clinicalLabs).where(eq(clinicalLabs.userId, userId)),
    db.select().from(companionProfiles).where(eq(companionProfiles.userId, userId)).limit(1),
  ]);

  const tier = getTierForLookupKey(user.planLookupKey);
  const hasLabs = (labResult[0]?.count ?? 0) > 0;
  const hasVerifiedMedications =
    Array.isArray(cpResult[0]?.medications) && (cpResult[0]!.medications as string[]).length > 0;
  const selfCategories = Array.isArray(user.clinicalContextCategories)
    ? (user.clinicalContextCategories as string[]) : [];
  const hasScreeningResponse = user.clinicalContextResponse === "yes" && selfCategories.length > 0;

  const status = deriveClinicalStatus(tier, hasVerifiedMedications, hasLabs, hasScreeningResponse);

  console.log(`\n[${label}]`);
  console.log(`  email:               ${user.email}`);
  console.log(`  plan:                ${user.planLookupKey || 'free'} → tier: ${tier}`);
  console.log(`  hasVerifiedMeds:     ${hasVerifiedMedications}`);
  console.log(`  hasLabs:             ${hasLabs} (count: ${labResult[0]?.count ?? 0})`);
  console.log(`  hasScreeningResponse:${hasScreeningResponse}`);
  console.log(`  clinical_response:   ${user.clinicalContextResponse ?? 'null'}`);
  console.log(`  clinical_categories: ${JSON.stringify(user.clinicalContextCategories ?? [])}`);
  console.log(`  starch_meals:        ${user.defaultStarchMealsPerDay ?? 'null'}`);
  console.log(`  starch_strategy:     ${user.starchDistributionStrategy ?? 'null'}`);
  console.log(`  ★ RESOLVER STATUS:  ${status}`);
}

(async () => {
  console.log("=== CLINICAL CONTEXT — RESOLVER ACCEPTANCE TEST ===\n");

  // Scenario 1: Free user, no clinical factors (test data written: 6 starch + GLP-1)
  await checkUser("43f76458-bb49-49fb-9742-56d2bc719b5a", "S1/S7 — free user (starch=6, GLP-1+thyroid written)");

  // Scenario 3: Ultimate user said NO to medications, no labs
  await checkUser("27cfd917-1b4c-4b9f-a731-62a152178eff", "S3 — ultimate, response=no, 0 labs");

  // Scenario 4/5: Ultimate user with screening YES + 3 labs (no companion meds)
  await checkUser("a550419c-b0c9-46f7-9573-186ea96707f0", "S4/S5 — ultimate, screening=yes, 3 labs, no companion meds");

  console.log("\n=== DONE ===");
  process.exit(0);
})();
