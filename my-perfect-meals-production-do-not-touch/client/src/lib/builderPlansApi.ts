import { apiUrl } from '@/lib/resolveApiBase';
import type { PlanDay, BuilderPlanJSON } from "../../../server/db/schema/builderPlans";

export type { PlanDay, BuilderPlanJSON };

export async function getBuilderPlan(key: string) {
  const r = await fetch(apiUrl(`/api/builders/${key}/plan`));
  if (!r.ok) throw new Error("fetch failed");
  return r.json() as Promise<{ plan: BuilderPlanJSON | null; days: number; updatedAt?: string }>;
}

export async function saveBuilderPlan(key: string, plan: BuilderPlanJSON, days: number) {
  const r = await fetch(apiUrl(`/api/builders/${key}/plan`), {
    method: "PUT", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, days }),
  });
  if (!r.ok) throw new Error("save failed");
  return r.json();
}

export async function patchBuilderPlan(key: string, plan: BuilderPlanJSON) {
  const r = await fetch(apiUrl(`/api/builders/${key}/plan`), {
    method: "PATCH", 
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!r.ok) throw new Error("patch failed");
  return r.json();
}

export async function clearBuilderPlan(key: string) {
  const r = await fetch(apiUrl(`/api/builders/${key}/plan`), { method: "DELETE" });
  if (!r.ok) throw new Error("delete failed");
  return r.json();
}
