/**
 * Tests for relinkCertificate() in server/services/certRelinkService.ts
 *
 * These tests exercise the ACTUAL service function — not a hand-rolled
 * simulation — by injecting a structured mock dbClient that implements
 * the CertRelinkDb interface.  No live database connection is required.
 *
 * Coverage:
 *  §1  Success path — cert, progress, and quiz rows moved; counts returned
 *  §2  Idempotency — oldUserId === newUserId
 *  §3  Guard: missing / in-progress source cert
 *  §4  Guard: anti-theft (newUserId already has a cert)
 *  §5  Guard: missing required params
 *  §6  Transaction atomicity — progress update failure rolls back the cert update
 *  §7  Audit log — written inside the transaction on success, absent on failure
 *  §8  Guard: quiz attempt conflict (newUserId already has quiz attempt rows)
 */

import { relinkCertificate, type CertRelinkDb, type CertRelinkTx } from "../services/certRelinkService";

// ── Mock factory helpers ───────────────────────────────────────────────────────

/**
 * A call to tx.update().set().where() can be awaited directly (cert update)
 * OR can have .returning() chained onto it (progress / quiz updates).
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
 * update call order inside the transaction:
 *   call 1 → cert row update (no .returning())
 *   call 2 → module-progress rows (.returning())
 *   call 3 → quiz attempt rows (.returning())
 *
 * insert() → audit log write (no-op by default, spy optional)
 */
function buildMockTx(
  progressRows: Array<{ id: string }>,
  throwOnProgressUpdate = false,
  auditInsertSpy?: { called: boolean; values: Record<string, unknown> | null }
): CertRelinkTx {
  let updateCount = 0;

  return {
    update: (_table: unknown) => ({
      set: (_values: unknown) => ({
        where: (_cond: unknown) => {
          const call = ++updateCount;

          // call 2: progress update (throw path)
          if (call === 2 && throwOnProgressUpdate) {
            return makeUpdateResult(() => {
              throw new Error("Simulated DB failure on progress update");
            });
          }
          // call 2: progress update (success path)
          if (call === 2) {
            return makeUpdateResult(progressRows);
          }
          // call 3: quiz attempt update — always returns empty in mocks
          if (call === 3) {
            return makeUpdateResult([]);
          }
          // call 1: cert update — resolves to undefined (no .returning() in service)
          return makeUpdateResult([]);
        },
      }),
    }),

    insert: (_table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        if (auditInsertSpy) {
          auditInsertSpy.called = true;
          auditInsertSpy.values = vals;
        }
        return Promise.resolve();
      },
    }),
  };
}

/**
 * Build a mock CertRelinkDb.
 *
 * @param selectRows        - Array of arrays; each element is the result of one SELECT call.
 *                            select calls: [0] = source cert lookup, [1] = dest cert conflict
 *                            check, [2] = dest quiz attempt conflict check.
 *                            For the idempotent path: [0] = same-user cert lookup.
 *                            Any call beyond the provided array returns [] by default (no
 *                            conflict), so tests that only care about earlier guards can
 *                            safely provide fewer than 3 elements.
 * @param progressRows      - Rows returned by the progress UPDATE RETURNING.
 * @param throwOnProgressUpdate - Whether the progress update should throw inside the tx.
 * @param auditInsertSpy    - Optional spy to capture the audit insert call.
 */
