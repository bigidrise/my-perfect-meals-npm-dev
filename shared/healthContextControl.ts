import type { HealthProtocol } from "./healthProtocolState";

export type HealthSupportSource = {
  id: string;
  kind: "you" | "care_team" | "lab_recommendation" | "medication_information" | "earlier_profile" | "suggestion";
  status: "active" | "needs_confirmation" | "previous" | "off";
  note?: string;
};
export type HealthSupportSummary = {
  protocol: HealthProtocol;
  status: "active" | "needs_confirmation" | "previous" | "off";
  personalEnabled: boolean;
  sources: HealthSupportSource[];
};
export type HealthContextView = {
  shadowOnly: true;
  builder: string | null;
  supports: HealthSupportSummary[];
  legacyAntiPreferenceNeedsReview: boolean;
  labReviews: { id: number; protocol: HealthProtocol; earlierDecision: "accepted" | "rejected" }[];
  history: {
    protocol: HealthProtocol;
    source: HealthSupportSource["kind"];
    activity: string;
    occurredAt: string;
  }[];
};