import { AppKnowledge } from "@/lib/knowledge/AppKnowledgeRegistry";
import {
  HYDRATION_HUB_DESCRIPTION,
  HYDRATION_HUB_DOORS,
  HYDRATION_HUB_MEDICAL_BOUNDARY,
  HYDRATION_HUB_TITLE,
} from "@/lib/hydrationHubContent";
import {
  DIRECT_PAGES,
  findFeatureFromRegistry,
} from "@/components/copilot/CanonicalAliasRegistry";
import {
  KEYWORD_FEATURE_MAP,
  findFeatureFromKeywords,
} from "@/components/copilot/KeywordFeatureMap";
import { PAGE_EXPLANATIONS } from "@/components/copilot/CopilotPageExplanations";

describe("My Perfect Hydration Center discoverability", () => {
  it("uses one canonical customer-facing title and description", () => {
    expect(HYDRATION_HUB_TITLE).toBe("My Perfect Hydration Center");
    expect(HYDRATION_HUB_DESCRIPTION).toContain("Nutrition Life Plan");
    expect(AppKnowledge.hydration.title).toBe(HYDRATION_HUB_TITLE);
    expect(PAGE_EXPLANATIONS["/hydration"].title).toBe(HYDRATION_HUB_TITLE);
  });

  it("describes all four Hydration doors in Copilot knowledge", () => {
    const combined = [
      AppKnowledge.hydration.description,
      ...(AppKnowledge.hydration.howTo ?? []),
      PAGE_EXPLANATIONS["/hydration"].spokenText,
    ].join(" ");

    for (const door of HYDRATION_HUB_DOORS) {
      expect(combined).toContain(door.title);
      expect(combined).toContain(door.description);
    }
  });

  it("keeps the medical boundary explicit", () => {
    const combined = [
      ...(AppKnowledge.hydration.tips ?? []),
      PAGE_EXPLANATIONS["/hydration"].spokenText,
    ].join(" ");
    expect(combined).toContain(HYDRATION_HUB_MEDICAL_BOUNDARY);
    expect(combined).toContain("does not diagnose");
    expect(combined).toContain("independently prescribe fluid or electrolyte requirements");
  });

  it.each([
    "what is Hydration Hub",
    "where do I log water",
    "where can I see my hydration plan",
    "can hydration help with training",
    "what is liquid nutrition",
    "what does considered for you hydration mean",
  ])("routes legacy and current queries to My Perfect Hydration Center", (query) => {
    expect(findFeatureFromRegistry(query)?.primaryRoute).toBe("/hydration");
  });

  it("keeps Hydration available in both current Copilot registries", () => {
    expect(DIRECT_PAGES.HYDRATION?.primaryRoute).toBe("/hydration");
    expect(findFeatureFromKeywords("open hydration hub")?.path).toBe("/hydration");
    expect(
      KEYWORD_FEATURE_MAP.find((entry) => entry.walkthroughId === "hydration"),
    ).toBeDefined();
  });
});