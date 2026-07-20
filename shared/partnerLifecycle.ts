/**
 * Partner Lifecycle — capability-aware state machine
 * Shared between server (validation) and client (UI rendering).
 *
 * Architecture: Universal milestones apply to every partner.
 * Capability-specific tracks apply only when that capability is in partnerTypes[].
 * Product and Clinical are INACTIVE PLACEHOLDERS — they have no milestone fields yet
 * and must not affect launch readiness or show incomplete steps.
 */

export type PartnerCapability = "referral" | "organization" | "product" | "clinical";

export type MilestoneKey =
  | "accepted"
  | "rewardful_connected"
  | "promo_assigned"
  | "payouts_ready"
  | "campaign_live"
  | "org_activated";

export interface PartnerMilestone {
  key: MilestoneKey;
  label: string;
  description: string;
  /** Which field in partner_records holds the timestamp */
  field: string;
  track: "universal" | PartnerCapability;
  /**
   * implemented=false means no DB field exists yet.
   * These milestones are excluded from readiness calculations entirely.
   */
  implemented: boolean;
  /** Admin action name that marks this milestone complete */
  action: string;
}

export interface PartnerRecordForLifecycle {
  partnerTypes: string[];
  acceptedAt: string | Date | null;
  rewardfulCreatedAt: string | Date | null;
  rewardfulAffiliateId?: string | null;
  promoCode: string | null;
  promoCodeAssignedAt: string | Date | null;
  orgActivatedAt: string | Date | null;
  managedPayoutsAt: string | Date | null;
  campaignActiveAt: string | Date | null;
}

export interface TrackProgress {
  track: "universal" | PartnerCapability;
  label: string;
  active: boolean;
  implemented: boolean;
  milestones: Array<{
    milestone: PartnerMilestone;
    complete: boolean;
    completedAt: string | null;
  }>;
  completedCount: number;
  totalCount: number;
}

export interface LifecycleResult {
  /** All applicable + implemented milestones for this partner's capability set */
  applicableMilestones: PartnerMilestone[];
  /** Milestones that are complete */
  completedMilestones: PartnerMilestone[];
  /** First incomplete milestone — the single next actionable step */
  nextStep: PartnerMilestone | null;
  /** Equal-weighted readiness: completedCount / totalApplicableImplemented */
  readinessPct: number;
  /** Per-track breakdown for non-linear display */
  tracks: TrackProgress[];
  /** Human-readable current status label */
  currentStatusLabel: string;
}

// ─── Milestone definitions ────────────────────────────────────────────────────

const UNIVERSAL_MILESTONES: PartnerMilestone[] = [
  {
    key: "accepted",
    label: "Agreement Accepted",
    description: "Partner agreement signed and partner identity created",
    field: "acceptedAt",
    track: "universal",
    implemented: true,
    action: "approve",
  },
];

const REFERRAL_MILESTONES: PartnerMilestone[] = [
  {
    key: "rewardful_connected",
    label: "Rewardful Connected",
    description: "Affiliate account created in Rewardful and ID stored",
    field: "rewardfulCreatedAt",
    track: "referral",
    implemented: true,
    action: "connect-rewardful",
  },
  {
    key: "promo_assigned",
    label: "Promo Code Assigned",
    description: "Public referral promo code issued and confirmed in Stripe",
    field: "promoCodeAssignedAt",
    track: "referral",
    implemented: true,
    action: "assign-promo",
  },
  {
    key: "payouts_ready",
    label: "Managed Payouts Ready",
    description: "Partner completed payout onboarding; payouts are live",
    field: "managedPayoutsAt",
    track: "referral",
    implemented: true,
    action: "payouts-ready",
  },
  {
    key: "campaign_live",
    label: "Campaign Live",
    description: "Partner is actively referring customers",
    field: "campaignActiveAt",
    track: "referral",
    implemented: true,
    action: "go-live",
  },
];

const ORGANIZATION_MILESTONES: PartnerMilestone[] = [
  {
    key: "org_activated",
    label: "Organization Activated",
    description: "Organization subscription purchased and seats confirmed",
    field: "orgActivatedAt",
    track: "organization",
    implemented: true,
    action: "activate-org",
  },
];

/**
 * PLACEHOLDER — no milestone fields exist in partner_records for product partners yet.
 * These will never appear in readiness calculations until implemented=true.
 */
const PRODUCT_MILESTONES: PartnerMilestone[] = [];

