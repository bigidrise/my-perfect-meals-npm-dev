import { APPROVED_IMAGE_MODEL } from "./imageModelRegistry";

export interface ModelMetadata { id: string; shutdown_date?: string | null }
export interface ModelLifecycleReview {
  model: string;
  shutdownDate: string | null;
  state: "unknown" | "scheduled" | "retired";
  daysRemaining: number | null;
}

/** Explicitly invoked only. No timers, notifications, startup hooks or generation.
 * Client injection supports official OpenAI models.retrieve without importing app services.
 */
export async function inspectImageModelLifecycle(
  client: { models: { retrieve: (id: string) => Promise<unknown> } },
  now = new Date(),
): Promise<ModelLifecycleReview> {
  return inspectModelLifecycle(client, APPROVED_IMAGE_MODEL.model, now);
}

export async function inspectModelLifecycle(
  client: { models: { retrieve: (id: string) => Promise<unknown> } },
  model: string, now = new Date(),
): Promise<ModelLifecycleReview> {
  const metadata = await client.models.retrieve(model) as ModelMetadata;
  if (metadata?.id !== model) throw new Error("Image model metadata identity mismatch");
  const date = metadata.shutdown_date;
  if (date == null) return { model: metadata.id, shutdownDate: null, state: "unknown", daysRemaining: null };
  const parsed = new Date(`${date}T00:00:00Z`);
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Invalid model shutdown_date");
  }
  const days = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`)) / 86400000);
  return { model: metadata.id, shutdownDate: date, state: days <= 0 ? "retired" : "scheduled", daysRemaining: days };
}
