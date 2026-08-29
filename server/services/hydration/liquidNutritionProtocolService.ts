import { sql } from "drizzle-orm";
import { db } from "../../db";
import {
  buildLiquidExecutionPlan,
  canActivateLiquidProtocol,
  canHandoffLiquidProtocol,
  getProtocolUnresolvedItems,
  HYDRATION_PROTOCOL_UNRESOLVED_CODES,
  liquidNutritionProtocolInputSchema,
  normalizeProtocolList,
  type HydrationProtocolRecord,
  type HydrationProtocolUnresolvedItem,
  type LiquidNutritionProtocolInput,
} from "@shared/hydration/fourDoor";

type ProtocolRow = Record<string, unknown>;

function jsonArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function unresolvedItems(value: unknown): HydrationProtocolUnresolvedItem[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is HydrationProtocolUnresolvedItem =>
          !!item &&
          typeof item === "object" &&
          typeof (item as { code?: unknown }).code === "string" &&
          HYDRATION_PROTOCOL_UNRESOLVED_CODES.includes(
            (item as { code: HydrationProtocolUnresolvedItem["code"] }).code,
          ) &&
          typeof (item as { label?: unknown }).label === "string",
      )
    : [];
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function executionPlanFromRow(row: ProtocolRow) {
  const plan = row.executionPlan;
  if (plan && typeof plan === "object" && !Array.isArray(plan)) {
    return plan as HydrationProtocolRecord["executionPlan"];
  }
  return buildLiquidExecutionPlan({
    startsOn: String(row.startsOn),
    endsOn: String(row.endsOn),
    allowedCategories: jsonArray(row.allowedCategories),
    restrictedCategories: jsonArray(row.restrictedCategories),
    textureRequirements: jsonArray(row.textureRequirements),
    explicitTimingText: typeof row.explicitTimingText === "string" ? row.explicitTimingText : "",
  });
}

function handoffAllowed(row: ProtocolRow, unresolved: HydrationProtocolUnresolvedItem[]) {
  return canHandoffLiquidProtocol({
    status: row.status as HydrationProtocolRecord["status"],
    source: row.source as HydrationProtocolRecord["source"],
    verificationStatus: row.verificationStatus as HydrationProtocolRecord["verificationStatus"],
    unresolvedItems: unresolved,
  });
}

function mapProtocolRow(row: ProtocolRow): HydrationProtocolRecord {
  const unresolved = unresolvedItems(row.unresolvedItems);
  return {
    id: String(row.id),
    subjectUserId: String(row.subjectUserId),
    reason: String(row.reason),
    protocolType: row.protocolType as HydrationProtocolRecord["protocolType"],
    source: row.source as HydrationProtocolRecord["source"],
    verificationStatus: row.verificationStatus as HydrationProtocolRecord["verificationStatus"],
    originalInstructionText: String(row.originalInstructionText),
    startsOn: String(row.startsOn),
    endsOn: String(row.endsOn),
    reviewOn: row.reviewOn ? String(row.reviewOn) : null,
    allowedCategories: jsonArray(row.allowedCategories),
    restrictedCategories: jsonArray(row.restrictedCategories),
    textureRequirements: jsonArray(row.textureRequirements),
    explicitTimingText: typeof row.explicitTimingText === "string" && row.explicitTimingText.trim()
      ? row.explicitTimingText
      : null,
    unresolvedItems: unresolved,
    executionPlan: executionPlanFromRow(row),
    status: row.status as HydrationProtocolRecord["status"],
    confirmedAt: asIso(row.confirmedAt),
    activatedAt: asIso(row.activatedAt),
    expiredAt: asIso(row.expiredAt),
    createdAt: asIso(row.createdAt) || new Date(0).toISOString(),
    updatedAt: asIso(row.updatedAt) || new Date(0).toISOString(),
    handoffAllowed: handoffAllowed(row, unresolved),
  };
}

