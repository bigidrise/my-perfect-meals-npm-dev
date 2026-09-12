import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";

export async function persistMealBuilderSelection(
  selectedMealBuilder: string,
  refreshUser: () => Promise<unknown>,
): Promise<void> {
  const response = await fetch(apiUrl("/api/user/meal-builder"), {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ selectedMealBuilder }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "Your meal builder could not be changed.");
  }
  if (result.selectedMealBuilder !== selectedMealBuilder) {
    throw new Error("The server did not confirm the requested meal builder.");
  }
  await refreshUser();
  window.dispatchEvent(new CustomEvent("mpm:builderUpdated"));
}