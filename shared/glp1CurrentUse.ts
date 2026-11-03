export const MEMBER_GLP1_EVIDENCE = "member_reported_current_glp1_use";

export interface GLP1CurrentUseStatus {
  memberReportedCurrentUse: boolean;
  physicianManaged: boolean;
  otherMedicationActive: boolean;
  builderActive: boolean;
  effectiveActive: boolean;
}
