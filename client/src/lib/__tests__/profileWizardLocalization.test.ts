import fs from "node:fs";
import ts from "typescript";
import i18next from "i18next";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import { PROFILE_WIZARD_STEPS, nextProfileStep, previousProfileStep } from "@/lib/profileWizardSteps";
import { profileDisplayLabel, profileCuisineLabel, profilePinError, profileSaveError } from "@/lib/profileDisplayLabels";
import { FOOD_INCLUSION_PRIORITY_REGISTRY } from "@shared/nutritionPriorities";
import { LOW_RANGE_OPTIONS, MID_RANGE_OPTIONS, HIGH_RANGE_OPTIONS } from "@/types/glycemic";
import en from "@/i18n/locales/en.json";
import es from "@/i18n/locales/es.json";

describe("Edit Profile configuration and display-only localization", () => {
  test("uses four consecutive active steps with sequential boundary-safe navigation", () => {
    expect(PROFILE_WIZARD_STEPS.map(step => step.id)).toEqual([1, 2, 3, 4]);
    expect(PROFILE_WIZARD_STEPS.map(step => nextProfileStep(step.id))).toEqual([2, 3, 4, 4]);
    expect(PROFILE_WIZARD_STEPS.map(step => previousProfileStep(step.id))).toEqual([1, 1, 2, 3]);
    expect(PROFILE_WIZARD_STEPS.at(-1)?.title).toBe("Review & Save");
  });

  test("interpolates the active count and switches languages without rewriting data", async () => {
    const instance = i18next.createInstance();
    await instance.init({
      lng: "en", fallbackLng: "en", keySeparator: false, nsSeparator: false,
      resources: { en: { translation: consumerEnglish }, es: { translation: consumerSpanish } },
    });
    const values = { current: PROFILE_WIZARD_STEPS.length, total: PROFILE_WIZARD_STEPS.length };
    expect(instance.t("Step {{current}} of {{total}}", values)).toBe("Step 4 of 4");
    await instance.changeLanguage("es");
    expect(instance.t("Step {{current}} of {{total}}", values)).toBe("Paso 4 de 4");
    const canonical = { sweetener: "monk_fruit", protocol: "thyroid-support", cuisine: "mexican", custom: "Family Sunday food" };
    const translate = (key: string) => String(instance.t(key));
    expect(profileDisplayLabel(translate, "sweetener", canonical.sweetener)).toBe("Fruta del monje");
    expect(profileDisplayLabel(translate, "protocol", canonical.protocol)).toBe("Apoyo tiroideo");
    expect(profileCuisineLabel(translate, canonical.cuisine, ["Mexican"])).toBe("Mexicana");
    expect(profileCuisineLabel(translate, canonical.custom, ["Mexican"])).toBe(canonical.custom);
    expect(profileDisplayLabel(translate, "avoidedFood", canonical.custom)).toBe(canonical.custom);
    expect(profilePinError((key, values) => String(instance.t(key, values as any)),
      "Too many failed attempts. Please wait 30 seconds before trying again.", "Incorrect PIN"))
      .toBe("Demasiados intentos fallidos. Espera 30 segundos antes de intentarlo de nuevo.");
    expect(profileSaveError(translate, "ALLERGY_PIN_REQUIRED")).toBe("Los cambios de alergias requieren verificación con el PIN");
    expect(profileSaveError(translate, "unexpected_failure")).toBe("No se pudo guardar tu perfil. Inténtalo de nuevo.");
    expect(canonical).toEqual({ sweetener: "monk_fruit", protocol: "thyroid-support", cuisine: "mexican", custom: "Family Sunday food" });
    await instance.changeLanguage("en");
    expect(profileDisplayLabel(translate, "sweetener", canonical.sweetener)).toBe("Monk Fruit");
  });

  test("all static source-key copy has a Spanish catalog entry", () => {
    const files = [
      "client/src/pages/profile/EditProfilePage.tsx",
      "client/src/components/AlphaGalProfileModal.tsx",
      "client/src/components/NutritionPrioritiesSelector.tsx",
      "client/src/components/profile/AntiInflammatorySupportControl.tsx",
      "client/src/components/OncologySymptomDialog.tsx",
      "client/src/components/OncologySymptomSelector.tsx",
    ];
    const missing: string[] = [];
    for (const file of files) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && node.expression.getText(source) === "t" &&
            node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          const key = node.arguments[0].text;
          if (Object.hasOwn(consumerEnglish, key)) {
            if (!consumerSpanish[key]) missing.push(`${file}: ${key}`);
          } else if (!key.includes(":") && !(es.editProfile as Record<string, unknown>)[key]) {
            missing.push(`${file}: ${key}`);
          }
        }
        if (ts.isJsxText(node) && /[A-Za-z]{2}/.test(node.text) && node.text.trim() !== "My Perfect Pregnancy —") {
          missing.push(`${file}: untranslated JSX ${node.text.trim()}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(missing).toEqual([]);
  });

  test("keeps nutrition education, glucose options and PIN catalogs complete", () => {
    const texts: string[] = [...LOW_RANGE_OPTIONS, ...MID_RANGE_OPTIONS, ...HIGH_RANGE_OPTIONS];
    for (const definition of Object.values(FOOD_INCLUSION_PRIORITY_REGISTRY).filter(item => item.status === "active")) {
      texts.push(definition.label, definition.shortSummary, definition.whatItIs, definition.whyChooseIt,
        definition.whatMpmDoes, ...definition.foodExamples, ...definition.limitations,
        ...definition.citations.map(citation => citation.title));
    }
    expect([...new Set(texts)].filter(text => !consumerSpanish[text])).toEqual([]);
    expect(Object.keys(en.safetyPin).filter(key => !(es.safetyPin as Record<string, unknown>)[key])).toEqual([]);
    expect(Object.keys(en.measurementPreferences).filter(key => !(es.measurementPreferences as Record<string, unknown>)[key])).toEqual([]);
  });

  test("retains medical and allergy saving guards without new runtime localization gates", () => {
    const page = fs.readFileSync("client/src/pages/profile/EditProfilePage.tsx", "utf8");
    expect(page).toContain("allergiesChanged && !allergiesUnlocked");
    expect(page).toContain("allergiesChanged && allergyEditToken");
    expect(page).toContain('"/api/users/profile"');
    expect(page).toContain("saveMeasurementPreferences");
    expect(page).toContain("alphaGalWillBeActive && !alphaGalProfile?.profileComplete");
    expect(page).not.toContain("setStep(5)");
    expect(page).not.toContain("glycemicEligible ? 4 : 5");
    expect(page).not.toContain("of 5");
    expect(page).toContain("PROFILE_WIZARD_STEPS.length");
    expect(page).toContain("glycemicEligible && glycemicDirty");
    expect(page).toContain("disabled={glycemicLoading || glycemicUnavailable}");
    for (const file of ["client/src/lib/profileWizardSteps.ts", "client/src/lib/profileDisplayLabels.ts"]) {
      expect(fs.readFileSync(file, "utf8")).not.toMatch(/import\.meta\.env|NODE_ENV|isDevelopmentRuntime/);
    }
  });
});
