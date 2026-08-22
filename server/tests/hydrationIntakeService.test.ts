import type {
  HydrationEventSupersession,
  HydrationIntakeEvent,
} from "@shared/hydration/contracts";
import type {
  HydrationCreateEventArgs,
  HydrationHistoryStoreQuery,
  HydrationIntakeStore,
} from "../services/hydration/hydrationIntakeService";
import {
  decodeHydrationHistoryCursor,
  HydrationIntakeService,
  HydrationIntakeServiceError,
} from "../services/hydration/hydrationIntakeService";

const OWNER_ID = "hydration-owner";
const OTHER_ID = "hydration-other";
const INSTANCE_ID = "00000000-0000-4000-8000-000000000041";
const originalSessionSecret = process.env.SESSION_SECRET;

beforeAll(() => {
  process.env.SESSION_SECRET = "hydration-service-test-secret";
});

afterAll(() => {
  if (originalSessionSecret === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = originalSessionSecret;
  }
});

function eventInput(
  idempotencyKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    originalAmount: 16,
    originalUnit: "oz",
    occurredAt: "2026-08-21T18:30:00.000Z",
    occurredTimezone: "America/Chicago",
    beverageClass: "water",
    source: "manual",
    idempotencyKey,
    ...overrides,
  };
}

function copyEvent(event: HydrationIntakeEvent): HydrationIntakeEvent {
  return {
    ...event,
    ...(event.declaredNutrients
      ? { declaredNutrients: { ...event.declaredNutrients } }
      : {}),
  };
}

class MemoryHydrationStore implements HydrationIntakeStore {
  readonly events = new Map<string, HydrationIntakeEvent>();
  readonly idempotency = new Map<string, string>();
  readonly lineages = new Map<string, HydrationEventSupersession>();
  unknownProjectionWrites = 0;
  private sequence = 0;

  async createEvent(args: HydrationCreateEventArgs) {
    const key = `${args.subjectUserId}:${args.input.idempotencyKey}`;
    const existingId = this.idempotency.get(key);
    if (existingId) {
      const existing = this.events.get(existingId)!;
      if (existing.payloadHash !== args.payloadHash) {
        throw new HydrationIntakeServiceError(
          "IDEMPOTENCY_CONFLICT",
          "Idempotency key was already used for a different hydration event",
        );
      }
      return { event: copyEvent(existing), created: false };
    }

    const id = `event-${String(++this.sequence).padStart(4, "0")}`;
    const event: HydrationIntakeEvent = {
      id,
      subjectUserId: args.subjectUserId,
      occurredAt: args.occurredAt.toISOString(),
      occurredTimezone: args.input.occurredTimezone,
      localDate: args.localDate,
      volumeMl: args.volumeMl,
      originalAmount: args.input.originalAmount,
      originalUnit: args.input.originalUnit,
      beverageClass: args.input.beverageClass,
      source: args.input.source,
      idempotencyKey: args.input.idempotencyKey,
      payloadHash: args.payloadHash,
      enteredAt: "2026-08-22T00:00:00.000Z",
      enteredByUserId: args.subjectUserId,
      ...(args.input.clientInstanceId
        ? { clientInstanceId: args.input.clientInstanceId }
        : {}),
      ...(args.input.note ? { note: args.input.note } : {}),
      ...(args.input.declaredNutrients
        ? { declaredNutrients: { ...args.input.declaredNutrients } }
        : {}),
    };
    this.events.set(id, event);
    this.idempotency.set(key, id);
    return { event: copyEvent(event), created: true };
  }

  async getEvent(subjectUserId: string, eventId: string) {
    const event = this.events.get(eventId);
    return event?.subjectUserId === subjectUserId ? copyEvent(event) : null;
  }

  async listEvents(query: HydrationHistoryStoreQuery) {
    const sorted = [...this.events.values()]
      .filter(
        (event) =>
          event.subjectUserId === query.subjectUserId &&
          (!query.from || event.localDate >= query.from) &&
          (!query.to || event.localDate <= query.to),
      )
      .filter((event) => {
        if (!query.cursor) return true;
        const eventTime = new Date(event.occurredAt).getTime();
        const cursorTime = query.cursor.occurredAt.getTime();
        return (
          eventTime < cursorTime ||
          (eventTime === cursorTime && event.id < query.cursor.id)
        );
      })
      .sort((left, right) => {
        const timestampDifference =
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime();
        return timestampDifference || right.id.localeCompare(left.id);
      });
    return {
      items: sorted.slice(0, query.limit).map(copyEvent),
      hasMore: sorted.length > query.limit,
    };
  }

