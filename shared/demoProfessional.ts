import { z } from "zod";

export const DEMO_ACKNOWLEDGMENT_VERSION = "demo-only-v1";
export const DEMO_CAPABILITIES = ["patient.read", "clinical.read", "clinical.write", "messages.read", "media.read", "export"] as const;
export type DemoCapability = typeof DEMO_CAPABILITIES[number];
export const demoPlanInput = z.object({
  nutritionFocus: z.enum(["balanced_meals", "carb_awareness", "hydration_routine"]),
  followupDays: z.number().int().min(1).max(30),
}).strict();
export type DemoPlan = z.infer<typeof demoPlanInput>;
export interface DemoGrant {
  id: string; userId: string; workspaceId: string; persona: "physician"; operatingStatus: "demo_only";
  state: "prepared" | "active" | "revoked"; revision: number; capabilities: DemoCapability[];
  expiresAt: string | null; approverId: string | null; reason: string;
  /** Server-issued authority; never accepted as a client entitlement. */
  authority?: "development_founder" | "founder_admin";
  lifetime?: "permanent_founder";
  clinicId?: string;
  trainingBasis: "academy_evidence" | "demo_only_waiver"; trainingWaiverReason: string | null;
  acknowledgedAt: string | null; acknowledgmentVersion: string | null;
  identityRequestId: string | null;
}
export interface DemoCareInvitation {
  id: string; providerUserId: string; clientUserId: string; workspaceId: string;
  code: string; token: string; expiresAt: string; revokedAt: string | null;
  state: "pending" | "accepted" | "revoked"; acceptedAt: string | null;
  classification: "synthetic";
}
export interface DemoPatient {
  id: string; workspaceId: string; classification: "synthetic" | "live" | null;
  label: string; scenario: string;
  glucose: { id: string; value: number; unit: "mg/dL"; context: "FASTED" | "POST_MEAL_2H"; recordedAt: string }[];
  messages: { id: string; author: string; text: string }[];
  media: { id: string; name: string; contentType: "text/plain"; content: string }[];
  plan: DemoPlan | null; revision: number;
  connectionInvitation?: DemoCareInvitation;
}
export interface DemoWorkspace { id: string; label: string; classification: "synthetic" | "live" | null }
export interface DemoContext {
  operatingStatus: "demo_only"; persona: "physician"; grant: DemoGrant;
  workspace: DemoWorkspace; acknowledgmentRequired: boolean;
  realClinicalReadiness: false; credentialVerificationGranted: false;
  academyCompletionGranted: false; realAgreementsGranted: false; paidSubscriptionGranted: false;
  clinic?: { id: string; name: string; type: "clinic"; syntheticOnly: true };
}
export function isPermanentFounderDemoGrant(grant: DemoGrant): boolean {
  return (grant.authority === "development_founder" ||
    (grant.authority === "founder_admin" && !!grant.clinicId))
    && grant.lifetime === "permanent_founder" && grant.expiresAt === null
    && !!grant.approverId && grant.trainingBasis === "demo_only_waiver"
    && !!grant.trainingWaiverReason;
}
export function isDemoGrantCurrent(grant: DemoGrant, now = Date.now()): boolean {
  if (grant.state !== "active" || grant.persona !== "physician" || grant.operatingStatus !== "demo_only") return false;
  if (isPermanentFounderDemoGrant(grant)) return true;
  return typeof grant.expiresAt === "string" && Number.isFinite(Date.parse(grant.expiresAt))
    && Date.parse(grant.expiresAt) > now;
}
export const demoGrantPreparationInput = z.object({
  targetUserId: z.string().min(1).max(150),
  reviewedStateHash: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().trim().min(5).max(1000),
  expiresAt: z.string().datetime().nullable(),
  lifetime: z.enum(["temporary", "permanent_founder"]).optional(),
  founderAuthorizationAcknowledged: z.literal(true).optional(),
  capabilities: z.array(z.enum(DEMO_CAPABILITIES)).min(1).max(DEMO_CAPABILITIES.length),
  demoTrainingWaiverReason: z.string().trim().min(5).max(500).optional(),
  identityOnlyAcknowledged: z.literal(true), sharedDataAcknowledged: z.literal(true),
}).strict().superRefine((input, ctx) => {
  if (input.lifetime === "permanent_founder") {
    if (input.capabilities.includes("export")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Founder-only demonstration access does not authorize exports." });
    }
    if (input.expiresAt !== null || input.founderAuthorizationAcknowledged !== true || !input.demoTrainingWaiverReason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Permanent founder access requires explicit authorization, a demo-only waiver, and no expiry." });
    }
  } else if (input.expiresAt === null || input.founderAuthorizationAcknowledged !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ordinary demo grants require an explicit expiry." });
  }
});
export type DemoGrantPreparation = z.infer<typeof demoGrantPreparationInput>;
export const demoGrantActivationInput = z.object({
  revision: z.number().int().min(1), identityRequestId: z.string().uuid().nullable().optional(),
  reviewedStateHash: z.string().regex(/^[a-f0-9]{64}$/), reason: z.string().trim().min(5).max(1000),
  identityOnlyAcknowledged: z.literal(true), sharedDataAcknowledged: z.literal(true),
  founderIdentityRecoveryAcknowledged: z.literal(true).optional(),
}).strict().superRefine((input, ctx) => {
  if (input.founderIdentityRecoveryAcknowledged === true && input.identityRequestId !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Founder-only demo recovery must not claim a normal approved physician identity request." });
  }
  if (input.founderIdentityRecoveryAcknowledged !== true && !input.identityRequestId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Normal demo activation requires a genuinely approved physician identity request." });
  }
});
export type DemoGrantActivation = z.infer<typeof demoGrantActivationInput>;
export const demoGrantRevocationInput = z.object({
  revision: z.number().int().min(1), reason: z.string().trim().min(5).max(1000),
  sharedDataAcknowledged: z.literal(true),
}).strict();
