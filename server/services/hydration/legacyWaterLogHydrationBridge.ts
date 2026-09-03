import crypto from "node:crypto";
import { and, desc, eq, gte, lt, or } from "drizzle-orm";
import { db } from "../../db";
import { waterLogs, type WaterLog } from "@shared/schema";
import { hydrationHistoryQuerySchema } from "@shared/hydration/schemas";
import type {
  HydrationIntakeEvent,
  HydrationUnit,
} from "@shared/hydration/contracts";
import { verifyPhysicianClientAccess } from "../procareAccessService";

const MILLILITERS_PER_UNIT = {
  ml: 1,
  oz: 29.5735295625,
  fl_oz: 29.5735295625,
  cup: 236.5882365,
} as const;

const LEGACY_TIMEZONE = "UTC";

export type LegacyWaterLogRow = Pick<
  WaterLog,
  "id" | "userId" | "amountMl" | "unit" | "intakeTime" | "createdAt"
>;

export type LegacyWaterLogProvenance = Readonly<{
  legacyWaterLogId: string;
  rawOriginalUnit: string;
  originalAmountInterpretation:
    | "exact_ml"
    | "reconstructed_from_normalized_ml"
    | "normalized_ml_only";
  occurredTimezoneInterpretation: "legacy_timestamp_interpreted_as_utc";
  enteredByInterpretation: "legacy_actor_unavailable_subject_used";
}>;

export type LegacyHydrationIntakeProjection = HydrationIntakeEvent &
  Readonly<{
    source: "legacy_manual";
    sourceEventId: string;
    provenance: LegacyWaterLogProvenance;
  }>;

export type LegacyWaterLogCursor = Readonly<{
  intakeTime: Date;
  id: string;
}>;

export type LegacyWaterLogStoreQuery = Readonly<{
  subjectUserId: string;
  from?: Date;
  toExclusive?: Date;
  limit: number;
  cursor?: LegacyWaterLogCursor;
}>;

export interface LegacyWaterLogStore {
  listRows(query: LegacyWaterLogStoreQuery): Promise<LegacyWaterLogRow[]>;
}

export type LegacyHydrationAccessContext = Readonly<{
  authenticatedUserId: string;
  requestedClientId?: unknown;
}>;

export type LegacyHydrationHistoryPage = Readonly<{
  items: LegacyHydrationIntakeProjection[];
  nextCursor?: string;
}>;

export class LegacyWaterLogHydrationBridgeError extends Error {
  constructor(
    public readonly code:
      | "AUTHENTICATION_REQUIRED"
      | "ACCESS_DENIED"
      | "ACCESS_UNAVAILABLE"
      | "INVALID_QUERY"
      | "INVALID_CURSOR"
      | "INVALID_LEGACY_RECORD"
      | "CURSOR_SIGNING_NOT_CONFIGURED",
    message: string,
  ) {
    super(message);
    this.name = "LegacyWaterLogHydrationBridgeError";
  }
}

function asValidDate(value: Date | string, field: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new LegacyWaterLogHydrationBridgeError(
      "INVALID_LEGACY_RECORD",
      `Legacy water log contains an invalid ${field}`,
    );
  }
  return date;
}

