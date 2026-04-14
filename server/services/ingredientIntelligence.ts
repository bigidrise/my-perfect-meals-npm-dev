/**
 * Ingredient Intelligence Store
 * Phase 1 — Food Intelligence Layer
 *
 * High-risk ingredient provenance and certification database.
 * Covers ingredients whose safety depends on SOURCE and PROCESS,
 * not just the ingredient name alone.
 *
 * Fail-closed rule: if certification or source is "unknown" for a strict
 * protocol, the risk is treated as "unsafe" — never "safe".
 *
 * Phase 2 will expand to a full ontology. This covers the high-risk MVP set.
 */

export type IngredientSource = "animal" | "plant" | "synthetic" | "derived" | "unknown";
export type Certification = "kosher-certified" | "halal-certified" | "both-certified" | "none" | "unknown";
export type RiskLevel = "safe" | "unsafe" | "unknown";

export interface ProcessMetadata {
  slaughterMethod?: "dhabiha" | "shechita" | "conventional" | "unknown";
  fermentation?: "microbial" | "animal-enzyme" | "unknown";
  refinement?: "raw" | "refined" | "hydrolyzed" | "unknown";
  notes?: string[];
}

export interface ProtocolRisk {
  protocolId: string;
  risk: RiskLevel;
  reason: string;
}

export interface IngredientIntelligence {
  ingredientKey: string;
  displayName: string;
  aliases: string[];
  source: IngredientSource;
  derivedFrom?: string[];
  process: ProcessMetadata;
  certification: Certification;
  protocolRisk: ProtocolRisk[];
  confidence: "high" | "medium" | "low";
  failClosedProtocols: string[];
}

