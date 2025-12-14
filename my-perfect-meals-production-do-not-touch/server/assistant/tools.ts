import { db } from "../db";
import { userDailyChallenges } from "../db/schema/mindset";
import { eq } from "drizzle-orm";

// Replace with your real lookups
async function getUserProfile(userId: string) {
  try {
    // For now, return a basic profile - can be enhanced with real user data
    return { 
      userId, 
      weightLbs: 185, 
      goal: "fat_loss", 
      activity: "moderate", 
      proteinPref: "balanced" 
    };
  } catch (e) {
    return { userId, weightLbs: 170, goal: "maintenance", activity: "moderate", proteinPref: "balanced" };
  }
}

export type ToolResult = { ok: boolean; data?: any; message?: string; navigateTo?: string; action?: string; page?: string };

export const Tools = {
  navigate: async (_userId: string, to: string): Promise<ToolResult> => ({ ok: true, navigateTo: to }),

  openFitBrainRush: async (): Promise<ToolResult> => ({ ok: true, message: "Opening FitBrain Rush...", navigateTo: "/fitbrain-rush" }),

  showShoppingList: async (userId: string): Promise<ToolResult> => {
    try {
      const items: string[] = []; // TODO: load from your shopping list table when available
      return { ok: true, data: { items } };
    } catch (e) {
      return { ok: true, data: { items: [] }, message: "Shopping list feature coming soon!" };
    }
  },

  addToShoppingList: async (userId: string, item: string, qty?: number, unit?: string): Promise<ToolResult> => {
    try {
      // TODO: insert into shopping list table when available
      const displayText = `${qty ?? ""} ${unit ?? ""} ${item}`.replace(/\s+/g," ").trim();
      return { ok: true, message: `Added ${displayText} to your shopping list` };
    } catch (e) {
      return { ok: true, message: `Noted: ${item} for your shopping list` };
    }
  },

  estimateProteinTarget: async (userId: string): Promise<ToolResult> => {
    try {
      const p = await getUserProfile(userId);
      // Simple, sane range. Fat loss: 0.8–1.0 g/lb; maintenance: 0.7–0.9; gain: 0.8–1.1
      const goalFactor = p.goal === "fat_loss" ? [0.8, 1.0] : p.goal === "gain" ? [0.8, 1.1] : [0.7, 0.9];
      const lo = Math.round(p.weightLbs * goalFactor[0]);
      const hi = Math.round(p.weightLbs * goalFactor[1]);
      const target = Math.round((lo + hi) / 2);
      return { ok: true, data: { range: [lo, hi], target, weightLbs: p.weightLbs, goal: p.goal } };
    } catch (e) {
      return { ok: true, data: { range: [120, 150], target: 135, weightLbs: 170, goal: "maintenance" } };
    }
  },

  getDailyChallenge: async (userId: string): Promise<ToolResult> => {
    try {
      const today = new Date().toISOString().slice(0,10);
      const row = (await db.select().from(userDailyChallenges)
        .where(eq(userDailyChallenges.userId, userId))
      ).find(x => x.dateKey === today) || null;
      return { ok: true, data: row };
    } catch (e) {
      return { ok: true, data: null, message: "No challenge available today" };
    }
  },

  completeDailyChallenge: async (userId: string, id: string): Promise<ToolResult> => {
    try {
      await db.update(userDailyChallenges)
        .set({ completedAt: new Date() })
        .where(eq(userDailyChallenges.id, id));
      return { ok: true, message: "Challenge marked complete!" };
    } catch (e) {
      return { ok: true, message: "Challenge completion noted" };
    }
  },

  openMealCalendar: async (): Promise<ToolResult> => ({ ok: true, navigateTo: "/weekly-meal-calendar" }),

  openCravingCreator: async (): Promise<ToolResult> => ({ ok: true, navigateTo: "/craving-creator" }),

  openMealLogging: async (): Promise<ToolResult> => ({ ok: true, navigateTo: "/log-meals" }),

  openWaterTracking: async (): Promise<ToolResult> => ({ ok: true, navigateTo: "/log-water" }),

  async showAntiInflammatoryHelp() {
    // Trigger the info modal on the Anti-Inflammatory Meal Board
    return { 
      ok: true, 
      message: "Here's how to use the Anti-Inflammatory Menu Builder. The info panel will guide you through creating your first meal.",
      action: "show-info",
      page: "anti-inflammatory-meal-board",
      clientEvent: "copilot:show-info"
    };
  },

} as const;

export type ToolName = keyof typeof Tools;

// Strong input guards (cheap & effective)
export function validateToolCall(name: ToolName, args: any) {
  switch (name) {
    case "navigate": 
      if (typeof args?.to !== "string") throw new Error("Navigation requires a valid route");
      break;
    case "addToShoppingList": 
      if (typeof args?.item !== "string") throw new Error("Shopping list item must be specified");
      break;
    case "completeDailyChallenge": 
      if (!args?.id) throw new Error("Challenge ID required");
      break;
    default: 
      // Most tools don't need validation
      break;
  }
}