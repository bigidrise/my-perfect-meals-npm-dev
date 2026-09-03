// 🔒 LOCKED FEATURE - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// Feature: Glycemic Settings Service | Locked: 20250108-1925 | Status: DATABASE PERSISTENCE COMPLETE
// User Warning: "I'm gonna be pissed off" if this gets messed up later
// Core service handling all glycemic data persistence with foreign key constraints resolved

// ✅ Service Layer: Load/Save Glycemic Settings
// server/services/glycemicSettingsService.ts

import { db } from "../db";
import { userGlycemicSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";

export async function saveGlycemicSettings(settings: {
  userId: string,
  bloodGlucose?: number,
  preferredCarbs: string[],
  lowRangeCarbs?: string[],
  midRangeCarbs?: string[],
  highRangeCarbs?: string[],
  defaultPortion: number
}) {
  const {
    userId, bloodGlucose, preferredCarbs, defaultPortion,
    lowRangeCarbs = [], midRangeCarbs = [], highRangeCarbs = [],
  } = settings;
  // Convert portion from cups to integer (1.0 cups = 100)
  const portionAsInt = Math.round(defaultPortion * 100);

  const existing = await db
    .select()
    .from(userGlycemicSettings)
    .where(eq(userGlycemicSettings.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userGlycemicSettings)
      .set({
        bloodGlucose,
        preferredCarbs,
        lowRangeCarbs,
        midRangeCarbs,
        highRangeCarbs,
        defaultPortion: portionAsInt,
        updatedAt: new Date(),
      })
      .where(eq(userGlycemicSettings.userId, userId));
  } else {
    await db.insert(userGlycemicSettings).values({
      userId,
      bloodGlucose,
      preferredCarbs,
      lowRangeCarbs,
      midRangeCarbs,
      highRangeCarbs,
      defaultPortion: portionAsInt,
    });
  }
}

export async function getGlycemicSettings(userId: string) {
  const result = await db
    .select()
    .from(userGlycemicSettings)
    .where(eq(userGlycemicSettings.userId, userId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const settings = result[0];

  // Convert portion back from integer to decimal (100 = 1.0 cups)
  return {
    ...settings,
    defaultPortion: settings.defaultPortion ? settings.defaultPortion / 100 : 1.0,
    lowRangeCarbs: settings.lowRangeCarbs ?? [],
    midRangeCarbs: settings.midRangeCarbs ?? [],
    highRangeCarbs: settings.highRangeCarbs ?? [],
  };
}

// Resolves the correct preferred carb list based on current glucose state.
// Falls back to preferredCarbs (legacy flat list) if the range-specific list is empty.
export function resolvePreferredCarbsByState(
  glucoseState: "low" | "low-normal" | "in-range" | "elevated" | "high-risk" | undefined,
  settings: {
    preferredCarbs?: string[];
    lowRangeCarbs?: string[];
    midRangeCarbs?: string[];
    highRangeCarbs?: string[];
  }
): string[] {
  const { preferredCarbs = [], lowRangeCarbs = [], midRangeCarbs = [], highRangeCarbs = [] } = settings;

  switch (glucoseState) {
    case "low":
    case "low-normal":
      return lowRangeCarbs.length > 0 ? lowRangeCarbs : preferredCarbs;
    case "in-range":
      return midRangeCarbs.length > 0 ? midRangeCarbs : preferredCarbs;
    case "elevated":
    case "high-risk":
      return highRangeCarbs.length > 0 ? highRangeCarbs : preferredCarbs;
    default:
      return preferredCarbs;
  }
}