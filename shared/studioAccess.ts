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
}