import { PROFESSIONAL_BUILDER_MAP, type ProfessionalBuilderKey } from "./professionalBuilderMap";
import { proStore, BuilderType } from "./proData";
import { apiUrl } from "./resolveApiBase";
import { getAuthHeaders } from "./auth";

export interface AssignBuilderParams {
  builderKey: ProfessionalBuilderKey;
  clientId: string;
  clientUserId: string;
  studioId?: string | number | null;
  clientName?: string;
}

export interface AssignBuilderResult {
  success: boolean;
  error?: string;
}

export async function assignBuilderToClient(
  params: AssignBuilderParams,
): Promise<AssignBuilderResult> {
  const { builderKey, clientId, clientUserId, studioId, clientName } = params;

  if (!clientUserId) {
    return {
      success: false,
      error: "This client hasn't connected their account yet.",
    };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    };

    if (studioId) {
      const studioRes = await fetch(
        apiUrl(`/api/studios/${studioId}/clients/${clientUserId}/assign`),
        {
          method: "PATCH",
          headers,
          credentials: "include",
          body: JSON.stringify({ assignedBuilder: builderKey }),
        },
      );
      if (!studioRes.ok) {
        const data = await studioRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to assign builder via studio");
      }
    }

    const proRes = await fetch(apiUrl("/api/pro/assign-builder"), {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ clientId: clientUserId, builder: builderKey }),
    });

    if (!proRes.ok) {
      const data = await proRes.json().catch(() => ({}));
      throw new Error(data.error || "Failed to assign builder");
    }

    const client = proStore.getClient(clientId);
    if (client) {
      proStore.upsertClient({ ...client, assignedBuilder: builderKey as BuilderType });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Assignment failed" };
  }
}

export function getBuilderLabel(builderKey: string): string {
  return PROFESSIONAL_BUILDER_MAP[builderKey as ProfessionalBuilderKey]?.label ?? builderKey;
}
