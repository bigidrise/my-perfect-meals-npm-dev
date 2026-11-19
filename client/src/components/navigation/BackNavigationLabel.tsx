import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { useCallback } from "react";

/** Closed set of system-owned navigation labels. Never translate user records. */
export const BACK_NAVIGATION_SOURCES = [
  "Back", "Go Back", "Go back", "Previous", "Admin",
  "Hub", "GLP-1 Hub", "Metabolic Hub", "Diabetes Hub",
  "Performance Hub", "Social Hub", "Lifestyle Hub", "Pairings Hub",
  "Beverage Creator Hub", "Craving Creator Hub",
  "Business Center", "Business Suite", "Organization Dashboard",
  "Partner Programs", "Client Dashboard", "My Perfect Beginnings",
  "My Perfect Cat", "My Perfect Dog", "My Perfect Pets",
  "My Perfect Beginning", "Back to My Perfect Beginning",
  "Back to My Perfect Beginnings", "Back to My Perfect Cat",
  "Back to My Perfect Dog", "Back to My Perfect Pets",
  "Back to Partners", "Back to Lifestyle", "Back to Clients",
  "Back to Tutorials", "Back to Guest Builder",
  "Back to professional information", "Return to your account",
  "Return to Pro Portal", "Return to Previous Page",
  "Return to Organization Quick Start",
  "Back to Subscription", "Back to Drink Intelligence",
  "Back to dashboard", "Back to Biometrics", "Back to Macro Calculator",
  "Back to Craving Creator Hub", "Back to top",
  "Back to Top", "Return to Organization Hub", "Return to Dashboard",
  "Back to Dashboard", "Back to Ask Chef", "Back to Plans",
  "Return to Meal Hub Now", "Back to Academy", "Back to Lifestyle Hub",
  "Return to Overview", "Back to Meal Card", "Back to Complete the Plate",
  "Weekly Meal Board", "Performance Nutrition Builder", "Saved Meals",
  "Quick Log", "Craving Creator", "Create a Dish", "Macro Calculator",
  "Dashboard", "My Perfect Buffet", "Back to Guest Suite",
  "Previous week", "Previous slide",
  "Academy", "Back to Guest Experience", "Admin Dashboard", "Back to app",
  "Back to results", "Return to Partner & Revenue", "Return to My Perfect Meals",
  "View all partner programs", "Start over with a different request",
  "Return to Demo Studio",
] as const;
const sources = new Set<string>(BACK_NAVIGATION_SOURCES);

export function useBackNavigationLabel() {
  const { t } = useConsumerCopy();
  return useCallback((label: string) => sources.has(label) ? t(label) : label, [t]);
}

/** Text only: the existing control retains its route, callback and semantics. */
export function BackNavigationLabel({
  label = "Back", backTo = false,
}: { label?: string; backTo?: boolean }) {
  const translate = useBackNavigationLabel();
  const { t } = useConsumerCopy();
  const name = translate(label);
  return <>{backTo ? t("Back to {{name}}", { name }) : name}</>;
}
