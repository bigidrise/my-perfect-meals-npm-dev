import { apiRequest } from "@/lib/queryClient";

export interface WaterLogRow {
  id: string;
  userId: string;
  amountMl: number;
  unit: string;
  intakeTime: string;
  createdAt: string;
}

export interface WaterLogPage {
  items: WaterLogRow[];
  nextCursor?: string;
}

export function waterLogsQueryKey(
  userId: string,
  range: { from: string | null; to: string | null },
) {
  return ["waterLogs", userId, range] as const;
}

export function isWaterHistoryResponseCurrent(
  requestUserId: string,
  currentUserId: string,
) {
  return Boolean(requestUserId) && requestUserId === currentUserId;
}

export async function getWaterLogs(options: {
  from?: string | null;
  to?: string | null;
  limit?: number;
  cursor?: string;
  clientId?: string;
}): Promise<WaterLogPage> {
  const params = new URLSearchParams();
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.clientId) params.set("clientId", options.clientId);

  return apiRequest<WaterLogPage>(`/api/water-logs?${params.toString()}`);
}

export async function createWaterLog(input: {
  amount: number;
  unit?: string;
  intakeTimeISO?: string;
  freeText?: string;
  clientId?: string;
}): Promise<WaterLogRow> {
  return apiRequest<WaterLogRow>("/api/water-logs", {
    method: "POST",
    body: JSON.stringify(input),
  });
}