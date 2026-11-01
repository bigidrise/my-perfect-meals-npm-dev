import fs from "node:fs";
import path from "node:path";
import { PLAN_FEATURES } from "@shared/planFeatures";
import { getPlansByGroup } from "@/data/planSkus";
import { chefMemberText } from "@/lib/chefMemberBranding";

test("both Pro pricing sources include Ask Chef without adding an entitlement key", () => {
  expect(PLAN_FEATURES.premium.displayFeatures.some(text => text.startsWith("Ask Chef"))).toBe(true);
  expect(getPlansByGroup("consumer").find(plan => plan.sku === "mpm_premium")?.features)
    .toContain("Ask Chef — conversational food, nutrition, and My Perfect Meals guidance");
  expect(PLAN_FEATURES.premium.entitlements).not.toContain("ask_chef");
  expect(PLAN_FEATURES.premium.entitlements).not.toContain("chef_corner");
});

const locales = path.resolve(process.cwd(), "client/src/i18n/locales");
test.each(fs.readdirSync(locales).filter(file => file.endsWith(".json")))(
  "%s keeps the feature brand in its translated title and open button", file => {
    const copy = JSON.parse(fs.readFileSync(path.join(locales, file), "utf8")).coachCorner;
    expect(copy.title).toBe("Ask Chef");
    expect(copy.openBtn).toContain("Ask Chef");
  });

test.each(["Chef's Corner", "Chef’s Corner", "Chefs Corner", "Chef Corner",
  "Coach's Corner", "Coach’s Corner", "Coachs Corner", "Coach Corner"])(
  "legacy member copy %s resolves to Ask Chef", copy => {
    expect(chefMemberText(copy)).toBe("Ask Chef");
    expect(chefMemberText("/coach-corner/home Parent's Corner Chef Studio")).toBe(
      "/coach-corner/home Parent's Corner Chef Studio");
  });
