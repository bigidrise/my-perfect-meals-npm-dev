import crypto from "node:crypto";
import { and, desc, eq, gte, lte, lt, or } from "drizzle-orm";
import { db } from "../../db";
import {
  hydrationAuditLog,
  hydrationEventSupersessions,
  hydrationIntakeEvents,
} from "../../db/schema/hydration";
import {
  hydrationHistoryQuerySchema,
  hydrationIntakeEventInputSchema,
  type HydrationIntakeEventInputParsed,
} from "@shared/hydration/schemas";
import type {
  HydrationEventLineageKind,
  HydrationEventSupersession,
  HydrationIntakeEvent,
} from "@shared/hydration/contracts";

const MILLILITERS_PER_UNIT = {
  ml: 1,
  l: 1_000,
  oz: 29.5735295625,
  fl_oz: 29.5735295625,
  cup: 236.5882365,
} as const;

const MAX_POSTGRES_INTEGER = 2_147_483_647;

export type HydrationAuthenticatedContext = Readonly<{
  userId: string;
}>;

export type HydrationEventCursor = Readonly<{
  occurredAt: Date;
  id: string;
}>;

export type HydrationHistoryPage = Readonly<{
  items: HydrationIntakeEvent[];
  nextCursor?: string;
}>;

export type HydrationEventCorrectionInput = Readonly<{
  eventId: string;
  replacement: unknown;
  reasonCode: string;
  correlationId: string;
}>;

export type HydrationEventVoidInput = Readonly<{
  eventId: string;
  reasonCode: string;
  correlationId: string;
}>;

export type HydrationCorrectionResult = Readonly<{
  original: HydrationIntakeEvent;
  successor: HydrationIntakeEvent;
  lineage: HydrationEventSupersession;
}>;

export type HydrationVoidResult = Readonly<{
  event: HydrationIntakeEvent;
  lineage: HydrationEventSupersession;
}>;

export type HydrationCreateEventArgs = Readonly<{
  subjectUserId: string;
  input: HydrationIntakeEventInputParsed;
  occurredAt: Date;
  localDate: string;
  volumeMl: number;
  payloadHash: string;
}>;

export type HydrationHistoryStoreQuery = Readonly<{
  subjectUserId: string;
  from?: string;
  to?: string;
  limit: number;
  cursor?: HydrationEventCursor;
}>;

export interface HydrationIntakeStore {
  createEvent(
    args: HydrationCreateEventArgs,
  ): Promise<{ event: HydrationIntakeEvent; created: boolean }>;
  getEvent(
    subjectUserId: string,
    eventId: string,
  ): Promise<HydrationIntakeEvent | null>;
  listEvents(
    query: HydrationHistoryStoreQuery,
  ): Promise<{ items: HydrationIntakeEvent[]; hasMore: boolean }>;
  correctEvent(args: {
    subjectUserId: string;
    priorEvent: HydrationIntakeEvent;
    replacement: HydrationCreateEventArgs;
    reasonCode: string;
    correlationId: string;
  }): Promise<HydrationCorrectionResult>;
  voidEvent(args: {
    subjectUserId: string;
    event: HydrationIntakeEvent;
    reasonCode: string;
    correlationId: string;
  }): Promise<HydrationVoidResult>;
}

export class HydrationIntakeServiceError extends Error {
  constructor(
    public readonly code:
      | "AUTHENTICATION_REQUIRED"
      | "INVALID_EVENT"
      | "INVALID_CURSOR"
      | "INVALID_DATE_RANGE"
      | "INVALID_TIMEZONE"
      | "INVALID_AMOUNT"
      | "IDEMPOTENCY_CONFLICT"
      | "EVENT_NOT_FOUND"
      | "LINEAGE_CONFLICT"
      | "STORAGE_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "HydrationIntakeServiceError";
  }
}

