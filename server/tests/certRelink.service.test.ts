/**
 * Tests for relinkCertificate() in server/services/certRelinkService.ts
 *
 * These tests exercise the ACTUAL service function — not a hand-rolled
 * simulation — by injecting a structured mock dbClient that implements
 * the CertRelinkDb interface.  No live database connection is required.
 *
 * Coverage:
 *  §1  Success path — cert and progress rows moved, count returned
 *  §2  Idempotency — oldUserId === newUserId
 *  §3  Guard: missing / in-progress source cert
 *  §4  Guard: anti-theft (newUserId already has a cert)
 *  §5  Guard: missing required params
 *  §6  Transaction atomicity — progress update failure rolls back the cert update
 */

import { relinkCertificate, type CertRelinkDb, type CertRelinkTx } from "../services/certRelinkService";

// ── Mock factory helpers ───────────────────────────────────────────────────────

/**
 * A call to tx.update().set().where() can be awaited directly (cert update)
 * OR can have .returning() chained onto it (progress update).
 *
 * This returns an object that satisfies both call sites:
 *  - `await tx.update(...).set(...).where(...)` — resolves to undefined
 *  - `await tx.update(...).set(...).where(...).returning(...)` — resolves to `rows`
 */
function makeUpdateResult(rows: Array<{ id: string }> | (() => never)) {
  const rowsOrThrow = typeof rows === "function" ? rows : () => rows as Array<{ id: string }>;

  const result = {
    returning: () =>
      new Promise<Array<{ id: string }>>((resolve, reject) => {
        try {
          resolve(rowsOrThrow());
        } catch (e) {
          reject(e);
        }
      }),
    // Make it directly awaitable (used by the cert update which has no .returning())
    then: (onFulfilled: (v: undefined) => unknown, onRejected?: (e: unknown) => unknown) =>
      new Promise<undefined>((resolve, reject) => {
        try {
          rowsOrThrow(); // may throw for the failure scenario
          resolve(undefined);
        } catch (e) {
          if (onRejected) {
            try { resolve(onRejected(e) as any); } catch (e2) { reject(e2); }
          } else {
            reject(e);
          }
        }
      }).then(onFulfilled, onRejected),
  };
  return result;
}

/**
 * Build a mock CertRelinkTx.
 *
 * updateRows[0] → cert update result
 * updateRows[1] → progress update result (or a throw-function)
 */
function buildMockTx(
  progressRows: Array<{ id: string }>,
  throwOnProgressUpdate = false
): CertRelinkTx {
  let updateCount = 0;

  return {
    update: (_table: unknown) => ({
      set: (_values: unknown) => ({
        where: (_cond: unknown) => {
          const call = ++updateCount;
          if (call === 2 && throwOnProgressUpdate) {
            return makeUpdateResult(() => {
              throw new Error("Simulated DB failure on progress update");
            });
          }
          if (call === 2) {
            return makeUpdateResult(progressRows);
          }
          // call === 1: cert update — resolves to undefined (no .returning() in service)
          return makeUpdateResult([]);
        },
      }),
    }),
  };
}

/**
 * Build a mock CertRelinkDb.
 *
 * @param selectRows - Array of arrays; each element is the result of one SELECT call.
 *                     select calls: [0] = source cert lookup, [1] = conflict check.
 *                     For the idempotent path: [0] = same-user cert lookup.
 * @param progressRows - Rows returned by the progress UPDATE RETURNING.
 * @param throwOnProgressUpdate - Whether the progress update should throw inside the tx.
 */
function buildMockDb({
  selectRows,
  progressRows = [],
  throwOnProgressUpdate = false,
}: {
  selectRows: Array<Array<Record<string, unknown>>>;
  progressRows?: Array<{ id: string }>;
  throwOnProgressUpdate?: boolean;
}): CertRelinkDb {
  let selectCallCount = 0;
  const mockTx = buildMockTx(progressRows, throwOnProgressUpdate);

  return {
    select: (_fields?: unknown) => ({
      from: (_table: unknown) => ({
        where: (_cond: unknown) => ({
          limit: async (_n: number) => {
            const rows = selectRows[selectCallCount] ?? [];
            selectCallCount++;
            return rows;
          },
        }),
      }),
    }),

    transaction: async <T>(fn: (tx: CertRelinkTx) => Promise<T>): Promise<T> => {
      return fn(mockTx);
    },
  };
}