  async correctEvent(args: {
    subjectUserId: string;
    priorEvent: HydrationIntakeEvent;
    replacement: HydrationCreateEventArgs;
    reasonCode: string;
    correlationId: string;
  }) {
    const existing = this.lineages.get(args.priorEvent.id);
    if (existing) {
      if (
        existing.kind !== "correction" ||
        existing.correlationId !== args.correlationId ||
        !existing.successorEventId
      ) {
        throw new HydrationIntakeServiceError(
          "LINEAGE_CONFLICT",
          "Hydration event already has a different lineage record",
        );
      }
      if (
        this.events.get(existing.successorEventId)!.payloadHash !==
        args.replacement.payloadHash
      ) {
        throw new HydrationIntakeServiceError(
          "LINEAGE_CONFLICT",
          "Hydration correction retry does not match the established successor",
        );
      }
      return {
        original: copyEvent(args.priorEvent),
        successor: copyEvent(this.events.get(existing.successorEventId)!),
        lineage: { ...existing },
      };
    }
    const successor = await this.createEvent(args.replacement);
    if (!successor.created) {
      throw new HydrationIntakeServiceError(
        "IDEMPOTENCY_CONFLICT",
        "Correction idempotency key is already associated with another event",
      );
    }
    const lineage: HydrationEventSupersession = {
      id: `lineage-${this.lineages.size + 1}`,
      subjectUserId: args.subjectUserId,
      priorEventId: args.priorEvent.id,
      successorEventId: successor.event.id,
      kind: "correction",
      reasonCode: args.reasonCode,
      createdAt: "2026-08-22T00:00:00.000Z",
      createdByUserId: args.subjectUserId,
      correlationId: args.correlationId,
    };
    this.lineages.set(args.priorEvent.id, lineage);
    return {
      original: copyEvent(args.priorEvent),
      successor: copyEvent(successor.event),
      lineage: { ...lineage },
    };
  }

  async voidEvent(args: {
    subjectUserId: string;
    event: HydrationIntakeEvent;
    reasonCode: string;
    correlationId: string;
  }) {
    const existing = this.lineages.get(args.event.id);
    if (existing) {
      if (
        existing.kind !== "void" ||
        existing.correlationId !== args.correlationId
      ) {
        throw new HydrationIntakeServiceError(
          "LINEAGE_CONFLICT",
          "Hydration event already has a different lineage record",
        );
      }
      return { event: copyEvent(args.event), lineage: { ...existing } };
    }
    const lineage: HydrationEventSupersession = {
      id: `lineage-${this.lineages.size + 1}`,
      subjectUserId: args.subjectUserId,
      priorEventId: args.event.id,
      kind: "void",
      reasonCode: args.reasonCode,
      createdAt: "2026-08-22T00:00:00.000Z",
      createdByUserId: args.subjectUserId,
      correlationId: args.correlationId,
    };
    this.lineages.set(args.event.id, lineage);
    return { event: copyEvent(args.event), lineage: { ...lineage } };
  }
}

function createService() {
  const store = new MemoryHydrationStore();
  return { store, service: new HydrationIntakeService(store) };
}

