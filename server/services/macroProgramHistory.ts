import { db } from "../db";
import { macroProgramHistory } from "../../shared/schema";

interface ProgramChangeParams {
  clientUserId: string;
  coachUserId: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  reason?: string | null;
}

export async function logMacroProgramChange(params: ProgramChangeParams) {
  const [row] = await db
    .insert(macroProgramHistory)
    .values({
      clientUserId: params.clientUserId,
      coachUserId: params.coachUserId,
      calories: params.calories,
      proteinG: params.proteinG,
      carbsG: params.carbsG,
      fatG: params.fatG,
      reason: params.reason ?? null,
    })
    .returning();
  return row;
}
