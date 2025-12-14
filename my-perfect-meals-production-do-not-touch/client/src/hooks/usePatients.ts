import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PatientSummary, GuardrailAuditRow, Guardrails } from "../../../shared/diabetes-schema";
import type { GLP1Guardrails } from "../../../shared/glp1-schema";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface PatientSummaryExtended extends PatientSummary {
  diabetesGuardrails?: Guardrails | null;
  diabetesType?: string | null;
  diabetesA1c?: string | null;
  glp1Guardrails?: GLP1Guardrails | null;
  lastShot?: string | null;
  clinicianRole?: string | null;
}

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: () => fetchApi("/api/patients") as Promise<PatientSummaryExtended[]>,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function usePatient(patientId: string) {
  return useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => fetchApi(`/api/patients/${patientId}`) as Promise<{
      profile: { guardrails?: Guardrails | null } | null;
      guardrails: Guardrails | null;
      diabetesType: string | null;
      diabetesA1c: string | null;
      diabetesMedications: { name: string; dose?: string }[] | null;
      glucose: { value: number; context: string; at: string }[];
      glp1Profile: { guardrails?: GLP1Guardrails | null } | null;
      glp1Guardrails: GLP1Guardrails | null;
      lastShot: string | null;
      clinicianRole: string | null;
    }>,
    enabled: !!patientId,
  });
}

export function useUpdatePatientGuardrails(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (guardrails: Guardrails) => {
      await fetchApi(`/api/patients/${patientId}/guardrails`, {
        method: "PUT",
        body: JSON.stringify({ guardrails }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
    },
  });
}

export function usePatientAudit(patientId: string) {
  return useQuery({
    queryKey: ["patient-audit", patientId],
    queryFn: () => fetchApi(`/api/patients/${patientId}/audit`) as Promise<GuardrailAuditRow[]>,
    enabled: !!patientId,
  });
}