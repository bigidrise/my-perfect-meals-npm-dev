import type { ClientProfile } from "@/lib/proData";

export function resolveVerifiedProClientUserId(
  client: ClientProfile | null | undefined,
  selectedClientId: string | null | undefined,
): string | null {
  if (!client || !selectedClientId || client.id !== selectedClientId) return null;
  const userId = client.clientUserId?.trim() || client.userId?.trim();
  return userId || null;
}

export function isCurrentVerifiedProClientRequest(
  currentUserId: string | null,
  requestedUserId: string,
): boolean {
  return currentUserId === requestedUserId;
}