async function expireForLocalDate(userId: string, localDate: string) {
  await db.execute(sql`
    UPDATE hydration_hub_liquid_protocols
    SET status = 'expired',
        expired_at = COALESCE(expired_at, now()),
        updated_at = now()
    WHERE user_id = ${userId}
      AND status = 'active'
      AND ends_on < ${localDate}::date
  `);
}

export async function getCurrentLiquidNutritionProtocol(input: {
  userId: string;
  localDate: string;
}): Promise<HydrationProtocolRecord | null> {
  await expireForLocalDate(input.userId, input.localDate);
  const result = await db.execute(sql`
    SELECT
      id,
      user_id AS "subjectUserId",
      reason,
      protocol_type AS "protocolType",
      source,
      verification_status AS "verificationStatus",
      original_instruction_text AS "originalInstructionText",
      starts_on AS "startsOn",
      ends_on AS "endsOn",
      review_on AS "reviewOn",
      allowed_categories AS "allowedCategories",
      restricted_categories AS "restrictedCategories",
      texture_requirements AS "textureRequirements",
      explicit_timing_text AS "explicitTimingText",
      unresolved_items AS "unresolvedItems",
      execution_plan AS "executionPlan",
      status,
      confirmed_at AS "confirmedAt",
      activated_at AS "activatedAt",
      expired_at AS "expiredAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM hydration_hub_liquid_protocols
    WHERE user_id = ${input.userId}
    ORDER BY
      CASE status
        WHEN 'active' THEN 0
        WHEN 'needs_review' THEN 1
        WHEN 'draft' THEN 2
        WHEN 'incomplete' THEN 3
        ELSE 4
      END,
      created_at DESC
    LIMIT 1
  `);
  return result.rows[0] ? mapProtocolRow(result.rows[0] as ProtocolRow) : null;
}

export async function createLiquidNutritionProtocol(input: {
  userId: string;
  values: LiquidNutritionProtocolInput;
}): Promise<HydrationProtocolRecord> {
  const parsed = liquidNutritionProtocolInputSchema.parse(input.values);
  const normalized = {
    ...parsed,
    allowedCategories: normalizeProtocolList(parsed.allowedCategories),
    restrictedCategories: normalizeProtocolList(parsed.restrictedCategories),
    textureRequirements: normalizeProtocolList(parsed.textureRequirements),
    explicitTimingText: parsed.explicitTimingText.trim(),
  };
  const unresolved = getProtocolUnresolvedItems(normalized);
  const executionPlan = buildLiquidExecutionPlan(normalized);
  const status = unresolved.some((item) => item.code !== "TIMING_NOT_STATED")
    ? "needs_review"
    : "draft";

  const result = await db.execute(sql`
    INSERT INTO hydration_hub_liquid_protocols (
      user_id,
      reason,
      protocol_type,
      source,
      verification_status,
      original_instruction_text,
      starts_on,
      ends_on,
      review_on,
      allowed_categories,
      restricted_categories,
      texture_requirements,
      explicit_timing_text,
      unresolved_items,
      execution_plan,
      status
    ) VALUES (
      ${input.userId},
      ${normalized.reason},
      ${normalized.protocolType},
      'user_entered',
      'unverified',
      ${normalized.originalInstructionText},
      ${normalized.startsOn}::date,
      ${normalized.endsOn}::date,
      ${normalized.reviewOn || null}::date,
      ${JSON.stringify(normalized.allowedCategories)}::jsonb,
      ${JSON.stringify(normalized.restrictedCategories)}::jsonb,
      ${JSON.stringify(normalized.textureRequirements)}::jsonb,
      ${normalized.explicitTimingText || null},
      ${JSON.stringify(unresolved)}::jsonb,
      ${JSON.stringify(executionPlan)}::jsonb,
      ${status}
    )
    RETURNING
      id,
      user_id AS "subjectUserId",
      reason,
      protocol_type AS "protocolType",
      source,
      verification_status AS "verificationStatus",
      original_instruction_text AS "originalInstructionText",
      starts_on AS "startsOn",
      ends_on AS "endsOn",
      review_on AS "reviewOn",
      allowed_categories AS "allowedCategories",
      restricted_categories AS "restrictedCategories",
      texture_requirements AS "textureRequirements",
      explicit_timing_text AS "explicitTimingText",
      unresolved_items AS "unresolvedItems",
      execution_plan AS "executionPlan",
      status,
      confirmed_at AS "confirmedAt",
      activated_at AS "activatedAt",
      expired_at AS "expiredAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `);
  return mapProtocolRow(result.rows[0] as ProtocolRow);
}

