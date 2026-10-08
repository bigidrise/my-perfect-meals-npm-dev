import { z } from "zod";
import { CANONICAL_PRACTITIONER_ROLES, isClinicalPractitionerRole } from "./professionalRoles";

// Request metadata only. None of these values establish account authority.
export const professionalDraftFields = z.object({
  requestedRole: z.enum(CANONICAL_PRACTITIONER_ROLES).nullable().optional(),
  professionalCategory: z.enum(["certified", "experienced", "non_certified"]).nullable().optional(),
  credentialType: z.string().trim().max(120).nullable().optional(),
  credentialBody: z.string().trim().max(120).nullable().optional(),
  credentialNumber: z.string().trim().max(120).nullable().optional(),
  credentialYear: z.string().trim().max(4).regex(/^$|^\d{4}$/).nullable().optional(),
});
export const updateProfessionalDraft = professionalDraftFields.extend({
  revision: z.number().int().min(0),
  requestId: z.string().uuid().optional(),
}).strict();
export const submitProfessionalDraft = z.object({
  revision: z.number().int().min(0),
  requestId: z.string().uuid().optional(),
}).strict();
export const completeProfessionalDraft = professionalDraftFields.extend({
  requestedRole: z.enum(CANONICAL_PRACTITIONER_ROLES),
  professionalCategory: z.enum(["certified", "experienced", "non_certified"]),
}).superRefine((value, context) => {
  if (isClinicalPractitionerRole(value.requestedRole)) {
    if (value.professionalCategory !== "certified") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["professionalCategory"], message: "Licensed-role requests require the certified/licensed information category." });
    }
    for (const key of ["credentialNumber", "credentialBody"] as const) {
      if (!value[key]?.trim()) context.addIssue({
        code: z.ZodIssueCode.custom, path: [key], message: "License number and issuing state/body are required to submit this request. They are not verified by submission.",
      });
    }
  }
});

export type ProfessionalDraftFields = z.infer<typeof professionalDraftFields>;
export interface ProfessionalIdentityRequest extends Required<ProfessionalDraftFields> {
  id: string;
  ownerUserId: string;
  state: "draft" | "submitted" | "approved" | "rejected" | "needs_correction";
  revision: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  decisionReason?: string | null;
  decidedAt?: string | null;
}

export const professionalIdentityDecision = z.object({
  revision: z.number().int().min(0),
  reviewedStateHash: z.string().regex(/^[a-f0-9]{64}$/),
  decision: z.enum(["approve", "reject", "needs_correction"]),
  approvedRole: z.enum(CANONICAL_PRACTITIONER_ROLES).optional(),
  reason: z.string().trim().min(5).max(1000),
  recovery: z.boolean().default(false),
  identityOnlyAcknowledged: z.literal(true),
  sharedDataAcknowledged: z.literal(true),
}).strict();
export type ProfessionalIdentityDecision = z.infer<typeof professionalIdentityDecision>;
export type ProfessionalLifecycleEvent = "draft_created" | "draft_updated" | "request_submitted" | "correction_resumed";

export interface ProfessionalReadinessCheck {
  status: "ready" | "blocked" | "unavailable" | "not_applicable" | "not_evaluated";
  code: string;
}
export interface ProfessionalReadiness {
  scope: "account";
  accountPrerequisitesReady: boolean;
  clientAccessEvaluated: false;
  checks: Record<"identity" | "credentials" | "training" | "agreements" | "entitlement" | "mfa" | "organizationLocation" | "relationshipConsent", ProfessionalReadinessCheck>;
}
export interface ProfessionalOnboardingStatus {
  accountId: string;
  currentAuthorizedRole: string | null;
  request: ProfessionalIdentityRequest | null;
  decisionAvailable: false;
}