function roundToThreeDecimals(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function interpretLegacyUnit(amountMl: number, rawUnit: string): {
  originalAmount: number;
  originalUnit: HydrationUnit;
  interpretation: LegacyWaterLogProvenance["originalAmountInterpretation"];
} {
  const normalized = rawUnit.trim().toLowerCase();
  if (normalized === "ml") {
    return {
      originalAmount: amountMl,
      originalUnit: "ml",
      interpretation: "exact_ml",
    };
  }

  if (
    normalized === "oz" ||
    normalized === "fl oz" ||
    normalized === "fluid ounce" ||
    normalized === "fluid ounces"
  ) {
    return {
      originalAmount: roundToThreeDecimals(
        amountMl / MILLILITERS_PER_UNIT.oz,
      ),
      originalUnit: normalized === "oz" ? "oz" : "fl_oz",
      interpretation: "reconstructed_from_normalized_ml",
    };
  }

  if (normalized === "cup" || normalized === "cups") {
    return {
      originalAmount: roundToThreeDecimals(
        amountMl / MILLILITERS_PER_UNIT.cup,
      ),
      originalUnit: "cup",
      interpretation: "reconstructed_from_normalized_ml",
    };
  }

  return {
    originalAmount: amountMl,
    originalUnit: "ml",
    interpretation: "normalized_ml_only",
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function hashLegacyProjection(input: Record<string, unknown>): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

export function mapLegacyWaterLogToHydrationEvent(
  row: LegacyWaterLogRow,
): LegacyHydrationIntakeProjection {
  if (
    !row.id ||
    !row.userId ||
    !Number.isSafeInteger(row.amountMl) ||
    row.amountMl <= 0 ||
    typeof row.unit !== "string"
  ) {
    throw new LegacyWaterLogHydrationBridgeError(
      "INVALID_LEGACY_RECORD",
      "Legacy water log cannot be represented as a canonical hydration event",
    );
  }

  const occurredAt = asValidDate(row.intakeTime, "intake timestamp");
  const enteredAt = asValidDate(row.createdAt, "creation timestamp");
  const interpreted = interpretLegacyUnit(row.amountMl, row.unit);
  const provenance: LegacyWaterLogProvenance = {
    legacyWaterLogId: row.id,
    rawOriginalUnit: row.unit,
    originalAmountInterpretation: interpreted.interpretation,
    occurredTimezoneInterpretation: "legacy_timestamp_interpreted_as_utc",
    enteredByInterpretation: "legacy_actor_unavailable_subject_used",
  };
  const payloadHash = hashLegacyProjection({
    subjectUserId: row.userId,
    occurredAt: occurredAt.toISOString(),
    volumeMl: row.amountMl,
    originalAmount: interpreted.originalAmount,
    originalUnit: interpreted.originalUnit,
    source: "legacy_manual",
    sourceEventId: row.id,
    provenance,
  });

  return {
    id: row.id,
    subjectUserId: row.userId,
    occurredAt: occurredAt.toISOString(),
    occurredTimezone: LEGACY_TIMEZONE,
    localDate: occurredAt.toISOString().slice(0, 10),
    volumeMl: row.amountMl,
    originalAmount: interpreted.originalAmount,
    originalUnit: interpreted.originalUnit,
    beverageClass: "water",
    source: "legacy_manual",
    sourceEventId: row.id,
    idempotencyKey: row.id,
    payloadHash,
    enteredAt: enteredAt.toISOString(),
    enteredByUserId: row.userId,
    provenance,
  };
}

function cursorSigningKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new LegacyWaterLogHydrationBridgeError(
      "CURSOR_SIGNING_NOT_CONFIGURED",
      "Legacy hydration cursor signing is not configured",
    );
  }
  return Buffer.from(secret, "utf8");
}

function signCursor(payload: string): string {
  return crypto
    .createHmac("sha256", cursorSigningKey())
    .update(payload)
    .digest("base64url");
}

function encodeCursor(
  subjectUserId: string,
  cursor: LegacyWaterLogCursor,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      subjectUserId,
      intakeTime: cursor.intakeTime.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${signCursor(payload)}`;
}

export function decodeLegacyHydrationCursor(
  value: string,
  subjectUserId: string,
): LegacyWaterLogCursor {
  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra) throw new Error("invalid cursor format");
    const expected = Buffer.from(signCursor(payload), "base64url");
    const provided = Buffer.from(signature, "base64url");
    if (
      expected.length !== provided.length ||
      !crypto.timingSafeEqual(expected, provided)
    ) {
      throw new Error("invalid cursor signature");
    }
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { subjectUserId?: unknown; intakeTime?: unknown; id?: unknown };
    if (
      decoded.subjectUserId !== subjectUserId ||
      typeof decoded.intakeTime !== "string" ||
      typeof decoded.id !== "string" ||
      !decoded.id
    ) {
      throw new Error("invalid cursor fields");
    }
    const intakeTime = new Date(decoded.intakeTime);
    if (Number.isNaN(intakeTime.getTime())) throw new Error("invalid cursor date");
    return { intakeTime, id: decoded.id };
  } catch (error) {
    if (
      error instanceof LegacyWaterLogHydrationBridgeError &&
      error.code === "CURSOR_SIGNING_NOT_CONFIGURED"
    ) {
      throw error;
    }
    throw new LegacyWaterLogHydrationBridgeError(
      "INVALID_CURSOR",
      "Invalid legacy hydration history cursor",
    );
  }
}

function utcDateBoundary(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function nextUtcDateBoundary(value: string): Date {
  const date = utcDateBoundary(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

type DelegatedAccessVerifier = (
  professionalUserId: string,
  clientUserId: string,
) => Promise<boolean>;

export class LegacyWaterLogHydrationBridge {
  constructor(
    private readonly store: LegacyWaterLogStore,
    private readonly verifyDelegatedAccess: DelegatedAccessVerifier =
      verifyPhysicianClientAccess,
  ) {}

  private async resolveSubjectUserId(
    context: LegacyHydrationAccessContext,
  ): Promise<string> {
    const authenticatedUserId =
      typeof context?.authenticatedUserId === "string"
        ? context.authenticatedUserId.trim()
        : "";
    if (!authenticatedUserId) {
      throw new LegacyWaterLogHydrationBridgeError(
        "AUTHENTICATION_REQUIRED",
        "Authenticated hydration subject is required",
      );
    }

    const requestedClientId =
      typeof context.requestedClientId === "string"
        ? context.requestedClientId.trim()
        : "";
    if (!requestedClientId || requestedClientId === authenticatedUserId) {
      return authenticatedUserId;
    }

    let hasAccess: boolean;
    try {
      hasAccess = await this.verifyDelegatedAccess(
        authenticatedUserId,
        requestedClientId,
      );
    } catch {
      throw new LegacyWaterLogHydrationBridgeError(
        "ACCESS_UNAVAILABLE",
        "Hydration delegated-access verification failed",
      );
    }
    if (!hasAccess) {
      throw new LegacyWaterLogHydrationBridgeError(
        "ACCESS_DENIED",
        "Not authorized to access this client's hydration history",
      );
    }
    return requestedClientId;
  }

  async listEvents(
    context: LegacyHydrationAccessContext,
    query: unknown = {},
  ): Promise<LegacyHydrationHistoryPage> {
    const subjectUserId = await this.resolveSubjectUserId(context);
    let parsed: ReturnType<typeof hydrationHistoryQuerySchema.parse>;
    try {
      parsed = hydrationHistoryQuerySchema.parse(query);
    } catch (error) {
      throw new LegacyWaterLogHydrationBridgeError(
        "INVALID_QUERY",
        error instanceof Error
          ? error.message
          : "Invalid legacy hydration history query",
      );
    }
    if (parsed.from && parsed.to && parsed.from > parsed.to) {
      throw new LegacyWaterLogHydrationBridgeError(
        "INVALID_QUERY",
        "Hydration history start date must not be after the end date",
      );
    }

    const cursor = parsed.cursor
      ? decodeLegacyHydrationCursor(parsed.cursor, subjectUserId)
      : undefined;
    const rows = await this.store.listRows({
      subjectUserId,
      ...(parsed.from ? { from: utcDateBoundary(parsed.from) } : {}),
      ...(parsed.to ? { toExclusive: nextUtcDateBoundary(parsed.to) } : {}),
      limit: parsed.limit + 1,
      ...(cursor ? { cursor } : {}),
    });
    const hasMore = rows.length > parsed.limit;
    const pageRows = rows.slice(0, parsed.limit);
    const items = pageRows.map(mapLegacyWaterLogToHydrationEvent);

    return {
      items,
      ...(hasMore && pageRows.length > 0
        ? {
            nextCursor: encodeCursor(subjectUserId, {
              intakeTime: asValidDate(
                pageRows[pageRows.length - 1].intakeTime,
                "intake timestamp",
              ),
              id: pageRows[pageRows.length - 1].id,
            }),
          }
        : {}),
    };
  }
}

export class DrizzleLegacyWaterLogStore implements LegacyWaterLogStore {
  constructor(private readonly database: typeof db = db) {}

  async listRows(query: LegacyWaterLogStoreQuery): Promise<LegacyWaterLogRow[]> {
    const conditions = [
      eq(waterLogs.userId, query.subjectUserId),
      ...(query.from ? [gte(waterLogs.intakeTime, query.from)] : []),
      ...(query.toExclusive ? [lt(waterLogs.intakeTime, query.toExclusive)] : []),
    ];
    if (query.cursor) {
      conditions.push(
        or(
          lt(waterLogs.intakeTime, query.cursor.intakeTime),
          and(
            eq(waterLogs.intakeTime, query.cursor.intakeTime),
            lt(waterLogs.id, query.cursor.id),
          ),
        )!,
      );
    }

    return this.database
      .select()
      .from(waterLogs)
      .where(and(...conditions))
      .orderBy(desc(waterLogs.intakeTime), desc(waterLogs.id))
      .limit(query.limit);
  }
}

export const legacyWaterLogHydrationBridge =
  new LegacyWaterLogHydrationBridge(new DrizzleLegacyWaterLogStore());