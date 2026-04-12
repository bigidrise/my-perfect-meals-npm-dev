export type BiometricsSection = "macros" | "weight" | "body";

export type BiometricsFrom =
  | "weekly-meal-board"
  | "beachbody-meal-board"
  | "saved-meals"
  | "quick-log"
  | "craving-studio"
  | "chefs-kitchen"
  | "macro-calculator"
  | "dashboard";

export const BIOMETRICS_SOURCES: Record<BiometricsFrom, { label: string; path: string }> = {
  "weekly-meal-board":    { label: "Weekly Meal Board",       path: "/weekly-meal-board" },
  "beachbody-meal-board": { label: "Beach Body Meal Board",   path: "/beachbody-meal-board" },
  "saved-meals":          { label: "Saved Meals",             path: "/saved-meals" },
  "quick-log":            { label: "Quick Log",               path: "/" },
  "craving-studio":       { label: "Craving Creator",         path: "/craving-creator" },
  "chefs-kitchen":        { label: "Create a Dish",            path: "/lifestyle/chefs-kitchen" },
  "macro-calculator":     { label: "Macro Calculator",        path: "/macro-counter" },
  "dashboard":            { label: "Dashboard",               path: "/" },
};

export const SECTION_IDS: Record<BiometricsSection, string> = {
  macros: "biometrics-macros-section",
  weight: "biometrics-weight-section",
  body:   "biometrics-weight-section",
};

export function buildBiometricsUrl(params: {
  section?: BiometricsSection;
  from?: BiometricsFrom;
  highlight?: boolean;
  draft?: boolean;
}): string {
  const url = new URLSearchParams();
  if (params.section)   url.set("section",    params.section);
  if (params.from)      url.set("from",       params.from);
  if (params.highlight) url.set("highlight",  "qv");
  if (params.draft)     url.set("draft",      "1");
  const qs = url.toString();
  return qs ? `/my-biometrics?${qs}` : "/my-biometrics";
}

export function parseBiometricsParams(search: string): {
  section: BiometricsSection | null;
  from: BiometricsFrom | null;
  highlight: boolean;
  draft: boolean;
} {
  const params = new URLSearchParams(search);
  const sectionRaw   = params.get("section");
  const fromRaw      = params.get("from");
  const highlightRaw = params.get("highlight");
  const draftRaw     = params.get("draft");

  const validSections: BiometricsSection[] = ["macros", "weight", "body"];
  const validFroms = Object.keys(BIOMETRICS_SOURCES) as BiometricsFrom[];

  return {
    section:   validSections.includes(sectionRaw as BiometricsSection) ? (sectionRaw as BiometricsSection) : null,
    from:      validFroms.includes(fromRaw as BiometricsFrom) ? (fromRaw as BiometricsFrom) : null,
    highlight: highlightRaw === "qv",
    draft:     draftRaw === "1",
  };
}