function buildMockDb({
  selectRows,
  progressRows = [],
  throwOnProgressUpdate = false,
  auditInsertSpy,
}: {
  selectRows: Array<Array<Record<string, unknown>>>;
  progressRows?: Array<{ id: string }>;
  throwOnProgressUpdate?: boolean;
  auditInsertSpy?: { called: boolean; values: Record<string, unknown> | null };
}): CertRelinkDb {
  let selectCallCount = 0;
  const mockTx = buildMockTx(progressRows, throwOnProgressUpdate, auditInsertSpy);

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

  it("reports quizAttemptRowsRelinked in the result", async () => {
    const db = buildMockDb({
      selectRows: [[CERT], []],
      progressRows: PROGRESS_ROWS,
    });

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Mock returns [] for the quiz update, so 0 rows
    expect(result.quizAttemptRowsRelinked).toBe(0);
  });

  it("invokes dbClient.transaction() exactly once (proves all updates are atomic)", async () => {
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

  it("writes an audit log row inside the transaction on successful re-link", async () => {
    const auditSpy = { called: false, values: null as Record<string, unknown> | null };
    const db = buildMockDb({
      selectRows: [[CERT], []],
      progressRows: PROGRESS_ROWS,
      auditInsertSpy: auditSpy,
    });

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db, "admin-123");
    expect(result.ok).toBe(true);
    expect(auditSpy.called).toBe(true);
    expect(auditSpy.values).toMatchObject({
      adminUserId: "admin-123",
      oldUserId: "old-user",
      newUserId: "new-user",
      certificationType: "platform_mastery",
      certificateNumber: "MPM-PM-MIG123",
      progressRowsRelinked: 3,
    });
  });

  it("does NOT write an audit log row for the idempotent path (oldUserId === newUserId)", async () => {
    const auditSpy = { called: false, values: null as Record<string, unknown> | null };
    const db = buildMockDb({
      selectRows: [[CERT]],
      progressRows: [],
      auditInsertSpy: auditSpy,
    });

    await relinkCertificate("same-user", "same-user", "platform_mastery", db);
    expect(auditSpy.called).toBe(false);
  });

  it("does NOT write an audit log row when the transaction throws (atomicity)", async () => {
    const auditSpy = { called: false, values: null as Record<string, unknown> | null };
    const db = buildMockDb({
      selectRows: [[CERT], []],
      progressRows: [],
      throwOnProgressUpdate: true,
      auditInsertSpy: auditSpy,
    });

    await expect(
      relinkCertificate("old-user", "new-user", "platform_mastery", db)
    ).rejects.toThrow();
    expect(auditSpy.called).toBe(false);
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
// The progress update is the second UPDATE inside the transaction.
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

// ── §7  Audit log ─────────────────────────────────────────────────────────────
//
// The audit insert runs inside the same transaction as the re-link.  This
// section verifies it is called on success and absent on failure (rolled back).

describe("relinkCertificate — audit log", () => {
  const CERT = { certificateNumber: "MPM-PM-AUD", certificateName: "Audit User", status: "completed" };
  const PROGRESS_ROWS = [{ id: "row-a" }, { id: "row-b" }];

  it("writes an audit log row inside the transaction on successful re-link", async () => {
    const auditSpy = { called: false, values: null as Record<string, unknown> | null };
    const db = buildMockDb({
      selectRows: [[CERT], []],
      progressRows: PROGRESS_ROWS,
      auditInsertSpy: auditSpy,
    });

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db, "admin-123");
    expect(result.ok).toBe(true);
    expect(auditSpy.called).toBe(true);
    expect(auditSpy.values).toMatchObject({
      adminUserId: "admin-123",
      oldUserId: "old-user",
      newUserId: "new-user",
      certificationType: "platform_mastery",
      certificateNumber: "MPM-PM-AUD",
      progressRowsRelinked: 2,
    });
  });

  it("does NOT write an audit log row for the idempotent path (oldUserId === newUserId)", async () => {
    const auditSpy = { called: false, values: null as Record<string, unknown> | null };
    const db = buildMockDb({
      selectRows: [[CERT]],
      progressRows: [],
      auditInsertSpy: auditSpy,
    });

    await relinkCertificate("same-user", "same-user", "platform_mastery", db);
    expect(auditSpy.called).toBe(false);
  });

  it("does NOT write an audit log row when the transaction throws (atomicity)", async () => {
    const auditSpy = { called: false, values: null as Record<string, unknown> | null };
    const db = buildMockDb({
      selectRows: [[CERT], []],
      progressRows: [],
      throwOnProgressUpdate: true,
      auditInsertSpy: auditSpy,
    });

    await expect(
      relinkCertificate("old-user", "new-user", "platform_mastery", db)
    ).rejects.toThrow();
    expect(auditSpy.called).toBe(false);
  });

  it("uses adminUserId='unknown' when no adminUserId is supplied", async () => {
    const auditSpy = { called: false, values: null as Record<string, unknown> | null };
    const db = buildMockDb({
      selectRows: [[CERT], []],
      progressRows: [],
      auditInsertSpy: auditSpy,
    });

    await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(auditSpy.called).toBe(true);
    expect(auditSpy.values?.adminUserId).toBe("unknown");
  });
});

// ── §8  Guard: quiz attempt conflict ──────────────────────────────────────────
//
// certificationQuizAttempts has a unique constraint on
// (user_id, certification_type, module_id).  If newUserId already has quiz
// attempt rows for this cert type the service must return a clear 409 before
// entering the transaction — preventing an opaque DB constraint error and
// leaving the database in a clean state.

describe("relinkCertificate — guard: quiz attempt conflict", () => {
  const SOURCE_CERT = {
    certificateNumber: "MPM-PM-QA",
    certificateName: "Quiz User",
    status: "completed",
  };
  const QUIZ_CONFLICT = { id: "existing-quiz-attempt-id" };

  it("returns 409 when newUserId already has quiz attempt rows for this certificationType", async () => {
    const db = buildMockDb({
      selectRows: [
        [SOURCE_CERT],   // [0] source cert found
        [],              // [1] no dest cert conflict
        [QUIZ_CONFLICT], // [2] quiz attempt conflict → re-link blocked
      ],
    });

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.error).toMatch(/quiz attempt rows/);
  });

  it("error message mentions the unique constraint so the admin knows what to fix", async () => {
    const db = buildMockDb({
      selectRows: [[SOURCE_CERT], [], [QUIZ_CONFLICT]],
    });

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/unique constraint/);
    expect(result.error).toMatch(/certification_quiz_attempts/);
  });

  it("does NOT call dbClient.transaction() when the quiz attempt guard fires", async () => {
    let txCalls = 0;
    const base = buildMockDb({
      selectRows: [[SOURCE_CERT], [], [QUIZ_CONFLICT]],
    });
    const db: CertRelinkDb = {
      ...base,
      transaction: async (fn) => { txCalls++; return fn(buildMockTx([])); },
    };

    await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(txCalls).toBe(0);
  });

  it("proceeds normally (returns ok:true) when newUserId has NO quiz attempt rows", async () => {
    const db = buildMockDb({
      selectRows: [
        [SOURCE_CERT], // [0] source cert found
        [],            // [1] no dest cert conflict
        [],            // [2] no quiz attempt conflict
      ],
    });

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyLinked).toBe(false);
  });

  it("checks for quiz attempt conflict AFTER the cert-row conflict guard, not before", async () => {
    // When the dest cert guard fires (selectRows[1] has a row), the service
    // must return 409 immediately without issuing the quiz attempt query.
    // We verify this by providing a quiz conflict row at [2] — if the service
    // reaches it, it would see a conflict, but the cert guard fires first and
    // the tx is never entered.  The observable effect: txCalls stays 0 and
    // the error message matches the cert guard, not the quiz guard.
    const DEST_CERT_CONFLICT = { id: "dest-cert-id" };
    let txCalls = 0;
    const base = buildMockDb({
      selectRows: [
        [SOURCE_CERT],        // [0] source cert found
        [DEST_CERT_CONFLICT], // [1] dest cert conflict — guard fires here
        [QUIZ_CONFLICT],      // [2] would fire if reached (it should not be)
      ],
    });
    const db: CertRelinkDb = {
      ...base,
      transaction: async (fn) => { txCalls++; return fn(buildMockTx([])); },
    };

    const result = await relinkCertificate("old-user", "new-user", "platform_mastery", db);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(result.error).toMatch(/already has a certificate record/);
    expect(txCalls).toBe(0);
  });
});
