import { isCanonicalPractitionerRole } from "@shared/professionalRoles";
import { apiRequest } from "./queryClient";

export async function professionalAgreementsAreCurrent(role: string): Promise<boolean> {
  if (!isCanonicalPractitionerRole(role)) throw new Error("A professional role is required.");
  const flow = role === "physician" ? "physician" : "professional";
  const [attestation, professional] = await Promise.all([
    apiRequest<{ allAccepted: boolean }>("/api/legal/status?flow=attestation"),
    apiRequest<{ allAccepted: boolean }>(`/api/legal/status?flow=${flow}`),
  ]);
  return attestation?.allAccepted === true && professional?.allAccepted === true;
}
