/** Content-free diagnostics for the explicitly enabled Development dessert caller. */
export interface DessertDiagnostic {
  stage: "schema" | "comparison" | "candidate" | "completion";
  attempt: number;
  candidateId?: string;
  referenceId?: string;
  outcome?: "accepted" | "rejected" | "valid" | "invalid";
  repairAttempted?: boolean;
  repairSucceeded?: boolean;
  displayDescriptionRecovered?: boolean;
  issues?: { path: string; rule: string; phase: "before" | "after" }[];
  branch?: string;
  evidence?: {
    leftStructure: boolean;
    rightStructure: boolean;
    ingredientOverlap: number;
    samePreparation?: boolean;
    sameCoreBase?: boolean;
    signatureCollision?: boolean;
  };
  acceptedCount?: number;
  rejectedCount?: number;
  candidateCount?: number;
  schemaIssueCount?: number;
  providerFailureCount?: number;
  invalidResponseCount?: number;
  rejectionCounts?: Record<string, number>;
}

export type DessertDiagnosticSink = (event: DessertDiagnostic) => void;

const schemaFields = new Set([
  "concepts", "title", "description", "primaryIngredients", "primaryProtein",
  "produceItems", "cuisine", "dietaryEvidence", "preparationMethod", "signature",
  "snackType", "foodIdentity", "culinaryIdentity", "foodRole", "polarity",
  "formatFamily", "preparationStyle", "texture", "temperature",
  "dishForm", "primaryProteinBase", "majorStarchBase", "flavorFamily",
  "cuisineEvidence", "definingComponents",
]);

/** Never log Zod messages or received values; they can contain generated text. */
export function safeSchemaIssues(
  issues: { path: (string | number)[]; code: string }[],
  phase: "before" | "after",
): NonNullable<DessertDiagnostic["issues"]> {
  return issues.map(issue => ({
    path: issue.path.map(part => typeof part === "number"
      ? String(part) : schemaFields.has(part) ? part : "field").join(".") || "response",
    rule: issue.code,
    phase,
  }));
}