// ── §1  Success path ──────────────────────────────────────────────────────────

describe("relinkCertificate — success path", () => {
  const CERT = {
    certificateNumber: "MPM-PM-MIG123",
    certificateName: "Carol Davis",
    status: "completed",
  };
  const PROGRESS_ROWS = [
    { id: "row-1" },
    { id: "row-2" },
    { id: "row-3" },
  ];

  it("returns ok:true with preserved certificateNumber and certificateName", async () => {
    const db = buildMockDb({
      selectRows: [
        [CERT],  // source cert lookup → found
        [],      // conflict check → no conflict
      ],
      progressRows: PROGRESS_ROWS,
    });

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyLinked).toBe(false);
    expect(result.certificateNumber).toBe("MPM-PM-MIG123");
    expect(result.certificateName).toBe("Carol Davis");
  });

  it("reports the correct number of progress rows re-linked", async () => {
    const db = buildMockDb({
      selectRows: [[CERT], []],
      progressRows: PROGRESS_ROWS,
    });

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.progressRowsRelinked).toBe(3);
  });

  it("reports 0 progress rows when the user had no module progress recorded", async () => {
    const db = buildMockDb({
      selectRows: [[CERT], []],
      progressRows: [],
    });

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.progressRowsRelinked).toBe(0);
  });

  it("invokes dbClient.transaction() exactly once (proves both updates are atomic)", async () => {
    let txCalls = 0;
    const db: CertRelinkDb = {
      ...buildMockDb({ selectRows: [[CERT], []], progressRows: PROGRESS_ROWS }),
      transaction: async (fn) => {
        txCalls++;
        return fn(buildMockTx(PROGRESS_ROWS));
      },
    };

    await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(txCalls).toBe(1);
  });

  it("does NOT invoke dbClient.transaction() for the idempotent path (no DB write needed)", async () => {
    let txCalls = 0;
    const db: CertRelinkDb = {
      ...buildMockDb({
        selectRows: [[CERT]],
        progressRows: [],
      }),
      transaction: async (fn) => {
        txCalls++;
        return fn(buildMockTx([]));
      },
    };

    // idempotent: old === new
    await relinkCertificate("same-user", "same-user", "platform_mastery", db);
    expect(txCalls).toBe(0);
  });
});

// ── §2  Idempotency (oldUserId === newUserId) ─────────────────────────────────

describe("relinkCertificate — idempotency", () => {
  const CERT = {
    certificateNumber: "MPM-PM-IDEM",
    certificateName: "Idem User",
    status: "completed",
  };

  it("returns ok:true with alreadyLinked:true and progressRowsRelinked:0 when oldUserId === newUserId", async () => {
    const db = buildMockDb({ selectRows: [[CERT]] });

    const result = await relinkCertificate("same-user", "same-user", "platform_mastery", db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyLinked).toBe(true);
    expect(result.progressRowsRelinked).toBe(0);
    expect(result.certificateNumber).toBe("MPM-PM-IDEM");
  });

  it("returns 404 when oldUserId === newUserId but the user has no completed cert", async () => {
    const db = buildMockDb({ selectRows: [[{ ...CERT, status: "in_progress" }]] });

    const result = await relinkCertificate("same-user", "same-user", "platform_mastery", db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
  });
});

// ── §3  Guard: missing / in-progress source cert ──────────────────────────────

describe("relinkCertificate — guard: source cert not found or incomplete", () => {
  it("returns 404 when oldUserId has no cert row for this certificationType", async () => {
    const db = buildMockDb({ selectRows: [[]] }); // empty → cert not found

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
    expect(result.error).toMatch(/No certificate record found/);
  });

  it("returns 409 when the source cert exists but is not completed", async () => {
    const db = buildMockDb({
      selectRows: [[{ certificateNumber: null, certificateName: null, status: "in_progress" }]],
    });

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.error).toMatch(/not completed/);
  });
});

