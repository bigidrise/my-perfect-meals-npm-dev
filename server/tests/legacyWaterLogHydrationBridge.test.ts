import type {
  LegacyWaterLogRow,
  LegacyWaterLogStore,
  LegacyWaterLogStoreQuery,
} from "../services/hydration/legacyWaterLogHydrationBridge";
import {
  LegacyWaterLogHydrationBridge,
  mapLegacyWaterLogToHydrationEvent,
} from "../services/hydration/legacyWaterLogHydrationBridge";

const OWNER_ID = "legacy-water-owner";
const OTHER_ID = "legacy-water-other";
const PROFESSIONAL_ID = "legacy-water-professional";
const CLIENT_ID = "legacy-water-client";
const originalSessionSecret = process.env.SESSION_SECRET;

beforeAll(() => {
  process.env.SESSION_SECRET = "legacy-water-hydration-bridge-test-secret";
});

afterAll(() => {
  if (originalSessionSecret === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = originalSessionSecret;
  }
});

function waterRow(
  id: string,
  overrides: Partial<LegacyWaterLogRow> = {},
): LegacyWaterLogRow {
  return {
    id,
    userId: OWNER_ID,
    amountMl: 355,
    unit: "oz",
    intakeTime: new Date("2026-08-21T18:30:00.000Z"),
    createdAt: new Date("2026-08-21T18:31:00.000Z"),
    ...overrides,
  };
}

class MemoryLegacyWaterLogStore implements LegacyWaterLogStore {
  rows: LegacyWaterLogRow[] = [];
  queries: LegacyWaterLogStoreQuery[] = [];

  async listRows(query: LegacyWaterLogStoreQuery) {
    this.queries.push(query);
    return this.rows
      .filter((row) => row.userId === query.subjectUserId)
      .filter((row) => !query.from || row.intakeTime >= query.from)
      .filter(
        (row) => !query.toExclusive || row.intakeTime < query.toExclusive,
      )
      .filter((row) => {
        if (!query.cursor) return true;
        const difference =
          row.intakeTime.getTime() - query.cursor.intakeTime.getTime();
        return difference < 0 || (difference === 0 && row.id < query.cursor.id);
      })
      .sort(
        (left, right) =>
          right.intakeTime.getTime() - left.intakeTime.getTime() ||
          right.id.localeCompare(left.id),
      )
      .slice(0, query.limit);
  }
}

