import { z } from "zod";

export const professionalCredentialDecision = z.object({
  revision: z.number().int().min(0),
  reviewedCredentialHash: z.string().regex(/^[a-f0-9]{64}$/),
  approvalEventId: z.string().uuid(),
  decision: z.enum(["verified", "rejected", "pending"]),
  verificationBasis: z.string().trim().min(10).max(2000),
  checkedAt: z.string().datetime({ offset: true }).optional(),
  validUntil: z.string().datetime({ offset: true }).optional(),
  independentVerificationAcknowledged: z.literal(true),
}).strict().superRefine((value, context) => {
  if (value.decision === "verified" && (!value.checkedAt || !value.validUntil)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Verified credentials require the actual check time and evidence validity end." });
  }
});
export type ProfessionalCredentialDecision = z.infer<typeof professionalCredentialDecision>;
export interface CredentialReviewStatus {
  status: "verified" | "rejected" | "pending" | "stale" | "legacy" | "not_eligible" | "demo_only";
  required: boolean;
  reviewedCredentialHash: string;
  approvalEventId: string | null;
  revision: number;
  selfReview?: boolean;
  evidence: {
    accountRole: string | null;
    accountCredentials: Record<string, string | null>;
    approvedClaims: Record<string, string | null>;
  };
  latestDecision: {
    decision: string; reviewerId: string; decidedAt: string;
    verificationBasis: string | null; checkedAt: string | null; validUntil: string | null;
  } | null;
}
