export type BillableService = "personal" | "professional" | "organization";

export type ServiceBillingState = "active" | "ending" | "expired" | "needs_review";

/** No Stripe identifiers are included in responses sent to the browser. */
export interface ServiceBillingStatus {
  state: ServiceBillingState;
  paidThrough: string | null;
}

export interface OrganizationAccessEntry {
  name: string;
  state: ServiceBillingState | "managed_access" | "not_active";
  accessSource: "paid" | "pilot" | "organization" | "arrangement" | "unknown";
  paidThrough: string | null;
}

export interface OrganizationAccessStatus {
  organizations: OrganizationAccessEntry[];
}