const INGREDIENT_INTELLIGENCE_STORE: IngredientIntelligence[] = [
  // ─────────────────────────────────────────────────────────────────
  // GELATIN VARIANTS
  // ─────────────────────────────────────────────────────────────────
  {
    ingredientKey: "gelatin-pork",
    displayName: "Gelatin (Pork-Derived)",
    aliases: ["pork gelatin", "gelatin (pork)", "pig gelatin", "swine gelatin"],
    source: "derived",
    derivedFrom: ["pork"],
    process: { refinement: "hydrolyzed" },
    certification: "none",
    protocolRisk: [
      { protocolId: "kosher", risk: "unsafe", reason: "Pork-derived gelatin is not kosher" },
      { protocolId: "halal", risk: "unsafe", reason: "Pork-derived gelatin is forbidden in halal" },
    ],
    confidence: "high",
    failClosedProtocols: ["kosher", "halal"],
  },
  {
    ingredientKey: "gelatin-beef",
    displayName: "Gelatin (Bovine-Derived)",
    aliases: ["beef gelatin", "bovine gelatin", "gelatin (beef)", "cow gelatin"],
    source: "derived",
    derivedFrom: ["beef"],
    process: { slaughterMethod: "unknown", refinement: "hydrolyzed" },
    certification: "unknown",
    protocolRisk: [
      { protocolId: "kosher", risk: "unknown", reason: "Requires kosher-certified slaughter and certification; unknown by default" },
      { protocolId: "halal", risk: "unknown", reason: "Requires halal-certified slaughter; unknown by default" },
    ],
    confidence: "medium",
    failClosedProtocols: ["kosher", "halal"],
  },
  {
    ingredientKey: "gelatin-fish",
    displayName: "Gelatin (Fish-Derived, Certified)",
    aliases: ["fish gelatin", "gelatin (fish)", "marine gelatin", "kosher gelatin", "halal gelatin"],
    source: "derived",
    derivedFrom: ["fish"],
    process: { refinement: "hydrolyzed" },
    certification: "both-certified",
    protocolRisk: [
      { protocolId: "kosher", risk: "safe", reason: "Fish gelatin from kosher fish is generally accepted" },
      { protocolId: "halal", risk: "safe", reason: "Fish gelatin from permissible fish is halal" },
    ],
    confidence: "medium",
    failClosedProtocols: [],
  },
  {
    ingredientKey: "gelatin-unknown",
    displayName: "Gelatin (Unknown Source)",
    aliases: ["gelatin", "gelatine", "hydrolyzed gelatin", "unflavored gelatin"],
    source: "unknown",
    process: { refinement: "unknown" },
    certification: "unknown",
    protocolRisk: [
      { protocolId: "kosher", risk: "unknown", reason: "Source and certification unknown — fail closed" },
      { protocolId: "halal", risk: "unknown", reason: "Source and certification unknown — fail closed" },
    ],
    confidence: "high",
    failClosedProtocols: ["kosher", "halal"],
  },

  // ─────────────────────────────────────────────────────────────────
  // RENNET VARIANTS
  // ─────────────────────────────────────────────────────────────────
  {
    ingredientKey: "rennet-animal",
    displayName: "Rennet (Animal)",
    aliases: ["animal rennet", "calf rennet", "traditional rennet", "natural rennet"],
    source: "derived",
    derivedFrom: ["calf", "beef"],
    process: { slaughterMethod: "unknown" },
    certification: "unknown",
    protocolRisk: [
      { protocolId: "kosher", risk: "unknown", reason: "Requires certified kosher slaughter and separation from dairy — unknown without certification" },
      { protocolId: "halal", risk: "unknown", reason: "Requires halal-certified source animal" },
    ],
    confidence: "medium",
    failClosedProtocols: ["kosher", "halal"],
  },
  {
    ingredientKey: "rennet-microbial",
    displayName: "Rennet (Microbial / Vegetable)",
    aliases: ["microbial rennet", "vegetable rennet", "plant-based rennet", "fermentation-produced chymosin"],
    source: "plant",
    process: { fermentation: "microbial" },
    certification: "both-certified",
    protocolRisk: [
      { protocolId: "kosher", risk: "safe", reason: "Microbial rennet is generally accepted as kosher-pareve" },
      { protocolId: "halal", risk: "safe", reason: "Microbial rennet is generally accepted as halal" },
    ],
    confidence: "high",
    failClosedProtocols: [],
  },

  // ─────────────────────────────────────────────────────────────────
  // EMULSIFIERS / ADDITIVES
  // ─────────────────────────────────────────────────────────────────
  {
    ingredientKey: "mono-diglycerides",
    displayName: "Mono- and Diglycerides",
    aliases: ["mono- and diglycerides", "monoglycerides", "diglycerides", "e471", "471"],
    source: "unknown",
    derivedFrom: ["may be pork, beef, or plant-derived"],
    process: { refinement: "refined" },
    certification: "unknown",
    protocolRisk: [
      { protocolId: "kosher", risk: "unknown", reason: "May be derived from pork fat; requires kosher certification to be safe" },
      { protocolId: "halal", risk: "unknown", reason: "May be derived from pork fat; requires halal certification to be safe" },
    ],
    confidence: "high",
    failClosedProtocols: ["kosher", "halal"],
  },
  {
    ingredientKey: "lecithin-soy",
    displayName: "Soy Lecithin",
    aliases: ["soy lecithin", "sunflower lecithin", "lecithin (soy)"],
    source: "plant",
    process: { refinement: "refined" },
    certification: "both-certified",
    protocolRisk: [
      { protocolId: "kosher", risk: "safe", reason: "Plant-derived lecithin is generally kosher" },
      { protocolId: "halal", risk: "safe", reason: "Plant-derived lecithin is generally halal" },
    ],
    confidence: "high",
    failClosedProtocols: [],
  },
  {
    ingredientKey: "carmine",
    displayName: "Carmine / Cochineal",
    aliases: ["carmine", "cochineal", "e120", "natural red 4", "carminic acid"],
    source: "animal",
    derivedFrom: ["cochineal insect"],
    process: {},
    certification: "none",
    protocolRisk: [
      { protocolId: "kosher", risk: "unsafe", reason: "Derived from an insect; not kosher" },
      { protocolId: "halal", risk: "unsafe", reason: "Scholars differ; conservative halal opinion prohibits insect derivatives" },
    ],
    confidence: "high",
    failClosedProtocols: ["kosher", "halal"],
  },

  // ─────────────────────────────────────────────────────────────────
  // ANIMAL FATS
  // ─────────────────────────────────────────────────────────────────
  {
    ingredientKey: "lard",
    displayName: "Lard",
    aliases: ["lard", "pork fat", "pig fat", "rendered pork fat", "manteca"],
    source: "animal",
    derivedFrom: ["pork"],
    process: {},
    certification: "none",
    protocolRisk: [
      { protocolId: "kosher", risk: "unsafe", reason: "Pork fat is not kosher" },
      { protocolId: "halal", risk: "unsafe", reason: "Pork fat is haram" },
    ],
    confidence: "high",
    failClosedProtocols: ["kosher", "halal"],
  },
  {
    ingredientKey: "tallow",
    displayName: "Tallow (Beef Fat)",
    aliases: ["tallow", "beef tallow", "suet", "beef suet", "rendered beef fat"],
    source: "animal",
    derivedFrom: ["beef"],
    process: { slaughterMethod: "unknown" },
    certification: "unknown",
    protocolRisk: [
      { protocolId: "kosher", risk: "unknown", reason: "Beef tallow requires kosher slaughter and cannot be mixed with dairy" },
      { protocolId: "halal", risk: "unknown", reason: "Requires halal-certified source" },
    ],
    confidence: "medium",
    failClosedProtocols: ["kosher", "halal"],
  },
  {
    ingredientKey: "schmaltz",
    displayName: "Schmaltz (Rendered Poultry Fat)",
    aliases: ["schmaltz", "rendered chicken fat", "rendered duck fat", "poultry fat"],
    source: "animal",
    derivedFrom: ["chicken", "duck"],
    process: { slaughterMethod: "unknown" },
    certification: "unknown",
    protocolRisk: [
      { protocolId: "kosher", risk: "unknown", reason: "Requires kosher slaughter certification; cannot be served with dairy" },
      { protocolId: "halal", risk: "unknown", reason: "Requires halal-certified poultry source" },
    ],
    confidence: "medium",
    failClosedProtocols: ["kosher", "halal"],
  },

  // ─────────────────────────────────────────────────────────────────
  // BROTHS AND STOCKS
  // ─────────────────────────────────────────────────────────────────
  {
    ingredientKey: "bone-broth-unknown",
    displayName: "Bone Broth (Unknown Source)",
    aliases: ["bone broth", "broth", "stock", "chicken stock", "beef stock", "meat broth", "beef broth"],
    source: "animal",
    derivedFrom: ["unknown animal source"],
    process: { slaughterMethod: "unknown" },
    certification: "unknown",
    protocolRisk: [
      { protocolId: "kosher", risk: "unknown", reason: "Source animal and slaughter method unknown; cannot confirm kosher status" },
      { protocolId: "halal", risk: "unknown", reason: "Source animal and slaughter method unknown; cannot confirm halal status" },
    ],
    confidence: "medium",
    failClosedProtocols: ["kosher", "halal"],
  },
  {
    ingredientKey: "pork-broth",
    displayName: "Pork Broth / Pork Stock",
    aliases: ["pork broth", "pork stock", "ham broth", "ham stock", "pork bone broth"],
    source: "animal",
    derivedFrom: ["pork"],
    process: {},
    certification: "none",
    protocolRisk: [
      { protocolId: "kosher", risk: "unsafe", reason: "Pork-derived broth is not kosher" },
      { protocolId: "halal", risk: "unsafe", reason: "Pork-derived broth is haram" },
    ],
    confidence: "high",
    failClosedProtocols: ["kosher", "halal"],
  },

  // ─────────────────────────────────────────────────────────────────
  // ISINGLASS / FINING AGENTS
  // ─────────────────────────────────────────────────────────────────
  {
    ingredientKey: "isinglass",
    displayName: "Isinglass",
    aliases: ["isinglass", "fish bladder", "fining agent"],
    source: "animal",
    derivedFrom: ["fish bladder"],
    process: {},
    certification: "unknown",
    protocolRisk: [
      { protocolId: "kosher", risk: "unknown", reason: "Fish-derived but may not be from a kosher fish species; certification required" },
      { protocolId: "halal", risk: "safe", reason: "Generally considered halal as fish-derived" },
    ],
    confidence: "medium",
    failClosedProtocols: ["kosher"],
  },
];

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ");
}

