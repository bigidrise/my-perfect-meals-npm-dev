import type { DemoContext } from "@shared/demoProfessional";
import { isDemoGrantCurrent, isPermanentFounderDemoGrant } from "@shared/demoProfessional";
import type { DevelopmentDashboard } from "@shared/developmentStudio";
import type { ClientProfile } from "./proData";
import { apiRequest } from "./queryClient";

export function authorizedDevelopmentStudio(context: DemoContext, accountId: string): boolean {
  return context.operatingStatus === "demo_only" && context.persona === "physician" &&
    context.grant.userId === accountId && context.grant.authority === "development_founder" &&
    isPermanentFounderDemoGrant(context.grant) && isDemoGrantCurrent(context.grant) &&
    context.workspace.id === context.grant.workspaceId && context.workspace.classification === "synthetic" &&
    context.clinic?.type === "clinic" && context.clinic.syntheticOnly === true &&
    context.realClinicalReadiness === false;
}
export function isOriginalDevelopmentStudioPath(path: string): boolean {
  return ["/demo-physician", "/pro-portal", "/pro/physician", "/care-team", "/care-team/physician",
    "/pro/clients", "/pro/physician-clients"].includes(path) ||
    /^\/pro\/clients\/[a-f0-9-]{36}\/clinician$/i.test(path);
}
export function dashboardPath(workspaceId: string, patientId: string) {
  return `/api/demo-professional/workspaces/${encodeURIComponent(workspaceId)}/patients/${encodeURIComponent(patientId)}/development-dashboard`;
}
export type DevelopmentDashboardResult = { dashboard: DevelopmentDashboard; revision: number };
export const readDevelopmentDashboard = (workspaceId: string, patientId: string) =>
  apiRequest<DevelopmentDashboardResult>(dashboardPath(workspaceId, patientId));
export const writeDevelopmentDashboard = (workspaceId: string, patientId: string, revision: number, dashboard: DevelopmentDashboard) =>
  apiRequest<DevelopmentDashboardResult>(dashboardPath(workspaceId, patientId), {
    method: "PUT", body: JSON.stringify({ revision, dashboard }),
  });
export interface DevelopmentDashboardSource {
  client: ClientProfile;
  dashboard: DevelopmentDashboard;
  save(patch: Partial<DevelopmentDashboard>): Promise<void>;
  notice: import("react").ReactNode;
}
