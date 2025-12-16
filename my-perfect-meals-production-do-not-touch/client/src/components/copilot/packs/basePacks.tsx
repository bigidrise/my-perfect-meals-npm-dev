import React from "react";
import {
  CopilotContextInfo,
  CopilotSuggestion,
  CopilotAction,
} from "../CopilotContext";

const makeAction = (action: CopilotAction): CopilotAction => action;

export const buildBaseSuggestions = (
  ctx: CopilotContextInfo,
): CopilotSuggestion[] => {
  const persona = ctx.persona ?? "default";
  const tags = ctx.tags ?? [];
  const screenId = ctx.screenId ?? "GLOBAL";

  const suggestions: CopilotSuggestion[] = [];

  // GLOBAL DEFAULTS
  suggestions.push(
    {
      id: "global-fix-meal",
      label: "Fix this meal for my goals",
      description: "Adjust portions, macros, and swaps to match your targets.",
      badge: "Smart Adjust",
      emphasis: "high",
      action: makeAction({ type: "run-command", id: "meal.smartAdjust" }),
    },
    {
      id: "global-shopping-list",
      label: "Send ingredients to shopping list",
      description: "Build or update your smart cart with this meal.",
      badge: "Shopping",
      emphasis: "medium",
      action: makeAction({ type: "run-command", id: "shopping.addFromMeal" }),
    },
  );

  // SCREEN-SPECIFIC
  if (screenId === "FRIDGE_RESCUE") {
    suggestions.push(
      {
        id: "fridge-fast-dinner",
        label: "One-pan dinner from what I have",
        description: "10–20 minute one-pan meal using your current items.",
        badge: "Fridge Rescue",
        emphasis: "high",
        action: makeAction({ type: "run-command", id: "fridge.onePanDinner" }),
      },
      {
        id: "fridge-missing-items",
        label: "Show me what I'm missing",
        description: "Highlight 3–5 key ingredients to unlock better meals.",
        badge: "Gap Fix",
        emphasis: "medium",
        action: makeAction({ type: "run-command", id: "fridge.suggestAdds" }),
      },
    );
  }

  if (screenId === "WEEKLY_BOARD") {
    suggestions.push(
      {
        id: "week-fill-gaps",
        label: "Fill my empty slots",
        description: "Auto-fill dinners for the week based on your plan.",
        badge: "Auto-Plan",
        emphasis: "high",
        action: makeAction({ type: "run-command", id: "board.fillEmpty" }),
      },
      {
        id: "week-batch-cook",
        label: "Turn this into a batch-cook plan",
        description: "Group meals into 2–3 cooking sessions.",
        badge: "Batch",
        emphasis: "medium",
        action: makeAction({ type: "run-command", id: "board.batchPlan" }),
      },
    );
  }

  // PERSONA-SPECIFIC OVERLAYS
  if (persona === "diabetic") {
    suggestions.push(
      {
        id: "diabetic-swap-carb",
        label: "Lower my carb load here",
        description: "Swap carb-heavy items for diabetic-safe options.",
        badge: "Diabetic",
        emphasis: "high",
        action: makeAction({ type: "run-command", id: "diabetic.lowerCarb" }),
      },
      {
        id: "diabetic-balance-day",
        label: "Balance my blood sugar for the day",
        description: "Smooth out spikes across breakfast, lunch, and dinner.",
        badge: "Day View",
        emphasis: "medium",
        action: makeAction({
          type: "run-command",
          id: "diabetic.balanceDay",
        }),
      },
    );
  }

  if (persona === "glp1") {
    suggestions.push(
      {
        id: "glp1-volume",
        label: "Increase fullness without calories",
        description: "Boost veggies and protein for GLP-1 satiety.",
        badge: "GLP-1",
        emphasis: "high",
        action: makeAction({ type: "run-command", id: "glp1.volumeBoost" }),
      },
      {
        id: "glp1-side-effects",
        label: "Reduce side-effect trigger foods",
        description: "Reduce nausea triggers and heavy fats.",
        badge: "Comfort",
        emphasis: "medium",
        action: makeAction({ type: "run-command", id: "glp1.comfort" }),
      },
    );
  }

  // TAG-BASED MICRO-SUGGESTIONS
  if (tags.includes("one-pan")) {
    suggestions.push({
      id: "tag-one-pan-batch",
      label: "Turn this into a 3-night one-pan rotation",
      description: "Same base ingredients, 3 flavors.",
      badge: "One-Pan",
      emphasis: "medium",
      action: makeAction({ type: "run-command", id: "onePan.rotation" }),
    });
  }

  if (tags.includes("busy")) {
    suggestions.push({
      id: "tag-busy-15",
      label: "Show only 15-minute options",
      description: "Filter meals you can cook between tasks.",
      badge: "Speed Mode",
      emphasis: "medium",
      action: makeAction({ type: "run-command", id: "filters.15Minutes" }),
    });
  }

  return suggestions;
};
