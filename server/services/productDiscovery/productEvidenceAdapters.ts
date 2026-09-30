import type {
  ApprovedProductEvidenceSource,
  ProductCandidate,
  ProductFact,
  ProductFactKind,
  ProductSearchIntent,
} from "../../../shared/productCandidateContract";

export interface ProductResearchStep {
  source: "usda_branded" | "open_food_facts";
  result: "matched" | "unavailable" | "not_found" | "identity_mismatch" | "evidence_conflict" | "skipped";
  phase?: "search" | "detail" | "barcode_lookup";
}

/**
 * Adapter input is an original source record read by a server-owned provider.
 * It is not an AI extraction or user-entered assertion. Provider network
 * integrations stay behind this interface and retain their source records.
 */
export interface SourceProductRecord {
  source: ApprovedProductEvidenceSource;
  sourceRecordId: string;
  sourceVersion?: string;
  observedAt: string | null;
  retrievedAt: string;
  market?: string;
  name: string;
  brand: string;
  variant: string;
  packageSize?: string;
  servingDescription?: string;
  barcode?: string;
  /** Source-asserted match; never infer exactness from a similar title. */
  exactVariantMatch: boolean;
  research?: readonly ProductResearchStep[];
  /** Only an independently reviewed current label can set these. */
  labelReview?: {
    completenessConfirmed: boolean;
    captureConfidence: "high" | "low" | "unknown";
  };
  facts: readonly {
    kind: ProductFactKind;
    target?: string;
    originalStatement: string;
    completeness: ProductFact["completeness"];
    precautionaryStatus?: ProductFact["precautionaryStatus"];
    nutritionMeasurement?: ProductFact["nutritionMeasurement"];
    observedAt?: string | null;
    /** Cross-source facts are allowed only for the same GTIN and market. */
    supplementalProvenance?: {
      source: "open_food_facts";
      sourceRecordId: string;
      barcode: string;
      market: string;
      observedAt: string | null;
      retrievedAt: string;
    };
  }[];
}

export interface ProductEvidenceReference {
  source: ApprovedProductEvidenceSource;
  sourceRecordId: string;
}

export interface ProductEvidencePage {
  references: readonly ProductEvidenceReference[];
  nextCursor: string | null;
}

export interface ProductEvidenceAdapter {
  source: ApprovedProductEvidenceSource;
  search(intent: ProductSearchIntent, cursor: string | null, limit: number): Promise<ProductEvidencePage>;
  read(reference: ProductEvidenceReference): Promise<SourceProductRecord>;
  /** Optional bounded exact-identity research after known conflicts are removed. */
  enrich?(reference: ProductEvidenceReference, record: SourceProductRecord): Promise<SourceProductRecord>;
}

export function canonicalGtin(value: string): string | null {
  if (!/^\d{8,14}$/.test(value)) return null;
  return value.padStart(14, "0");
}

/**
 * The existing barcode service's `verified: true` denotes a macro lookup,
 * not verified ingredients, label, formulation or person-specific suitability.
 * It can supply a search lead only; never convert it into a ProductFact.
 */
export function legacyBarcodeIdentityLead(lookup: {
  barcode?: string;
  name: string;
  brand?: string;
  verified: boolean;
}): {
  barcode: string | null;
  name: string;
  brand: string | null;
  evidenceStatus: "identity_lead_only";
} {
  return {
    barcode: lookup.barcode?.trim() || null,
    name: lookup.name,
    brand: lookup.brand?.trim() || null,
    evidenceStatus: "identity_lead_only",
  };
}

/**
 * Source-record identifiers are deliberately not treated as package variants.
 * Missing market/variant/barcode for catalog records leaves identity uncertain.
 * Retrieval time never substitutes for an unknown formulation observation time.
 */
export function normalizeProductEvidence(record: SourceProductRecord): ProductCandidate {
  const source = record.source;
  if (!["usda_branded", "open_food_facts", "manufacturer", "current_package_label"].includes(source) ||
      !record.sourceRecordId.trim() || !Number.isFinite(Date.parse(record.retrievedAt))) {
    throw new Error("A server-owned source and traceable retrieval are required.");
  }
  const barcode = record.barcode?.trim() || undefined;
  const exact = record.exactVariantMatch && !!record.name.trim() &&
    !!record.brand.trim() && !!record.variant.trim() && !!record.market?.trim() &&
    (source === "current_package_label" || !!barcode);
  const key = [
    source, record.sourceRecordId.trim(), record.market?.trim() || "unknown-market",
    barcode || "unknown-barcode", record.variant.trim() || "unknown-variant",
    record.packageSize?.trim() || "unknown-size",
  ].map((part) => encodeURIComponent(part)).join(":");
  const provenance = {
    source,
    sourceRecordId: record.sourceRecordId,
    sourceVersion: record.sourceVersion,
    observedAt: record.observedAt ?? "",
    retrievedAt: record.retrievedAt,
    market: record.market,
    identityKey: key,
    barcode,
    exactVariantMatch: exact,
    // A model/OCR pass may not silently mark a scan as reviewed.
    labelCompletenessConfirmed: source === "current_package_label"
      ? record.labelReview?.completenessConfirmed === true : undefined,
    captureConfidence: source === "current_package_label"
      ? record.labelReview?.captureConfidence ?? "unknown" : undefined,
  } as const;
  const primaryGtin = barcode ? canonicalGtin(barcode) : null;
  return {
    identity: {
      key, name: record.name, brand: record.brand, variant: record.variant,
      barcode, market: record.market, packageSize: record.packageSize,
      servingDescription: record.servingDescription,
      match: exact ? "exact_variant" : "uncertain", provenance,
    },
    facts: record.facts.map((fact, index) => {
      const supplemental = fact.supplementalProvenance;
      if (supplemental && (!primaryGtin ||
          canonicalGtin(supplemental.barcode) !== primaryGtin ||
          supplemental.market.trim().toLowerCase() !== record.market?.trim().toLowerCase() ||
          !supplemental.sourceRecordId.trim() ||
          !Number.isFinite(Date.parse(supplemental.retrievedAt)))) {
        throw new Error("Supplemental facts must match the exact GTIN and market.");
      }
      if (fact.nutritionMeasurement &&
          (!Number.isFinite(fact.nutritionMeasurement.value) ||
            !fact.nutritionMeasurement.unit.trim() ||
            (fact.nutritionMeasurement.basis === "per_serving" &&
              !fact.nutritionMeasurement.servingSize?.trim()))) {
        throw new Error("Nutrition evidence must retain its actual measurement basis.");
      }
      if (fact.kind === "nutrition" && fact.target &&
          ((fact.target.endsWith("_per_serving") &&
              fact.nutritionMeasurement?.basis !== "per_serving") ||
            (fact.target.endsWith("_per_100g") &&
              fact.nutritionMeasurement?.basis !== "per_100g"))) {
        throw new Error("Nutrition target and source serving basis disagree.");
      }
      return {
        id: `${key}:fact:${index}`,
        kind: fact.kind, target: fact.target,
        statement: fact.originalStatement,
        completeness: fact.completeness,
        precautionaryStatus: fact.precautionaryStatus,
        nutritionMeasurement: fact.nutritionMeasurement,
        provenance: {
          ...provenance,
          ...(supplemental ?? {}),
          // Facts from another catalog retain their own source and observation
          // date, but are bound to this exact, independently checked identity.
          identityKey: key,
          exactVariantMatch: exact,
          observedAt: fact.observedAt ?? record.observedAt ?? "",
          ...(supplemental ? { observedAt: supplemental.observedAt ?? "" } : {}),
        },
      };
    }),
    research: record.research,
  };
}