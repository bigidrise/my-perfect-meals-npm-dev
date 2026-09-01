import { getTierForLookupKey, type PlanTier } from "./planFeatures";

export type ConsumerProCareRequiredTier = "pro" | "clinical";
export type ConsumerProCareAccessCode =
  | "PRO_REQUIRED"
  | "CLINICAL_REQUIRED"
  | "UNSUPPORTED_PROVIDER_ROLE";

export type ConsumerProCareAccessDecision =
  | {
      allowed: true;
      relationshipType: "coaching" | "clinical";
      requiredTier: ConsumerProCareRequiredTier;
      consumerTier: PlanTier;
    }
  | {
      allowed: false;
      relationshipType: "coaching" | "clinical" | "unsupported";
      requiredTier: ConsumerProCareRequiredTier | null;
      consumerTier: PlanTier;
      code: ConsumerProCareAccessCode;
      message: string;
    };

const COACHING_PROVIDER_ROLES = new Set(["coach", "trainer"]);
const CLINICAL_PROVIDER_ROLES = new Set([
  "physician",
  "dietitian",
  "nurse_practitioner",
]);

export function evaluateConsumerProCareAccess({
  accessTier,
  planLookupKey,
  providerRole,
  isInternalAccount = false,
}: {
  accessTier: string | null | undefined;
  planLookupKey: string | null | undefined;
  providerRole: string | null | undefined;
  isInternalAccount?: boolean;
}): ConsumerProCareAccessDecision {
  const consumerTier = planLookupKey
    ? getTierForLookupKey(planLookupKey)
    : isInternalAccount && accessTier === "PAID_FULL"
      ? "ultimate"
      : "free";

  const relationshipType = COACHING_PROVIDER_ROLES.has(providerRole ?? "")
    ? "coaching"
    : CLINICAL_PROVIDER_ROLES.has(providerRole ?? "")
      ? "clinical"
      : "unsupported";

  if (relationshipType === "unsupported") {
    return {
      allowed: false,
      relationshipType,
      requiredTier: null,
      consumerTier,
      code: "UNSUPPORTED_PROVIDER_ROLE",
      message: "This professional role is not eligible for consumer ProCare connections.",
    };
  }

  const requiredTier = relationshipType === "coaching" ? "pro" : "clinical";
  const hasPaidAccess = accessTier === "PAID_FULL";
  const hasRequiredPlan =
    relationshipType === "coaching"
      ? consumerTier === "premium" || consumerTier === "ultimate"
      : consumerTier === "ultimate";

  if (!hasPaidAccess || !hasRequiredPlan) {
    const code =
      relationshipType === "coaching" ? "PRO_REQUIRED" : "CLINICAL_REQUIRED";
    return {
      allowed: false,
      relationshipType,
      requiredTier,
      consumerTier,
      code,
      message:
        relationshipType === "coaching"
          ? "A Pro subscription or higher is required to connect with a ProCare coach or trainer."
          : "A Clinical subscription is required to connect with this clinical professional.",
    };
  }

  return {
    allowed: true,
    relationshipType,
    requiredTier,
    consumerTier,
  };
}