export async function activateLiquidNutritionProtocol(input: {
  userId: string;
  protocolId: string;
  localDate: string;
}): Promise<
  | { ok: true; protocol: HydrationProtocolRecord }
  | { ok: false; reason: "not_found" | "expired" | "needs_review"; unresolvedItems?: Array<{ code: string; label: string }> }
> {
  await expireForLocalDate(input.userId, input.localDate);
  const current = await db.execute(sql`
    SELECT
      id,
      user_id AS "subjectUserId",
      reason,
      protocol_type AS "protocolType",
      source,
      verification_status AS "verificationStatus",
      original_instruction_text AS "originalInstructionText",
      starts_on AS "startsOn",
      ends_on AS "endsOn",
      review_on AS "reviewOn",
      allowed_categories AS "allowedCategories",
      restricted_categories AS "restrictedCategories",
      texture_requirements AS "textureRequirements",
      explicit_timing_text AS "explicitTimingText",
      unresolved_items AS "unresolvedItems",
    execution_plan AS "executionPlan",
      status,
      confirmed_at AS "confirmedAt",
      activated_at AS "activatedAt",
      expired_at AS "expiredAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM hydration_hub_liquid_protocols
    WHERE id = ${input.protocolId} AND user_id = ${input.userId}
    LIMIT 1
  `);
  const row = current.rows[0] as ProtocolRow | undefined;
  if (!row) return { ok: false, reason: "not_found" };
  if (String(row.endsOn) < input.localDate || row.status === "expired") {
    await db.execute(sql`
      UPDATE hydration_hub_liquid_protocols
      SET status = 'expired', expired_at = COALESCE(expired_at, now()), updated_at = now()
      WHERE id = ${input.protocolId} AND user_id = ${input.userId}
    `);
    return { ok: false, reason: "expired" };
  }
  const unresolved = unresolvedItems(row.unresolvedItems);
  if (!canActivateLiquidProtocol(unresolved)) {
    return { ok: false, reason: "needs_review", unresolvedItems: unresolved };
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE hydration_hub_liquid_protocols
      SET status = 'expired', expired_at = COALESCE(expired_at, now()), updated_at = now()
      WHERE user_id = ${input.userId}
        AND status = 'active'
        AND id <> ${input.protocolId}
    `);
    await tx.execute(sql`
      UPDATE hydration_hub_liquid_protocols
      SET status = 'active', confirmed_at = now(), activated_at = now(), updated_at = now()
      WHERE id = ${input.protocolId} AND user_id = ${input.userId}
    `);
  });

  const activated = await db.execute(sql`
    SELECT
      id,
      user_id AS "subjectUserId",
      reason,
      protocol_type AS "protocolType",
      source,
      verification_status AS "verificationStatus",
      original_instruction_text AS "originalInstructionText",
      starts_on AS "startsOn",
      ends_on AS "endsOn",
      review_on AS "reviewOn",
      allowed_categories AS "allowedCategories",
      restricted_categories AS "restrictedCategories",
      texture_requirements AS "textureRequirements",
      explicit_timing_text AS "explicitTimingText",
      unresolved_items AS "unresolvedItems",
      execution_plan AS "executionPlan",
      status,
      confirmed_at AS "confirmedAt",
      activated_at AS "activatedAt",
      expired_at AS "expiredAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM hydration_hub_liquid_protocols
    WHERE id = ${input.protocolId} AND user_id = ${input.userId}
    LIMIT 1
  `);
  return { ok: true, protocol: mapProtocolRow(activated.rows[0] as ProtocolRow) };
}