import type { ServiceBillingStatus } from "./serviceBilling";

export type StudioAccessSource = "personal" | "pilot" | "sponsored" | "internal";

export type StudioAccessState =
  | "inactive"
  | "setup_available"
  | "active"
  | "managed_access"
  | "needs_review";

export interface StudioAccessStatus {
  state: StudioAccessState;
  sources: StudioAccessSource[];
  studioActive: boolean;
  studioReady: boolean;
  authorized: boolean;
  ownsOrganization: boolean;
  setupDestination: string | null;
  billing: ServiceBillingStatus | null;
  canManageRenewal?: boolean;
}

export function isPersonalStudioRenewalEligible(access: StudioAccessStatus): boolean {
  return access.state === "active" &&
    access.studioActive &&
    access.sources.length === 1 &&
    access.sources[0] === "personal" &&
    (access.billing?.state === "active" || access.billing?.state === "ending");
}