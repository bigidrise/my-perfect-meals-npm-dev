import { consumerFeatureSpanish } from "./consumerFeatureCopy";
import { useConsumerCopy } from "./useConsumerCopy";

const notices = [
  "Your existing compatible choices are still available.",
  "Previously saved choices are withheld because their food context is no longer current. Create new choices to continue.",
  "Previous choices could not be verified for this request.",
  "No previous choices are available.",
];
// Only exact, application-authored UI messages. No substring translation of
// recipes, records, clinical explanations or arbitrary service error details.
const errorKeys = [
  ...notices,
  "We couldn't complete three compatible ideas this time. Your settings were not changed.",
  "We couldn't create three compatible ideas this time. Your settings were not changed.",
  "We couldn't restore your menu ideas.",
  "We couldn't verify your saved menu ideas. Please reload.",
  "We couldn't create your ideas.",
  "We couldn't check the current food context.",
  "We couldn't restore your saved menu ideas. Please reload before creating new ones.",
  "We couldn't clear these ideas.",
  "We couldn't resolve the assigned Meal Builder. Please try again.",
  "We couldn't finish this meal. Please choose it again.",
  "We couldn't finish this meal.",
  "Choose Food Snack or Dessert Snack first.",
  "Choose the current snack type before completing an idea.",
  "Enter your current blood glucose reading.",
  "We couldn't check today's GLP-1 status.",
  "We couldn't save your blood glucose reading.",
  "The meal couldn't be added to your plan.",
  "The finished recipe doesn't match your selected snack idea. Please choose it again.",
  "The finished recipe no longer matches your selected idea and meal type. It was not added to your plan. Please choose the idea again.",
  "We couldn't verify the finished recipe's meal type. It was not added to your plan. Please try again.",
  "The finished recipe did not match your selected idea.",
  "The finished snack did not match your selected idea.",
];

export function useBatchOneErrorCopy() {
  const { t } = useConsumerCopy();
  return (source: string): string => {
    const exact = errorKeys.find(key => source === key || source === consumerFeatureSpanish[key]);
    if (exact) return t(exact);
    for (const notice of notices) {
      for (const suffix of [notice, consumerFeatureSpanish[notice]]) {
        if (suffix && source.endsWith(` ${suffix}`)) {
          const base = source.slice(0, -suffix.length - 1);
          const key = errorKeys.find(key => base === key || base === consumerFeatureSpanish[key]);
          return `${key ? t(key) : base} ${t(notice)}`;
        }
      }
    }
    return source;
  };
}

export function useGlp1FormCopy() {
  const { t } = useConsumerCopy();
  return {
    symptoms: {
      nausea: t("Nausea"), reflux: t("Reflux"), constipation: t("Constipation"),
      diarrhea: t("Diarrhea"), bloating: t("Bloating"), earlyFullness: t("Early fullness"),
      foodAversions: t("Food aversions"),
    } as Record<string, string>,
    severity: { none: t("None"), mild: t("Mild"), moderate: t("Moderate"), severe: t("Severe") } as Record<string, string>,
    appetite: { suppressed: t("Suppressed"), reduced: t("Reduced"), normal: t("Normal"), increased: t("Increased") } as Record<string, string>,
  };
}
