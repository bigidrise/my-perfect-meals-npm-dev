import type { UserProtocolEnvelope } from "../protocolEnvelope";
import type { HydrationProtocolRecord } from "@shared/hydration/fourDoor";

export type ConsideredForYouItem = Readonly<{
  key: string;
  label: string;
  status: "applied" | "checked" | "withheld";
}>;

function add(
  items: ConsideredForYouItem[],
  item: ConsideredForYouItem,
  when: boolean,
) {
  if (when && !items.some((entry) => entry.key === item.key)) items.push(item);
}

export function buildHydrationConsideredForYou(input: {
  envelope: UserProtocolEnvelope;
  builder: string | null;
  liquidProtocol?: HydrationProtocolRecord | null;
  glp1Active?: boolean;
}): ConsideredForYouItem[] {
  const { envelope, liquidProtocol } = input;
  const items: ConsideredForYouItem[] = [];
  add(items, { key: "dietary_identity", label: "Saved dietary identity", status: "applied" }, envelope.dietaryIdentity.length > 0);
  add(items, { key: "allergies", label: "Allergies and safety restrictions", status: "applied" }, envelope.allergies.length > 0);
  add(items, { key: "medical_rules", label: "Current medical nutrition rules", status: "applied" }, envelope.medicalHardLimits.length > 0 || envelope.medicalOptimization.length > 0);
  add(items, { key: "glp1", label: "GLP-1 nutrition context", status: "applied" }, Boolean(input.glp1Active));
  add(items, { key: "performance", label: "Performance nutrition context", status: "checked" }, envelope.performanceOverlay !== "standard" || Boolean(envelope.performanceNutrition));
  add(items, { key: "meal_builder", label: "Active meal builder", status: "checked" }, Boolean(input.builder));
  if (liquidProtocol?.status === "active") {
    add(
      items,
      {
        key: "liquid_nutrition",
        label: liquidProtocol.handoffAllowed
          ? "Verified Liquid Nutrition instructions"
          : "Liquid Nutrition instructions need professional verification",
        status: liquidProtocol.handoffAllowed ? "applied" : "withheld",
      },
      true,
    );
  }
  return items;
}

export function buildLiquidNutritionPromptBlock(
  protocol: HydrationProtocolRecord | null | undefined,
): string {
  if (!protocol?.handoffAllowed || protocol.status !== "active") return "";
  return [
    "",
    "VERIFIED TEMPORARY LIQUID NUTRITION INSTRUCTIONS:",
    `- Allowed categories: ${protocol.allowedCategories.join(", ") || "none explicitly supplied"}`,
    `- Restricted categories: ${protocol.restrictedCategories.join(", ") || "none explicitly supplied"}`,
    `- Texture requirements: ${protocol.textureRequirements.join(", ") || "none explicitly supplied"}`,
    `- Explicit timing: ${protocol.explicitTimingText || "not stated"}`,
    "- Treat restrictions as hard limits. Do not infer additional timing, dosing, or progression.",
  ].join("\n");
}

export function validateLiquidNutritionOutput(
  value: unknown,
  protocol: HydrationProtocolRecord | null | undefined,
): { passed: true } | { passed: false; message: string } {
  if (!protocol?.handoffAllowed || protocol.status !== "active") return { passed: true };
  const text = JSON.stringify(value).toLowerCase();
  const blocked = protocol.restrictedCategories.find((term) =>
    text.includes(term.trim().toLowerCase()),
  );
  if (blocked) {
    return {
      passed: false,
      message: `The result included a restricted Liquid Nutrition category: ${blocked}.`,
    };
  }
  if (
    protocol.allowedCategories.length > 0 &&
    !protocol.allowedCategories.some((term) => text.includes(term.trim().toLowerCase()))
  ) {
    return {
      passed: false,
      message: "The result could not be verified against the allowed Liquid Nutrition categories.",
    };
  }
  return { passed: true };
}