describe("legacy water-log Hydration bridge", () => {
  it("projects one water row with exact normalized volume, timestamp, owner, unit, and stable provenance", () => {
    const row = waterRow("00000000-0000-4000-8000-000000000101");
    const first = mapLegacyWaterLogToHydrationEvent(row);
    const replay = mapLegacyWaterLogToHydrationEvent(row);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      id: row.id,
      subjectUserId: OWNER_ID,
      occurredAt: "2026-08-21T18:30:00.000Z",
      occurredTimezone: "UTC",
      localDate: "2026-08-21",
      volumeMl: 355,
      originalAmount: 12.004,
      originalUnit: "oz",
      beverageClass: "water",
      source: "legacy_manual",
      sourceEventId: row.id,
      idempotencyKey: row.id,
      enteredAt: "2026-08-21T18:31:00.000Z",
      enteredByUserId: OWNER_ID,
      provenance: {
        legacyWaterLogId: row.id,
        rawOriginalUnit: "oz",
        originalAmountInterpretation: "reconstructed_from_normalized_ml",
        occurredTimezoneInterpretation:
          "legacy_timestamp_interpreted_as_utc",
        enteredByInterpretation: "legacy_actor_unavailable_subject_used",
      },
    });
    expect(first.payloadHash).toHaveLength(64);
    expect(first).not.toHaveProperty("targetMl");
    expect(first).not.toHaveProperty("minimumMl");
    expect(first).not.toHaveProperty("maximumMl");
    expect(first).not.toHaveProperty("remainingMl");
    expect(first).not.toHaveProperty("knownContributionMl");
    expect(first).not.toHaveProperty("declaredNutrients");
  });

  it("preserves legacy unit evidence without guessing unsupported conversions", () => {
    const fluidOunces = mapLegacyWaterLogToHydrationEvent(
      waterRow("00000000-0000-4000-8000-000000000102", {
        unit: "fluid ounces",
      }),
    );
    const unknown = mapLegacyWaterLogToHydrationEvent(
      waterRow("00000000-0000-4000-8000-000000000103", {
        amountMl: 500,
        unit: "bottle",
      }),
    );

    expect(fluidOunces.originalUnit).toBe("fl_oz");
    expect(fluidOunces.provenance.rawOriginalUnit).toBe("fluid ounces");
    expect(unknown).toMatchObject({
      volumeMl: 500,
      originalAmount: 500,
      originalUnit: "ml",
      provenance: {
        rawOriginalUnit: "bottle",
        originalAmountInterpretation: "normalized_ml_only",
      },
    });
  });

  it("derives self-service ownership only from authenticated context and rejects caller identity fields", async () => {
    const store = new MemoryLegacyWaterLogStore();
    store.rows = [waterRow("00000000-0000-4000-8000-000000000104")];
    const verifyAccess = jest.fn();
    const bridge = new LegacyWaterLogHydrationBridge(store, verifyAccess);

    const page = await bridge.listEvents(
      { authenticatedUserId: OWNER_ID },
      { from: "2026-08-21", to: "2026-08-21" },
    );
    expect(page.items).toHaveLength(1);
    expect(store.queries[0].subjectUserId).toBe(OWNER_ID);
    expect(verifyAccess).not.toHaveBeenCalled();
    await expect(
      bridge.listEvents(
        { authenticatedUserId: OWNER_ID },
        { userId: OTHER_ID },
      ),
    ).rejects.toMatchObject({ code: "INVALID_QUERY" });
  });

  it("fails closed for denied or unavailable delegation and reads the client only after approval", async () => {
    const store = new MemoryLegacyWaterLogStore();
    store.rows = [
      waterRow("00000000-0000-4000-8000-000000000105", {
        userId: CLIENT_ID,
      }),
      waterRow("00000000-0000-4000-8000-000000000106", {
        userId: OTHER_ID,
      }),
    ];
    const denied = new LegacyWaterLogHydrationBridge(
      store,
      jest.fn().mockResolvedValue(false),
    );
    await expect(
      denied.listEvents({
        authenticatedUserId: PROFESSIONAL_ID,
        requestedClientId: CLIENT_ID,
      }),
    ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(store.queries).toHaveLength(0);

    const unavailable = new LegacyWaterLogHydrationBridge(
      store,
      jest.fn().mockRejectedValue(new Error("relationship lookup failed")),
    );
    await expect(
      unavailable.listEvents({
        authenticatedUserId: PROFESSIONAL_ID,
        requestedClientId: CLIENT_ID,
      }),
    ).rejects.toMatchObject({ code: "ACCESS_UNAVAILABLE" });
    expect(store.queries).toHaveLength(0);

    const approvedVerifier = jest.fn().mockResolvedValue(true);
    const approved = new LegacyWaterLogHydrationBridge(
      store,
      approvedVerifier,
    );
    const page = await approved.listEvents({
      authenticatedUserId: PROFESSIONAL_ID,
      requestedClientId: CLIENT_ID,
    });
    expect(page.items.map((event) => event.subjectUserId)).toEqual([CLIENT_ID]);
    expect(store.queries[0].subjectUserId).toBe(CLIENT_ID);
    expect(approvedVerifier).toHaveBeenCalledWith(
      PROFESSIONAL_ID,
      CLIENT_ID,
    );
  });

  it("is read-through, so source correction and deletion cannot leave a stale canonical copy", async () => {
    const store = new MemoryLegacyWaterLogStore();
    const id = "00000000-0000-4000-8000-000000000107";
    store.rows = [waterRow(id)];
    const bridge = new LegacyWaterLogHydrationBridge(
      store,
      jest.fn().mockResolvedValue(false),
    );

    const original = await bridge.listEvents({
      authenticatedUserId: OWNER_ID,
    });
    expect(original.items).toHaveLength(1);
    expect(original.items[0].volumeMl).toBe(355);

    store.rows = [waterRow(id, { amountMl: 500, unit: "ml" })];
    const corrected = await bridge.listEvents({
      authenticatedUserId: OWNER_ID,
    });
    expect(corrected.items).toHaveLength(1);
    expect(corrected.items[0]).toMatchObject({
      id,
      sourceEventId: id,
      volumeMl: 500,
      originalAmount: 500,
      originalUnit: "ml",
    });
    expect(corrected.items[0].payloadHash).not.toBe(
      original.items[0].payloadHash,
    );

    store.rows = [];
    const afterDeletion = await bridge.listEvents({
      authenticatedUserId: OWNER_ID,
    });
    expect(afterDeletion.items).toEqual([]);
  });

  it("uses stable timestamp-plus-id pagination without duplicates across pages", async () => {
    const store = new MemoryLegacyWaterLogStore();
    store.rows = [
      waterRow("00000000-0000-4000-8000-000000000110"),
      waterRow("00000000-0000-4000-8000-000000000109"),
      waterRow("00000000-0000-4000-8000-000000000108"),
    ];
    const bridge = new LegacyWaterLogHydrationBridge(
      store,
      jest.fn().mockResolvedValue(false),
    );

    const first = await bridge.listEvents(
      { authenticatedUserId: OWNER_ID },
      { limit: 2 },
    );
    expect(first.items.map((event) => event.id)).toEqual([
      "00000000-0000-4000-8000-000000000110",
      "00000000-0000-4000-8000-000000000109",
    ]);
    expect(first.nextCursor).toBeDefined();

    const second = await bridge.listEvents(
      { authenticatedUserId: OWNER_ID },
      { limit: 2, cursor: first.nextCursor },
    );
    expect(second.items.map((event) => event.id)).toEqual([
      "00000000-0000-4000-8000-000000000108",
    ]);
    expect(second.nextCursor).toBeUndefined();

    await expect(
      bridge.listEvents(
        { authenticatedUserId: OTHER_ID },
        { cursor: first.nextCursor },
      ),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  });
});