// ── §4  Guard: anti-theft ─────────────────────────────────────────────────────

describe("relinkCertificate — guard: anti-theft (newUserId already has a cert)", () => {
  const SOURCE_CERT = { certificateNumber: "MPM-PM-SRC", certificateName: "Source", status: "completed" };
  const CONFLICT = { id: "existing-cert-id" };

  it("returns 409 when newUserId already owns a cert for this certificationType", async () => {
    const db = buildMockDb({
      selectRows: [
        [SOURCE_CERT], // source found
        [CONFLICT],   // conflict found — re-link blocked
      ],
    });

    const result = await relinkCertificate("old-user", "thief-user", "platform_mastery", db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.error).toMatch(/already has a certificate record/);
  });

  it("does NOT call dbClient.transaction() when the anti-theft guard fires", async () => {
    let txCalls = 0;
    const base = buildMockDb({ selectRows: [[SOURCE_CERT], [CONFLICT]] });
    const db: CertRelinkDb = {
      ...base,
      transaction: async (fn) => { txCalls++; return fn(buildMockTx([])); },
    };

    await relinkCertificate("old-user", "thief-user", "platform_mastery", db);
    expect(txCalls).toBe(0);
  });
});

// ── §5  Guard: missing required params ────────────────────────────────────────

describe("relinkCertificate — guard: missing or empty params", () => {
  const NOOP_DB = buildMockDb({ selectRows: [] });

  it("returns 400 when oldUserId is empty", async () => {
    const result = await relinkCertificate("", "new-user", "platform_mastery", NOOP_DB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("returns 400 when newUserId is empty", async () => {
    const result = await relinkCertificate("old-user", "", "platform_mastery", NOOP_DB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });

  it("returns 400 when certificationType is empty", async () => {
    const result = await relinkCertificate("old-user", "new-user", "", NOOP_DB);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
  });
});

// ── §6  Transaction atomicity ─────────────────────────────────────────────────
//
// The progress update is the second of two UPDATEs inside the transaction.
// If it fails, Postgres rolls back the cert update automatically.  Here we
// verify that the SERVICE propagates the error (so the route returns 500 and
// the caller knows the operation failed) and does NOT silently swallow the
// exception and claim partial success.

describe("relinkCertificate — transaction atomicity: progress failure propagates", () => {
  const SOURCE_CERT = { certificateNumber: "MPM-PM-TX", certificateName: "TX User", status: "completed" };

  it("rejects with the DB error when the progress UPDATE throws inside the transaction", async () => {
    const db = buildMockDb({
      selectRows: [[SOURCE_CERT], []], // source found, no conflict
      progressRows: [],
      throwOnProgressUpdate: true,
    });

    await expect(
      relinkCertificate("old-user", "new-user", "platform_mastery", db)
    ).rejects.toThrow("Simulated DB failure on progress update");
  });

  it("does NOT return ok:true when the progress UPDATE throws (no silent partial success)", async () => {
    const db = buildMockDb({
      selectRows: [[SOURCE_CERT], []],
      throwOnProgressUpdate: true,
    });

    let result: Awaited<ReturnType<typeof relinkCertificate>> | null = null;
    let threw = false;
    try {
      result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
    expect(result).toBeNull(); // never resolved
  });

  it("calls dbClient.transaction() before throwing — proves the tx boundary was entered", async () => {
    let txCalled = false;
    const base = buildMockDb({
      selectRows: [[SOURCE_CERT], []],
      throwOnProgressUpdate: true,
    });
    const db: CertRelinkDb = {
      ...base,
      transaction: async (fn) => {
        txCalled = true;
        return fn(buildMockTx([], /* throwOnProgressUpdate */ true));
      },
    };

    await expect(
      relinkCertificate("old-user", "new-user", "platform_mastery", db)
    ).rejects.toThrow();

    // The transaction was started before the failure
    expect(txCalled).toBe(true);
  });
});
