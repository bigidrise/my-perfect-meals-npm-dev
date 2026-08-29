import { z } from "zod";

export const HYDRATION_DOOR_KEYS = [
  "everyday",
  "athletic",
  "sick_day",
  "liquid_nutrition",
] as const;
export type HydrationDoorKey = (typeof HYDRATION_DOOR_KEYS)[number];

export const HYDRATION_SICK_DAY_ESCALATION_FLAGS = [
  "unable_to_keep_fluids",
  "fainting_or_confusion",
  "trouble_breathing_or_chest_pain",
  "blood",
] as const;

export const HYDRATION_DOOR_DEFINITIONS: ReadonlyArray<{
  key: HydrationDoorKey;
  title: string;
  description: string;
}> = [
  {
    key: "everyday",
    title: "Everyday Hydration",
    description: "Track fluids and find practical ways to make drinking easier.",
  },
  {
    key: "athletic",
    title: "Athletic Hydration",
    description: "Organize hydration around activity without an automatic formula.",
  },
  {
    key: "sick_day",
    title: "Sick-Day Hydration",
    description: "Choose tolerable, low-effort support and know when to seek help.",
  },
  {
    key: "liquid_nutrition",
    title: "Liquid Nutrition Support",
    description: "Organize explicit temporary liquid instructions without filling in the blanks.",
  },
];

export const HYDRATION_PROTOCOL_TYPES = [
  "clear_liquid",
  "full_liquid",
  "modified_liquid",
  "other",
] as const;
export type HydrationProtocolType = (typeof HYDRATION_PROTOCOL_TYPES)[number];

export const HYDRATION_PROTOCOL_SOURCES = [
  "user_entered",
  "professional_workflow",
] as const;
export type HydrationProtocolSource = (typeof HYDRATION_PROTOCOL_SOURCES)[number];

export const HYDRATION_PROTOCOL_STATUSES = [
  "draft",
  "needs_review",
  "active",
  "expired",
  "incomplete",
] as const;
export type HydrationProtocolStatus = (typeof HYDRATION_PROTOCOL_STATUSES)[number];

export const HYDRATION_PROTOCOL_VERIFICATION_STATUSES = [
  "unverified",
  "professionally_verified",
] as const;
export type HydrationProtocolVerificationStatus =
  (typeof HYDRATION_PROTOCOL_VERIFICATION_STATUSES)[number];

export const HYDRATION_PROTOCOL_UNRESOLVED_CODES = [
  "EXPLICIT_ITEM_CATEGORIES_MISSING",
  "CONFLICTING_ITEM_CATEGORIES",
  "TIMING_NOT_STATED",
] as const;
export type HydrationProtocolUnresolvedCode =
  (typeof HYDRATION_PROTOCOL_UNRESOLVED_CODES)[number];

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO local date");

const boundedListSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(30)
  .default([]);

export const liquidNutritionProtocolInputSchema = z
  .object({
    reason: z.string().trim().min(1).max(200),
    protocolType: z.enum(HYDRATION_PROTOCOL_TYPES),
    originalInstructionText: z.string().trim().min(1).max(5000),
    startsOn: localDateSchema,
    endsOn: localDateSchema,
    reviewOn: localDateSchema.nullable().optional().default(null),
    allowedCategories: boundedListSchema,
    restrictedCategories: boundedListSchema,
    textureRequirements: boundedListSchema,
    explicitTimingText: z.string().trim().max(500).optional().default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.startsOn > value.endsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsOn"],
        message: "End date must be on or after the start date",
      });
    }
    if (value.reviewOn && value.reviewOn < value.startsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewOn"],
        message: "Review date must be on or after the start date",
      });
    }
  });

export type LiquidNutritionProtocolInput = z.infer<
  typeof liquidNutritionProtocolInputSchema
>;

export type HydrationProtocolUnresolvedItem = {
  code: HydrationProtocolUnresolvedCode;
  label: string;
};

export type HydrationExecutionPlan = {
  kind: "explicit_instruction_checklist";
  status: "ready" | "needs_clarification";
  days: Array<{
    date: string;
    timing: {
      status: "explicit" | "needs_clarification";
      text: string | null;
    };
    allowedCategories: string[];
    restrictedCategories: string[];
    textureRequirements: string[];
  }>;
  unresolvedItems: HydrationProtocolUnresolvedItem[];
};

export type HydrationProtocolRecord = {
  id: string;
  subjectUserId: string;
  reason: string;
  protocolType: HydrationProtocolType;
  source: HydrationProtocolSource;
  verificationStatus: HydrationProtocolVerificationStatus;
  originalInstructionText: string;
  startsOn: string;
  endsOn: string;
  reviewOn: string | null;
  allowedCategories: string[];
  restrictedCategories: string[];
  textureRequirements: string[];
  explicitTimingText: string | null;
  unresolvedItems: HydrationProtocolUnresolvedItem[];
  executionPlan: HydrationExecutionPlan;
  status: HydrationProtocolStatus;
  confirmedAt: string | null;
  activatedAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  handoffAllowed: boolean;
};