describe("HydrationIntakeService", () => {
  it("derives ownership from authenticated context and rejects caller-supplied subject IDs", async () => {
    const { service } = createService();
    const result = await service.createEvent(
      { userId: OWNER_ID },
      eventInput("00000000-0000-4000-8000-000000000001", {
        source: "import",
        clientInstanceId: INSTANCE_ID,
        note: "After training",
        declaredNutrients: {
          sodiumMg: 200,
          source: "label",
          confidence: "high",
        },
      }),
    );

    expect(result.event).toMatchObject({
      subjectUserId: OWNER_ID,
      originalAmount: 16,
      originalUnit: "oz",
      volumeMl: 473,
      source: "import",
      occurredAt: "2026-08-21T18:30:00.000Z",
      occurredTimezone: "America/Chicago",
      localDate: "2026-08-21",
      clientInstanceId: INSTANCE_ID,
    });
    await expect(
      service.createEvent(
        { userId: OWNER_ID },
        eventInput("00000000-0000-4000-8000-000000000002", {
          subjectUserId: OTHER_ID,
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_EVENT" });
  });

  it("returns one canonical event for duplicate idempotent submissions", async () => {
    const { service, store } = createService();
    const input = eventInput("00000000-0000-4000-8000-000000000003");
    const first = await service.createEvent({ userId: OWNER_ID }, input);
    const replay = await service.createEvent({ userId: OWNER_ID }, input);

    expect(first.created).toBe(true);
    expect(replay).toEqual({ event: first.event, created: false });
    expect(store.events.size).toBe(1);
    await expect(
      service.createEvent(
        { userId: OWNER_ID },
        eventInput("00000000-0000-4000-8000-000000000003", {
          originalAmount: 20,
        }),
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("keeps original events immutable and creates a linked correction successor", async () => {
    const { service, store } = createService();
    const original = await service.createEvent(
      { userId: OWNER_ID },
      eventInput("00000000-0000-4000-8000-000000000004"),
    );
    const corrected = await service.correctEvent(
      { userId: OWNER_ID },
      {
        eventId: original.event.id,
        replacement: eventInput("00000000-0000-4000-8000-000000000005", {
          originalAmount: 20,
        }),
        reasonCode: "AMOUNT_CORRECTION",
        correlationId: "correction-001",
      },
    );

    expect(store.events.get(original.event.id)).toMatchObject({
      originalAmount: 16,
      volumeMl: 473,
    });
    expect(corrected.successor).toMatchObject({
      originalAmount: 20,
      volumeMl: 591,
    });
    expect(corrected.lineage).toMatchObject({
      kind: "correction",
      priorEventId: original.event.id,
      successorEventId: corrected.successor.id,
    });
    await expect(
      service.correctEvent(
        { userId: OWNER_ID },
        {
          eventId: original.event.id,
          replacement: eventInput("00000000-0000-4000-8000-000000000005", {
            originalAmount: 16,
          }),
          reasonCode: "AMOUNT_CORRECTION",
          correlationId: "correction-001",
        },
      ),
    ).rejects.toMatchObject({ code: "LINEAGE_CONFLICT" });
    expect(store.events.size).toBe(2);
  });

  it("does not attach an unrelated idempotent event as a correction successor", async () => {
    const { service, store } = createService();
    const original = await service.createEvent(
      { userId: OWNER_ID },
      eventInput("00000000-0000-4000-8000-000000000012"),
    );
    await service.createEvent(
      { userId: OWNER_ID },
      eventInput("00000000-0000-4000-8000-000000000013", {
        originalAmount: 20,
      }),
    );

    await expect(
      service.correctEvent(
        { userId: OWNER_ID },
        {
          eventId: original.event.id,
          replacement: eventInput("00000000-0000-4000-8000-000000000013", {
            originalAmount: 20,
          }),
          reasonCode: "AMOUNT_CORRECTION",
          correlationId: "correction-002",
        },
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(store.lineages.has(original.event.id)).toBe(false);
  });

  it("preserves voided source history with a void lineage record", async () => {
    const { service, store } = createService();
    const original = await service.createEvent(
      { userId: OWNER_ID },
      eventInput("00000000-0000-4000-8000-000000000006"),
    );
    const result = await service.voidEvent(
      { userId: OWNER_ID },
      {
        eventId: original.event.id,
        reasonCode: "ENTRY_CANCELLED",
        correlationId: "void-001",
      },
    );

    expect(store.events.get(original.event.id)).toEqual(original.event);
    expect(result.lineage).toMatchObject({
      kind: "void",
      priorEventId: original.event.id,
    });
    expect(result.lineage.successorEventId).toBeUndefined();
    expect(
      await service.voidEvent(
        { userId: OWNER_ID },
        {
          eventId: original.event.id,
          reasonCode: "ENTRY_CANCELLED",
          correlationId: "void-001",
        },
      ),
    ).toEqual(result);
    expect(store.events.size).toBe(1);
  });

  it("keeps contribution and electrolyte accounting explicitly unknown", async () => {
    const { service, store } = createService();
    const created = await service.createEvent(
      { userId: OWNER_ID },
      eventInput("00000000-0000-4000-8000-000000000007", {
        beverageClass: "electrolyte_drink",
      }),
    );

    expect(created.event).not.toHaveProperty("contributionMl");
    expect(created.event).not.toHaveProperty("sodiumMg");
    expect(created.event).not.toHaveProperty("remainingMl");
    expect(store.unknownProjectionWrites).toBe(0);
  });

  it("orders same-timestamp events deterministically and advances with a composite cursor", async () => {
    const { service } = createService();
    await service.createEvent(
      { userId: OWNER_ID },
      eventInput("00000000-0000-4000-8000-000000000008"),
    );
    await service.createEvent(
      { userId: OWNER_ID },
      eventInput("00000000-0000-4000-8000-000000000009"),
    );
    await service.createEvent(
      { userId: OWNER_ID },
      eventInput("00000000-0000-4000-8000-000000000010"),
    );

    const firstPage = await service.listEvents(
      { userId: OWNER_ID },
      { limit: 2 },
    );
    expect(firstPage.items.map((event) => event.id)).toEqual([
      "event-0003",
      "event-0002",
    ]);
    expect(firstPage.nextCursor).toBeDefined();
    expect(
      decodeHydrationHistoryCursor(firstPage.nextCursor!, OWNER_ID).id,
    ).toBe("event-0002");
    await expect(
      service.listEvents(
        { userId: OTHER_ID },
        { cursor: firstPage.nextCursor },
      ),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    await expect(
      service.listEvents(
        { userId: OWNER_ID },
        { cursor: `${firstPage.nextCursor}tampered` },
      ),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });

    const secondPage = await service.listEvents(
      { userId: OWNER_ID },
      { limit: 2, cursor: firstPage.nextCursor },
    );
    expect(secondPage.items.map((event) => event.id)).toEqual(["event-0001"]);
    expect(secondPage.nextCursor).toBeUndefined();
  });

  it("rejects impossible history dates and amounts the canonical ledger cannot store exactly", async () => {
    const { service } = createService();
    await expect(
      service.listEvents({ userId: OWNER_ID }, { from: "2026-02-31" }),
    ).rejects.toMatchObject({ code: "INVALID_EVENT" });
    await expect(
      service.listEvents({ userId: OWNER_ID }, { from: "0000-01-01" }),
    ).rejects.toMatchObject({ code: "INVALID_EVENT" });
    await expect(
      service.createEvent(
        { userId: OWNER_ID },
        eventInput("00000000-0000-4000-8000-000000000017", {
          occurredAt: "0000-01-01T00:00:00.000Z",
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_EVENT" });
    await expect(
      service.createEvent(
        { userId: OWNER_ID },
        eventInput("00000000-0000-4000-8000-000000000014", {
          originalAmount: 1.2345,
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_EVENT" });
    await expect(
      service.createEvent(
        { userId: OWNER_ID },
        eventInput("00000000-0000-4000-8000-000000000015", {
          originalAmount: 1_000_000_000,
          originalUnit: "ml",
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_EVENT" });
    await expect(
      service.createEvent(
        { userId: OWNER_ID },
        eventInput("00000000-0000-4000-8000-000000000016", {
          originalAmount: 3_000_000,
          originalUnit: "l",
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
  });

  it("makes cross-account reads and mutations impossible", async () => {
    const { service } = createService();
    const ownerEvent = await service.createEvent(
      { userId: OWNER_ID },
      eventInput("00000000-0000-4000-8000-000000000011"),
    );

    await expect(
      service.getEvent({ userId: OTHER_ID }, ownerEvent.event.id),
    ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
    expect(await service.listEvents({ userId: OTHER_ID })).toEqual({ items: [] });
    await expect(
      service.voidEvent(
        { userId: OTHER_ID },
        {
          eventId: ownerEvent.event.id,
          reasonCode: "ATTEMPTED_CROSS_ACCOUNT_VOID",
          correlationId: "void-attack",
        },
      ),
    ).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
  });
});