function requireAuthenticatedUser(
  context: HydrationAuthenticatedContext,
): string {
  if (!context || typeof context.userId !== "string" || !context.userId.trim()) {
    throw new HydrationIntakeServiceError(
      "AUTHENTICATION_REQUIRED",
      "Authenticated hydration subject is required",
    );
  }
  return context.userId.trim();
}

function deriveLocalDate(occurredAt: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(occurredAt);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    if (!values.year || !values.month || !values.day) {
      throw new Error("missing date parts");
    }
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    throw new HydrationIntakeServiceError(
      "INVALID_TIMEZONE",
      `Invalid hydration timezone: ${timezone}`,
    );
  }
}

function normalizeVolumeMl(
  amount: number,
  unit: keyof typeof MILLILITERS_PER_UNIT,
): number {
  const volumeMl = Math.round(amount * MILLILITERS_PER_UNIT[unit]);
  if (
    !Number.isSafeInteger(volumeMl) ||
    volumeMl <= 0 ||
    volumeMl > MAX_POSTGRES_INTEGER
  ) {
    throw new HydrationIntakeServiceError(
      "INVALID_AMOUNT",
      "Hydration amount is outside the supported range",
    );
  }
  return volumeMl;
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

function hashEventPayload(input: HydrationIntakeEventInputParsed): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function asDate(value: Date | string): Date {
  const result = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(result.getTime())) {
    throw new HydrationIntakeServiceError(
      "STORAGE_CONFLICT",
      "Hydration event contains an invalid timestamp",
    );
  }
  return result;
}

function asLocalDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

function cursorSigningKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new HydrationIntakeServiceError(
      "STORAGE_CONFLICT",
      "Hydration cursor signing is not configured",
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

function encodeSignedCursor(
  subjectUserId: string,
  cursor: HydrationEventCursor,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      subjectUserId,
      occurredAt: cursor.occurredAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${signCursor(payload)}`;
}

export function decodeHydrationHistoryCursor(
  value: string,
  subjectUserId: string,
): HydrationEventCursor {
  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra) throw new Error("invalid cursor format");
    const expectedSignature = signCursor(payload);
    const provided = Buffer.from(signature, "base64url");
    const expected = Buffer.from(expectedSignature, "base64url");
    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      throw new Error("invalid cursor signature");
    }
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { subjectUserId?: unknown; occurredAt?: unknown; id?: unknown };
    if (
      decoded.subjectUserId !== subjectUserId ||
      typeof decoded.occurredAt !== "string" ||
      typeof decoded.id !== "string" ||
      !decoded.id.trim()
    ) {
      throw new Error("invalid cursor fields");
    }
    const occurredAt = new Date(decoded.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw new Error("invalid cursor date");
    return { occurredAt, id: decoded.id };
  } catch {
    throw new HydrationIntakeServiceError(
      "INVALID_CURSOR",
      "Invalid hydration history cursor",
    );
  }
}

function normalizeCreateInput(input: unknown): {
  input: HydrationIntakeEventInputParsed;
  occurredAt: Date;
  localDate: string;
  volumeMl: number;
  payloadHash: string;
} {
  let parsed: HydrationIntakeEventInputParsed;
  try {
    parsed = hydrationIntakeEventInputSchema.parse(input);
  } catch (error) {
    throw new HydrationIntakeServiceError(
      "INVALID_EVENT",
      error instanceof Error ? error.message : "Invalid hydration event",
    );
  }

  const occurredAt = new Date(parsed.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new HydrationIntakeServiceError(
      "INVALID_EVENT",
      "Hydration event timestamp is invalid",
    );
  }
  const localDate = deriveLocalDate(occurredAt, parsed.occurredTimezone);
  const volumeMl = normalizeVolumeMl(parsed.originalAmount, parsed.originalUnit);
  return {
    input: parsed,
    occurredAt,
    localDate,
    volumeMl,
    payloadHash: hashEventPayload(parsed),
  };
}

function validateMutationMetadata(reasonCode: string, correlationId: string): void {
  if (
    typeof reasonCode !== "string" ||
    !reasonCode.trim() ||
    reasonCode.trim().length > 200 ||
    typeof correlationId !== "string" ||
    !correlationId.trim() ||
    correlationId.trim().length > 200
  ) {
    throw new HydrationIntakeServiceError(
      "INVALID_EVENT",
      "A reason code and correlation ID are required",
    );
  }
}

export class HydrationIntakeService {
  constructor(private readonly store: HydrationIntakeStore) {}

  async createEvent(
    context: HydrationAuthenticatedContext,
    input: unknown,
  ): Promise<{ event: HydrationIntakeEvent; created: boolean }> {
    const subjectUserId = requireAuthenticatedUser(context);
    const normalized = normalizeCreateInput(input);
    return this.store.createEvent({
      subjectUserId,
      ...normalized,
    });
  }

  async getEvent(
    context: HydrationAuthenticatedContext,
    eventId: string,
  ): Promise<HydrationIntakeEvent> {
    const subjectUserId = requireAuthenticatedUser(context);
    const event = await this.store.getEvent(subjectUserId, eventId);
    if (!event) {
      throw new HydrationIntakeServiceError(
        "EVENT_NOT_FOUND",
        "Hydration event was not found",
      );
    }
    return event;
  }

  async listEvents(
    context: HydrationAuthenticatedContext,
    query: unknown = {},
  ): Promise<HydrationHistoryPage> {
    const subjectUserId = requireAuthenticatedUser(context);
    let parsed: ReturnType<typeof hydrationHistoryQuerySchema.parse>;
    try {
      parsed = hydrationHistoryQuerySchema.parse(query);
    } catch (error) {
      throw new HydrationIntakeServiceError(
        "INVALID_EVENT",
        error instanceof Error ? error.message : "Invalid hydration history query",
      );
    }
    if (parsed.from && parsed.to && parsed.from > parsed.to) {
      throw new HydrationIntakeServiceError(
        "INVALID_DATE_RANGE",
        "Hydration history start date must not be after the end date",
      );
    }
    const cursor = parsed.cursor
      ? decodeHydrationHistoryCursor(parsed.cursor, subjectUserId)
      : undefined;
    const page = await this.store.listEvents({
      subjectUserId,
      from: parsed.from,
      to: parsed.to,
      limit: parsed.limit,
      cursor,
    });
    const items = page.items.slice(0, parsed.limit);
    return {
      items,
      ...(page.hasMore && items.length > 0
        ? {
            nextCursor: encodeSignedCursor(subjectUserId, {
              occurredAt: asDate(items[items.length - 1].occurredAt),
              id: items[items.length - 1].id,
            }),
          }
        : {}),
    };
  }

  async correctEvent(
    context: HydrationAuthenticatedContext,
    mutation: HydrationEventCorrectionInput,
  ): Promise<HydrationCorrectionResult> {
    const subjectUserId = requireAuthenticatedUser(context);
    validateMutationMetadata(mutation.reasonCode, mutation.correlationId);
    const priorEvent = await this.getEvent(context, mutation.eventId);
    const normalized = normalizeCreateInput(mutation.replacement);
    return this.store.correctEvent({
      subjectUserId,
      priorEvent,
      replacement: { subjectUserId, ...normalized },
      reasonCode: mutation.reasonCode.trim(),
      correlationId: mutation.correlationId.trim(),
    });
  }

  async voidEvent(
    context: HydrationAuthenticatedContext,
    mutation: HydrationEventVoidInput,
  ): Promise<HydrationVoidResult> {
    const subjectUserId = requireAuthenticatedUser(context);
    validateMutationMetadata(mutation.reasonCode, mutation.correlationId);
    const event = await this.getEvent(context, mutation.eventId);
    return this.store.voidEvent({
      subjectUserId,
      event,
      reasonCode: mutation.reasonCode.trim(),
      correlationId: mutation.correlationId.trim(),
    });
  }
}

function mapEventRow(
  row: typeof hydrationIntakeEvents.$inferSelect,
): HydrationIntakeEvent {
  return {
    id: row.id,
    subjectUserId: row.subjectUserId,
    occurredAt: asDate(row.occurredAt).toISOString(),
    occurredTimezone: row.occurredTimezone,
    localDate: asLocalDate(row.localDate),
    volumeMl: row.volumeMl,
    originalAmount: Number(row.originalAmount),
    originalUnit: row.originalUnit as HydrationIntakeEvent["originalUnit"],
    beverageClass: row.beverageClass as HydrationIntakeEvent["beverageClass"],
    source: row.source as HydrationIntakeEvent["source"],
    idempotencyKey: row.idempotencyKey,
    payloadHash: row.payloadHash,
    enteredAt: asDate(row.enteredAt).toISOString(),
    enteredByUserId: row.enteredByUserId,
    ...(row.sourceEventId ? { sourceEventId: row.sourceEventId } : {}),
    ...(row.clientInstanceId ? { clientInstanceId: row.clientInstanceId } : {}),
    ...(row.observedPlanRevisionId
      ? { observedPlanRevisionId: row.observedPlanRevisionId }
      : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.declaredNutrients
      ? {
          declaredNutrients: row.declaredNutrients as HydrationIntakeEvent["declaredNutrients"],
        }
      : {}),
  };
}

function mapLineageRow(
  row: typeof hydrationEventSupersessions.$inferSelect,
): HydrationEventSupersession {
  return {
    id: row.id,
    subjectUserId: row.subjectUserId,
    priorEventId: row.priorEventId,
    ...(row.successorEventId ? { successorEventId: row.successorEventId } : {}),
    kind: row.kind as HydrationEventLineageKind,
    reasonCode: row.reasonCode,
    createdAt: asDate(row.createdAt).toISOString(),
    createdByUserId: row.createdByUserId,
    correlationId: row.correlationId,
  };
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}

type HydrationMutationExecutor = Pick<typeof db, "select" | "insert">;

export class DrizzleHydrationIntakeStore implements HydrationIntakeStore {
  constructor(private readonly database: typeof db = db) {}

  private async insertAudit(
    executor: HydrationMutationExecutor,
    args: {
      subjectUserId: string;
      action: string;
      resourceType: string;
      resourceId: string;
      outcome: "accepted" | "deduplicated";
      correlationId: string;
      metadata: Record<string, unknown>;
    },
  ): Promise<void> {
    await executor.insert(hydrationAuditLog).values({
      actorUserId: args.subjectUserId,
      subjectUserId: args.subjectUserId,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      outcome: args.outcome,
      correlationId: args.correlationId,
      metadataRedacted: args.metadata,
    });
  }

  async createEvent(
    args: HydrationCreateEventArgs,
  ): Promise<{ event: HydrationIntakeEvent; created: boolean }> {
    return this.database.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(hydrationIntakeEvents)
        .values({
          subjectUserId: args.subjectUserId,
          occurredAt: args.occurredAt,
          occurredTimezone: args.input.occurredTimezone,
          localDate: args.localDate,
          volumeMl: args.volumeMl,
          originalAmount: args.input.originalAmount.toFixed(3),
          originalUnit: args.input.originalUnit,
          beverageClass: args.input.beverageClass,
          source: args.input.source,
          idempotencyKey: args.input.idempotencyKey,
          payloadHash: args.payloadHash,
          enteredByUserId: args.subjectUserId,
          clientInstanceId: args.input.clientInstanceId ?? null,
          note: args.input.note ?? null,
          declaredNutrients: args.input.declaredNutrients ?? null,
        })
        .onConflictDoNothing({
          target: [
            hydrationIntakeEvents.subjectUserId,
            hydrationIntakeEvents.idempotencyKey,
          ],
        })
        .returning();

      if (inserted) {
        await this.insertAudit(tx, {
          subjectUserId: args.subjectUserId,
          action: "intake_event.create",
          resourceType: "hydration_intake_event",
          resourceId: inserted.id,
          outcome: "accepted",
          correlationId: args.input.idempotencyKey,
          metadata: { source: args.input.source },
        });
        return { event: mapEventRow(inserted), created: true };
      }

      const [existing] = await tx
        .select()
        .from(hydrationIntakeEvents)
        .where(
          and(
            eq(hydrationIntakeEvents.subjectUserId, args.subjectUserId),
            eq(hydrationIntakeEvents.idempotencyKey, args.input.idempotencyKey),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new HydrationIntakeServiceError(
          "STORAGE_CONFLICT",
          "Hydration idempotency reservation disappeared",
        );
      }
      if (existing.payloadHash !== args.payloadHash) {
        throw new HydrationIntakeServiceError(
          "IDEMPOTENCY_CONFLICT",
          "Idempotency key was already used for a different hydration event",
        );
      }
      await this.insertAudit(tx, {
        subjectUserId: args.subjectUserId,
        action: "intake_event.create",
        resourceType: "hydration_intake_event",
        resourceId: existing.id,
        outcome: "deduplicated",
        correlationId: args.input.idempotencyKey,
        metadata: { source: existing.source },
      });
      return { event: mapEventRow(existing), created: false };
    });
  }

  async getEvent(
    subjectUserId: string,
    eventId: string,
  ): Promise<HydrationIntakeEvent | null> {
    const [row] = await this.database
      .select()
      .from(hydrationIntakeEvents)
      .where(
        and(
          eq(hydrationIntakeEvents.subjectUserId, subjectUserId),
          eq(hydrationIntakeEvents.id, eventId),
        ),
      )
      .limit(1);
    return row ? mapEventRow(row) : null;
  }

  async listEvents(
    query: HydrationHistoryStoreQuery,
  ): Promise<{ items: HydrationIntakeEvent[]; hasMore: boolean }> {
    const conditions = [
      eq(hydrationIntakeEvents.subjectUserId, query.subjectUserId),
      ...(query.from ? [gte(hydrationIntakeEvents.localDate, query.from)] : []),
      ...(query.to ? [lte(hydrationIntakeEvents.localDate, query.to)] : []),
    ];
    if (query.cursor) {
      conditions.push(
        or(
          lt(hydrationIntakeEvents.occurredAt, query.cursor.occurredAt),
          and(
            eq(hydrationIntakeEvents.occurredAt, query.cursor.occurredAt),
            lt(hydrationIntakeEvents.id, query.cursor.id),
          ),
        )!,
      );
    }
    const rows = await this.database
      .select()
      .from(hydrationIntakeEvents)
      .where(and(...conditions))
      .orderBy(
        desc(hydrationIntakeEvents.occurredAt),
        desc(hydrationIntakeEvents.id),
      )
      .limit(query.limit + 1);
    return {
      items: rows.slice(0, query.limit).map(mapEventRow),
      hasMore: rows.length > query.limit,
    };
  }

  private async recoverCorrection(
    args: {
      subjectUserId: string;
      priorEvent: HydrationIntakeEvent;
      replacement: HydrationCreateEventArgs;
      reasonCode: string;
      correlationId: string;
    },
    executor: HydrationMutationExecutor,
  ): Promise<HydrationCorrectionResult | null> {
    const [lineageRow] = await executor
      .select()
      .from(hydrationEventSupersessions)
      .where(
        and(
          eq(hydrationEventSupersessions.subjectUserId, args.subjectUserId),
          eq(hydrationEventSupersessions.priorEventId, args.priorEvent.id),
        ),
      )
      .limit(1);
    if (!lineageRow) return null;
    if (
      lineageRow.kind !== "correction" ||
      lineageRow.correlationId !== args.correlationId ||
      !lineageRow.successorEventId
    ) {
      throw new HydrationIntakeServiceError(
        "LINEAGE_CONFLICT",
        "Hydration event already has a different lineage record",
      );
    }

    const [successorRow] = await executor
      .select()
      .from(hydrationIntakeEvents)
      .where(
        and(
          eq(hydrationIntakeEvents.subjectUserId, args.subjectUserId),
          eq(hydrationIntakeEvents.id, lineageRow.successorEventId),
        ),
      )
      .limit(1);
    if (!successorRow) {
      throw new HydrationIntakeServiceError(
        "STORAGE_CONFLICT",
        "Hydration correction successor is missing",
      );
    }
    if (successorRow.payloadHash !== args.replacement.payloadHash) {
      throw new HydrationIntakeServiceError(
        "LINEAGE_CONFLICT",
        "Hydration correction retry does not match the established successor",
      );
    }
    await this.insertAudit(executor, {
      subjectUserId: args.subjectUserId,
      action: "intake_event.correct",
      resourceType: "hydration_event_supersession",
      resourceId: lineageRow.id,
      outcome: "deduplicated",
      correlationId: args.correlationId,
      metadata: {
        priorEventId: args.priorEvent.id,
        successorEventId: successorRow.id,
      },
    });
    return {
      original: args.priorEvent,
      successor: mapEventRow(successorRow),
      lineage: mapLineageRow(lineageRow),
    };
  }

  private async recoverVoid(
    args: {
      subjectUserId: string;
      event: HydrationIntakeEvent;
      reasonCode: string;
      correlationId: string;
    },
    executor: HydrationMutationExecutor,
  ): Promise<HydrationVoidResult | null> {
    const [lineageRow] = await executor
      .select()
      .from(hydrationEventSupersessions)
      .where(
        and(
          eq(hydrationEventSupersessions.subjectUserId, args.subjectUserId),
          eq(hydrationEventSupersessions.priorEventId, args.event.id),
        ),
      )
      .limit(1);
    if (!lineageRow) return null;
    if (
      lineageRow.kind !== "void" ||
      lineageRow.correlationId !== args.correlationId
    ) {
      throw new HydrationIntakeServiceError(
        "LINEAGE_CONFLICT",
        "Hydration event already has a different lineage record",
      );
    }
    await this.insertAudit(executor, {
      subjectUserId: args.subjectUserId,
      action: "intake_event.void",
      resourceType: "hydration_event_supersession",
      resourceId: lineageRow.id,
      outcome: "deduplicated",
      correlationId: args.correlationId,
      metadata: { priorEventId: args.event.id },
    });
    return {
      event: args.event,
      lineage: mapLineageRow(lineageRow),
    };
  }

  async correctEvent(args: {
    subjectUserId: string;
    priorEvent: HydrationIntakeEvent;
    replacement: HydrationCreateEventArgs;
    reasonCode: string;
    correlationId: string;
  }): Promise<HydrationCorrectionResult> {
    try {
      return await this.database.transaction(async (tx) => {
        const existing = await this.recoverCorrection(args, tx);
        if (existing) return existing;

        const [successorRow] = await tx
          .insert(hydrationIntakeEvents)
          .values({
            subjectUserId: args.replacement.subjectUserId,
            occurredAt: args.replacement.occurredAt,
            occurredTimezone: args.replacement.input.occurredTimezone,
            localDate: args.replacement.localDate,
            volumeMl: args.replacement.volumeMl,
            originalAmount: args.replacement.input.originalAmount.toFixed(3),
            originalUnit: args.replacement.input.originalUnit,
            beverageClass: args.replacement.input.beverageClass,
            source: args.replacement.input.source,
            idempotencyKey: args.replacement.input.idempotencyKey,
            payloadHash: args.replacement.payloadHash,
            enteredByUserId: args.subjectUserId,
            clientInstanceId: args.replacement.input.clientInstanceId ?? null,
            note: args.replacement.input.note ?? null,
            declaredNutrients: args.replacement.input.declaredNutrients ?? null,
          })
          .onConflictDoNothing({
            target: [
              hydrationIntakeEvents.subjectUserId,
              hydrationIntakeEvents.idempotencyKey,
            ],
          })
          .returning();
        if (!successorRow) {
          const established = await this.recoverCorrection(args, tx);
          if (established) return established;
          throw new HydrationIntakeServiceError(
            "IDEMPOTENCY_CONFLICT",
            "Correction idempotency key is already associated with another event",
          );
        }

        const [lineageRow] = await tx
          .insert(hydrationEventSupersessions)
          .values({
            subjectUserId: args.subjectUserId,
            priorEventId: args.priorEvent.id,
            successorEventId: successorRow.id,
            kind: "correction",
            reasonCode: args.reasonCode,
            createdByUserId: args.subjectUserId,
            correlationId: args.correlationId,
          })
          .returning();
        if (!lineageRow) {
          throw new HydrationIntakeServiceError(
            "STORAGE_CONFLICT",
            "Hydration correction lineage was not created",
          );
        }
        await this.insertAudit(tx, {
          subjectUserId: args.subjectUserId,
          action: "intake_event.correct",
          resourceType: "hydration_event_supersession",
          resourceId: lineageRow.id,
          outcome: "accepted",
          correlationId: args.correlationId,
          metadata: {
            priorEventId: args.priorEvent.id,
            successorEventId: successorRow.id,
          },
        });
        return {
          original: args.priorEvent,
          successor: mapEventRow(successorRow),
          lineage: mapLineageRow(lineageRow),
        };
      });
    } catch (error) {
      if (error instanceof HydrationIntakeServiceError) throw error;
      if (isUniqueViolation(error)) {
        const established = await this.database.transaction((tx) =>
          this.recoverCorrection(args, tx),
        );
        if (established) return established;
        throw new HydrationIntakeServiceError(
          "LINEAGE_CONFLICT",
          "Hydration event was corrected concurrently",
        );
      }
      throw error;
    }
  }

  async voidEvent(args: {
    subjectUserId: string;
    event: HydrationIntakeEvent;
    reasonCode: string;
    correlationId: string;
  }): Promise<HydrationVoidResult> {
    try {
      return await this.database.transaction(async (tx) => {
        const existing = await this.recoverVoid(args, tx);
        if (existing) return existing;

        const [lineageRow] = await tx
          .insert(hydrationEventSupersessions)
          .values({
            subjectUserId: args.subjectUserId,
            priorEventId: args.event.id,
            successorEventId: null,
            kind: "void",
            reasonCode: args.reasonCode,
            createdByUserId: args.subjectUserId,
            correlationId: args.correlationId,
          })
          .returning();
        if (!lineageRow) {
          throw new HydrationIntakeServiceError(
            "STORAGE_CONFLICT",
            "Hydration void lineage was not created",
          );
        }
        await this.insertAudit(tx, {
          subjectUserId: args.subjectUserId,
          action: "intake_event.void",
          resourceType: "hydration_event_supersession",
          resourceId: lineageRow.id,
          outcome: "accepted",
          correlationId: args.correlationId,
          metadata: { priorEventId: args.event.id },
        });
        return {
          event: args.event,
          lineage: mapLineageRow(lineageRow),
        };
      });
    } catch (error) {
      if (error instanceof HydrationIntakeServiceError) throw error;
      if (isUniqueViolation(error)) {
        const established = await this.database.transaction((tx) =>
          this.recoverVoid(args, tx),
        );
        if (established) return established;
        throw new HydrationIntakeServiceError(
          "LINEAGE_CONFLICT",
          "Hydration event was voided or corrected concurrently",
        );
      }
      throw error;
    }
  }
}

export const hydrationIntakeService = new HydrationIntakeService(
  new DrizzleHydrationIntakeStore(),
);