export function getIngredientIntelligence(ingredientName: string): IngredientIntelligence | null {
  const normalized = normalize(ingredientName);

  for (const entry of INGREDIENT_INTELLIGENCE_STORE) {
    if (normalize(entry.ingredientKey) === normalized) return entry;
    if (entry.aliases.some(alias => normalize(alias) === normalized)) return entry;
    if (entry.aliases.some(alias => normalized.includes(normalize(alias)))) return entry;
  }

  return null;
}

export interface IngredientRiskAssessment {
  ingredientName: string;
  intelligence: IngredientIntelligence | null;
  riskByProtocol: Record<string, RiskLevel>;
  failClosed: boolean;
  reason: string;
}

export function assessIngredientRisk(
  ingredientName: string,
  activeProtocols: string[]
): IngredientRiskAssessment {
  const intelligence = getIngredientIntelligence(ingredientName);

  if (!intelligence) {
    return {
      ingredientName,
      intelligence: null,
      riskByProtocol: {},
      failClosed: false,
      reason: "Not in high-risk database — no intelligence-level check required",
    };
  }

  const riskByProtocol: Record<string, RiskLevel> = {};

  for (const protocol of activeProtocols) {
    const protocolRisk = intelligence.protocolRisk.find(r => r.protocolId === protocol);
    if (protocolRisk) {
      riskByProtocol[protocol] = protocolRisk.risk;
    } else {
      riskByProtocol[protocol] = "safe";
    }
  }

  const failClosed = activeProtocols.some(p =>
    intelligence.failClosedProtocols.includes(p) &&
    (riskByProtocol[p] === "unknown" || riskByProtocol[p] === "unsafe")
  );

  const unsafeProtocols = activeProtocols.filter(p => riskByProtocol[p] === "unsafe");
  const unknownProtocols = activeProtocols.filter(p => riskByProtocol[p] === "unknown" && intelligence.failClosedProtocols.includes(p));

  let reason = "";
  if (unsafeProtocols.length > 0) {
    reason = `${intelligence.displayName} is unsafe for: ${unsafeProtocols.join(", ")}`;
  } else if (unknownProtocols.length > 0) {
    reason = `${intelligence.displayName} has unknown certification for: ${unknownProtocols.join(", ")} — blocked by fail-closed policy`;
  }

  return { ingredientName, intelligence, riskByProtocol, failClosed, reason };
}

export function scanTextForHighRiskIngredients(
  text: string,
  activeProtocols: string[]
): IngredientRiskAssessment[] {
  const normalized = normalize(text);
  const findings: IngredientRiskAssessment[] = [];
  const seen = new Set<string>();

  for (const entry of INGREDIENT_INTELLIGENCE_STORE) {
    if (seen.has(entry.ingredientKey)) continue;

    const matched =
      normalized.includes(normalize(entry.displayName)) ||
      entry.aliases.some(alias => normalized.includes(normalize(alias)));

    if (matched) {
      const assessment = assessIngredientRisk(entry.displayName, activeProtocols);
      if (assessment.failClosed || assessment.riskByProtocol && Object.values(assessment.riskByProtocol).some(r => r === "unsafe")) {
        findings.push(assessment);
        seen.add(entry.ingredientKey);
      }
    }
  }

  return findings;
}
