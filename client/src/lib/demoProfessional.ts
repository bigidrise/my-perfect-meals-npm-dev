import { apiRequest } from "./queryClient";
import { DEMO_ACKNOWLEDGMENT_VERSION, type DemoContext, type DemoPatient, type DemoPlan } from "@shared/demoProfessional";
const root = "/api/demo-professional";
function patientPath(workspaceId: string, patientId: string) {
  return `${root}/workspaces/${encodeURIComponent(workspaceId)}/patients/${encodeURIComponent(patientId)}`;
}
export const getDemoContext = () => apiRequest<DemoContext>(`${root}/context`);
export const acknowledgeDemoOnly = () => apiRequest<{ acknowledged: true }>(`${root}/acknowledgment`, {
  method:"POST", body:JSON.stringify({ version:DEMO_ACKNOWLEDGMENT_VERSION, syntheticOnlyAcknowledged:true }),
});
export const getDemoPatients = (workspaceId: string) => apiRequest<{ patients: Pick<DemoPatient,"id"|"label"|"scenario">[] }>(`${root}/workspaces/${encodeURIComponent(workspaceId)}/patients`);
export const getDemoPatient = (workspaceId: string, patientId: string) => apiRequest<Pick<DemoPatient,"id"|"label"|"scenario"|"glucose"|"plan"|"revision">>(patientPath(workspaceId,patientId));
export const saveDemoPlan = (workspaceId: string, patientId: string, plan: DemoPlan) => apiRequest<{plan:DemoPlan;revision:number}>(`${patientPath(workspaceId,patientId)}/plan`, {method:"PUT",body:JSON.stringify(plan)});
export const getDemoMessages = (workspaceId: string, patientId: string) => apiRequest<{messages:DemoPatient["messages"]}>(`${patientPath(workspaceId,patientId)}/messages`);
export const getDemoMedia = (workspaceId: string, patientId: string) => apiRequest<{media:Pick<DemoPatient["media"][number],"id"|"name"|"contentType">[]}>(`${patientPath(workspaceId,patientId)}/media`);
export const readDemoMedia = (workspaceId: string, patientId: string, mediaId: string) => apiRequest<DemoPatient["media"][number]>(`${patientPath(workspaceId,patientId)}/media/${encodeURIComponent(mediaId)}`);
export const exportDemoPatient = (workspaceId: string, patientId: string) => apiRequest<unknown>(`${patientPath(workspaceId,patientId)}/export`);
