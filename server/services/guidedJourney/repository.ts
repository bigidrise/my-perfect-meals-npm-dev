import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { users, weekBoards } from "../../../shared/schema";
import type { JourneyRepository } from "./service";

/** Bounded history: find an older saved plan without an unbounded JSON scan. */
export const GUIDED_JOURNEY_BOARD_READ_LIMIT = 100;
export const guidedJourneyRepository: JourneyRepository = {
  async readAccount(actorId) {
    const [record] = await db.select({
      onboardingCompletedAt: users.onboardingCompletedAt,
      dailyCalorieTarget: users.dailyCalorieTarget,
      dailyProteinTarget: users.dailyProteinTarget,
      dailyCarbsTarget: users.dailyCarbsTarget,
      dailyFatTarget: users.dailyFatTarget,
      activeBoard: users.activeBoard,
      selectedMealBuilder: users.selectedMealBuilder,
      activeHouseholdProfileId: users.activeHouseholdProfileId,
    }).from(users).where(eq(users.id, actorId)).limit(1);
    return record ?? null;
  },
  async readSavedBoards(actorId, namespace) {
    const records = await db.select({
      weekStartISO: weekBoards.weekStartISO,
      boardJSON: weekBoards.boardJSON,
    }).from(weekBoards).where(and(
      eq(weekBoards.userId, actorId), eq(weekBoards.builderType, namespace),
    )).orderBy(desc(weekBoards.weekStartISO)).limit(GUIDED_JOURNEY_BOARD_READ_LIMIT + 1);
    return {
      records: records.slice(0, GUIDED_JOURNEY_BOARD_READ_LIMIT),
      hasMore: records.length > GUIDED_JOURNEY_BOARD_READ_LIMIT,
    };
  },
};
