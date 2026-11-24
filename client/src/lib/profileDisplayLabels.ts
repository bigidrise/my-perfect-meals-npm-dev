/** Display-only, closed mappings. Unknown/custom values are never translated. */
const labels = {
  heat: { none: "No Heat", mild: "Mild", medium: "Medium", hot: "Hot", "very-hot": "Very Hot", unsure: "Not Sure" },
  seasoning: { light: "Light", balanced: "Balanced", bold: "Bold" },
  flavor: { classic: "Classic", herb: "Herb-forward", savory: "Savory", bright: "Bright & Fresh" },
  spice: { none: "No spice", mild: "Mild", medium: "Medium", hot: "Hot" },
  sweetener: { regular_sugar: "Regular Sugar", honey: "Honey", stevia: "Stevia", monk_fruit: "Monk Fruit", equal: "Equal", splenda: "Splenda", avoid_sweeteners: "Avoid Sweeteners" },
  cuisineIntensity: { light: "Light Influence", balanced: "Balanced", authentic: "Authentic" },
  protocol: {
    renal: "Kidney / Renal Disease", cardiac: "Cardiac / Heart Disease", "liver-disease": "Liver Disease",
    "liver-support": "Liver Support", "oncology-support": "Cancer / Oncology Support", "thyroid-support": "Thyroid Support",
    hashimotos: "Hashimoto's", hypothyroid: "Hypothyroid", hyperthyroid: "Hyperthyroid",
    "hormone-optimization": "Hormone Optimization", menopause: "Menopause", perimenopause: "Perimenopause",
    "metabolic-recovery": "Metabolic Recovery", "pregnancy-support": "🩷 My Perfect Pregnancy",
    "alpha-gal-syndrome": "🩸 Alpha-gal Syndrome", "therapeutic-support": "Therapeutic Support",
    "performance-nutrition": "Performance Nutrition",
  },
  avoidedFood: { vegetables: "Vegetables", mushrooms: "Mushrooms", onions: "Onions", seafood: "Seafood", pork: "Pork", "red meat": "Red Meat" },
} as const;

export function profileDisplayLabel(
  translate: (key: string) => string,
  group: keyof typeof labels,
  value: string | null | undefined,
): string {
  if (!value) return "—";
  const source = (labels[group] as Record<string, string>)[value];
  return source ? translate(source) : value;
}

/** Matches only the existing built-in choices; custom cuisine text is retained. */
export function profileCuisineLabel(translate: (key: string) => string, value: string, builtIns: readonly string[]): string {
  const source = builtIns.find(label => label.toLowerCase() === value.toLowerCase());
  return source ? translate(source) : value;
}

/** Preserve the server's PIN failure reason, including its enforced wait time. */
export function profilePinError(
  translate: (key: string, options?: Record<string, unknown>) => string,
  error: unknown,
  fallback: string,
): string {
  if (typeof error !== "string" || !error) return translate(fallback);
  const limited = /^Too many failed attempts\. Please wait (\d+) seconds before trying again\.$/.exec(error);
  return limited
    ? translate("Too many failed attempts. Please wait {{seconds}} seconds before trying again.", { seconds: limited[1] })
    : translate(error);
}

const saveFailureMessages: Record<string, string> = {
  EMAIL_CHANGE_VERIFICATION_REQUIRED: "Email changes require verified account-identity review. Your current sign-in email has not changed.",
  ALLERGY_PIN_REQUIRED: "Allergy changes require PIN verification",
  ALLERGY_TOKEN_INVALID: "Your allergy-edit permission expired. Unlock your allergies with your Safety PIN and try again.",
  VALIDATION_FAILED: "Some required profile information is missing. Review your entries and try again.",
};

/** Do not show raw JSON, internal failures or arbitrary server text as UI copy. */
export function profileSaveError(translate: (key: string) => string, code: unknown): string {
  return translate(typeof code === "string" && Object.hasOwn(saveFailureMessages, code)
    ? saveFailureMessages[code] : "Could not save your profile. Try again.");
}