export function normalizeProtocolList(values: readonly string[]): string[] {
  return [...new Set(
    values
      .map((value) => value.trim().replace(/\s+/g, " "))
      .filter(Boolean),
  )].slice(0, 30);
}

export function getProtocolUnresolvedItems(
  input: Pick<
    LiquidNutritionProtocolInput,
    | "allowedCategories"
    | "restrictedCategories"
    | "explicitTimingText"
  >,
): HydrationProtocolUnresolvedItem[] {
  const allowed = new Set(
    normalizeProtocolList(input.allowedCategories).map((value) => value.toLowerCase()),
  );
  const restricted = new Set(
    normalizeProtocolList(input.restrictedCategories).map((value) => value.toLowerCase()),
  );
  const unresolved: HydrationProtocolUnresolvedItem[] = [];
  if (!allowed.size && !restricted.size) {
    unresolved.push({
      code: "EXPLICIT_ITEM_CATEGORIES_MISSING",
      label: "Allowed or restricted categories were not provided.",
    });
  }
  if ([...allowed].some((value) => restricted.has(value))) {
    unresolved.push({
      code: "CONFLICTING_ITEM_CATEGORIES",
      label: "At least one category is both allowed and restricted.",
    });
  }
  if (!input.explicitTimingText.trim()) {
    unresolved.push({
      code: "TIMING_NOT_STATED",
      label: "Timing or frequency was not stated.",
    });
  }
  return unresolved;
}

function shiftLocalDate(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  return shifted.toISOString().slice(0, 10);
}

export function buildLiquidExecutionPlan(
  input: Pick<
    LiquidNutritionProtocolInput,
    | "startsOn"
    | "endsOn"
    | "allowedCategories"
    | "restrictedCategories"
    | "textureRequirements"
    | "explicitTimingText"
  >,
): HydrationExecutionPlan {
  const unresolvedItems = getProtocolUnresolvedItems(input);
  const start = new Date(`${input.startsOn}T12:00:00.000Z`);
  const end = new Date(`${input.endsOn}T12:00:00.000Z`);
  const dayCount = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 86_400_000),
  );
  const allowedCategories = normalizeProtocolList(input.allowedCategories);
  const restrictedCategories = normalizeProtocolList(input.restrictedCategories);
  const textureRequirements = normalizeProtocolList(input.textureRequirements);
  const explicitTimingText = input.explicitTimingText.trim() || null;

  return {
    kind: "explicit_instruction_checklist",
    status: unresolvedItems.some(
      (item) => item.code !== "TIMING_NOT_STATED",
    )
      ? "needs_clarification"
      : explicitTimingText
        ? "ready"
        : "needs_clarification",
    days: Array.from({ length: dayCount + 1 }, (_, index) => ({
      date: shiftLocalDate(input.startsOn, index),
      timing: {
        status: explicitTimingText ? "explicit" : "needs_clarification",
        text: explicitTimingText,
      },
      allowedCategories,
      restrictedCategories,
      textureRequirements,
    })),
    unresolvedItems,
  };
}

export function canActivateLiquidProtocol(
  unresolvedItems: readonly HydrationProtocolUnresolvedItem[],
): boolean {
  return !unresolvedItems.some((item) =>
    item.code === "EXPLICIT_ITEM_CATEGORIES_MISSING" ||
    item.code === "CONFLICTING_ITEM_CATEGORIES",
  );
}

export function sickDayHydrationRequiresEscalation(
  symptoms: readonly string[],
): boolean {
  return symptoms.some((symptom) =>
    HYDRATION_SICK_DAY_ESCALATION_FLAGS.includes(
      symptom as (typeof HYDRATION_SICK_DAY_ESCALATION_FLAGS)[number],
    ),
  );
}

export function canHandoffLiquidProtocol(
  protocol: Pick<
    HydrationProtocolRecord,
    "status" | "source" | "verificationStatus" | "unresolvedItems"
  >,
): boolean {
  return (
    protocol.status === "active" &&
    protocol.source === "professional_workflow" &&
    protocol.verificationStatus === "professionally_verified" &&
    protocol.unresolvedItems.length === 0
  );
}

export function isLiquidProtocolExpired(
  protocol: Pick<HydrationProtocolRecord, "endsOn" | "status">,
  subjectLocalDate: string,
): boolean {
  return protocol.status === "active" && protocol.endsOn < subjectLocalDate;
}