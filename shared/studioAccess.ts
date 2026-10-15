import type { ServiceBillingStatus } from "./serviceBilling";

export type StudioAccessSource = "personal" | "studio" | "pilot" | "sponsored" | "internal";

export type StudioAccessState =
  | "inactive"
  | "setup_available"
  | "active"
  | "managed_access"
  | "needs_review";

export interface StudioAccessStatus {
  state: StudioAccessState;
  studioId?: string | null;
  sources: StudioAccessSource[];
  studioActive: boolean;
  studioReady: boolean;
  authorized: boolean;
  ownsOrganization: boolean;
  setupDestination: string | null;
  billing: ServiceBillingStatus | null;
  canManageRenewal?: boolean;
  canReconnect?: boolean;
  canStartStudioCheckout?: boolean;
  canDisconnectAddon?: boolean;
  canReconnectAddon?: boolean;
  restriction?: { code: string; message: string };
}

/** A successful metadata request is not Studio authorization. */
export function canEnterStudio(access: Partial<StudioAccessStatus> | null | undefined): boolean {
  return access?.authorized === true && access.studioActive === true &&
    access.studioReady === true &&
    (access.state === "active" || access.state === "managed_access") &&
    !access.restriction;
}

export function isIndependentStudioRenewalEligible(access: StudioAccessStatus): boolean {
  return access.state === "active" &&
    access.studioActive &&
    access.sources.includes("studio") &&
    access.sources.every(source => source === "studio" || source === "personal") &&
    (access.billing?.state === "active" || access.billing?.state === "ending");
}

/** Legacy professional plans on the Personal account are not Studio renewal authority. */
export const isPersonalStudioRenewalEligible = isIndependentStudioRenewalEligible;