/**
 * PLACEHOLDER — no milestone fields exist in partner_records for clinical partners yet.
 */
const CLINICAL_MILESTONES: PartnerMilestone[] = [];

// ─── Track registry ───────────────────────────────────────────────────────────

const TRACK_LABELS: Record<string, string> = {
  universal: "Partner Foundation",
  referral: "Referral Program",
  organization: "Organization",
  product: "Product Integration",
  clinical: "Clinical Program",
};

function getMilestonesForTrack(track: "universal" | PartnerCapability): PartnerMilestone[] {
  switch (track) {
    case "universal":     return UNIVERSAL_MILESTONES;
    case "referral":      return REFERRAL_MILESTONES;
    case "organization":  return ORGANIZATION_MILESTONES;
    case "product":       return PRODUCT_MILESTONES;
    case "clinical":      return CLINICAL_MILESTONES;
  }
}

// ─── Core computation ─────────────────────────────────────────────────────────

function isComplete(partner: PartnerRecordForLifecycle, field: string): boolean {
  const val = (partner as Record<string, unknown>)[field];
  return val != null && val !== "";
}

function getTimestamp(partner: PartnerRecordForLifecycle, field: string): string | null {
  const val = (partner as Record<string, unknown>)[field];
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

export function computePartnerLifecycle(partner: PartnerRecordForLifecycle): LifecycleResult {
  const capabilities = (partner.partnerTypes ?? []) as PartnerCapability[];

  const activeTracks: Array<"universal" | PartnerCapability> = [
    "universal",
    ...capabilities,
  ];

  // Build per-track progress (including placeholder tracks for display)
  const tracks: TrackProgress[] = activeTracks.map((track) => {
    const milestones = getMilestonesForTrack(track);
    const implemented = milestones.filter((m) => m.implemented);

    return {
      track,
      label: TRACK_LABELS[track] ?? track,
      active: true,
      implemented: implemented.length > 0 || track === "universal",
      milestones: milestones.map((m) => ({
        milestone: m,
        complete: m.implemented ? isComplete(partner, m.field) : false,
        completedAt: m.implemented ? getTimestamp(partner, m.field) : null,
      })),
      completedCount: implemented.filter((m) => isComplete(partner, m.field)).length,
      totalCount: implemented.length,
    };
  });

  // Collect ALL applicable + implemented milestones (ordered: universal first, then caps)
  const applicableMilestones: PartnerMilestone[] = activeTracks.flatMap(getMilestonesForTrack).filter(
    (m) => m.implemented
  );

  const completedMilestones = applicableMilestones.filter((m) => isComplete(partner, m.field));

  // Equal weighting: completed / total implemented applicable
  const total = applicableMilestones.length;
  const completed = completedMilestones.length;
  const readinessPct = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Next step = first incomplete milestone in order
  const nextStep = applicableMilestones.find((m) => !isComplete(partner, m.field)) ?? null;

  // Status label
  let currentStatusLabel = "Prospect";
  if (isComplete(partner, "campaignActiveAt")) currentStatusLabel = "Campaign Live";
  else if (isComplete(partner, "managedPayoutsAt")) currentStatusLabel = "Payouts Ready";
  else if (isComplete(partner, "promoCodeAssignedAt")) currentStatusLabel = "Promo Assigned";
  else if (isComplete(partner, "rewardfulCreatedAt")) currentStatusLabel = "Rewardful Connected";
  else if (isComplete(partner, "orgActivatedAt")) currentStatusLabel = "Org Activated";
  else if (isComplete(partner, "acceptedAt")) currentStatusLabel = "Agreement Signed";

  return {
    applicableMilestones,
    completedMilestones,
    nextStep,
    readinessPct,
    tracks,
    currentStatusLabel,
  };
}

/**
 * READINESS FORMULA (documented for auditability):
 *
 * readinessPct = floor( completedImplementedMilestones / totalImplementedApplicableMilestones * 100 )
 *
 * "Applicable" = milestones whose track is in this partner's partnerTypes[] (plus universal)
 * "Implemented" = milestones with implemented=true (Product/Clinical excluded until real fields added)
 * Equal weighting — every milestone counts the same.
 *
 * Example — Brian (referral + organization, 6 applicable):
 *   Universal(1) + Referral(4) + Organization(1) = 6 total
 *   Accepted ✓ + Rewardful ✓ + Org Activated ✓ = 3 complete
 *   Readiness = 3/6 = 50%
 */
