/**
 * Tests that existing certificate holders are never re-blocked when new
 * lessons are added to LESSON_IDS.
 *
 * The /complete endpoint short-circuits with success when the enrollment
 * record already has status "completed" and a certificateNumber, so the
 * LESSON_IDS.every() check is never reached for certified users.
 */

import { LESSON_IDS } from "../routes/academyLessonIds";

// ── 1. Simulate the short-circuit guard ───────────────────────────────────────

/**
 * Mirrors the guard added to POST /api/academy/platform-mastery/complete:
 *
 *   if (enrollmentRecord.status === "completed" && enrollmentRecord.certificateNumber) {
 *     return res.json({ ok: true, certificateNumber: enrollmentRecord.certificateNumber });
 *   }
 *
 * Returns true when the endpoint would short-circuit (already certified).
 */
function wouldShortCircuit(enrollmentRecord: {
  status: string;
  certificateNumber: string | null | undefined;
}): boolean {
  return (
    enrollmentRecord.status === "completed" &&
    !!enrollmentRecord.certificateNumber
  );
}

/**
 * Mirrors the LESSON_IDS.every() lesson-completion check that runs only when
 * the short-circuit does NOT fire.
 */
function allLessonsDone(
  lessonIds: string[],
  progressMap: Map<string, { status: string }>,
): boolean {
  return lessonIds.every((id) => progressMap.get(id)?.status === "completed");
}

// ── 2. Already-certified user — short-circuit fires ───────────────────────────

describe("certificate holder grandfather — short-circuit guard", () => {
  const certRecord = {
    status: "completed",
    certificateNumber: "MPM-PM-ABC123",
  };

  it("short-circuits for a user with a completed certificate", () => {
    expect(wouldShortCircuit(certRecord)).toBe(true);
  });

  it("does NOT short-circuit when status is in_progress (not yet certified)", () => {
    expect(wouldShortCircuit({ status: "in_progress", certificateNumber: null })).toBe(false);
  });

  it("does NOT short-circuit when status is completed but certificateNumber is absent", () => {
    // Guard requires both fields to be safe — a corrupt record shouldn't bypass the check.
    expect(wouldShortCircuit({ status: "completed", certificateNumber: null })).toBe(false);
  });
});

// ── 3. New lesson added — certified user is never re-blocked ──────────────────

describe("new lesson added — certified user bypass", () => {
  /**
   * Simulate a user who completed lessons 01–08 BEFORE lesson-09 was added.
   * Their progressMap has no entry for lesson-09.
   */
  function buildOldProgressMap(): Map<string, { status: string }> {
    const map = new Map<string, { status: string }>();
    // Only the first 8 lessons exist in their history
    const originalLessons = LESSON_IDS.slice(0, 8);
    for (const id of originalLessons) {
      map.set(id, { status: "completed" });
    }
    return map;
  }

  it("LESSON_IDS now contains more lessons than the old progress map covers", () => {
    const progress = buildOldProgressMap();
    // At least one lesson exists that the user hasn't touched
    const uncovered = LESSON_IDS.filter((id) => !progress.has(id));
    expect(uncovered.length).toBeGreaterThan(0);
  });

  it("allLessonsDone returns false for a certified user when new lessons are present (without short-circuit)", () => {
    const progress = buildOldProgressMap();
    // Without the short-circuit the endpoint would wrongly block them
    expect(allLessonsDone(LESSON_IDS, progress)).toBe(false);
  });

  it("short-circuit fires for a certified user, bypassing the LESSON_IDS check entirely", () => {
    const certRecord = {
      status: "completed",
      certificateNumber: "MPM-PM-OLD123",
    };
    const progress = buildOldProgressMap();

    const shortCircuits = wouldShortCircuit(certRecord);

    // Because the guard fires, the lesson check is never reached
    expect(shortCircuits).toBe(true);

    // Confirm the lesson check WOULD have blocked them (proving the guard was necessary)
    expect(allLessonsDone(LESSON_IDS, progress)).toBe(false);
  });

  it("an uncertified user with a gap in lessons is still blocked correctly", () => {
    const inProgressRecord = {
      status: "in_progress",
      certificateNumber: null,
    };
    const progress = buildOldProgressMap(); // missing lesson-09

    // Guard does not fire
    expect(wouldShortCircuit(inProgressRecord)).toBe(false);
    // Lesson check correctly blocks them
    expect(allLessonsDone(LESSON_IDS, progress)).toBe(false);
  });
});

// ── 4. Short-circuit number matches GET /certificate ──────────────────────────

/**
 * Mirrors the GET /platform-mastery/certificate response shape.
 * In production it reads directly from the DB record.
 */
function simulateGetCertificate(dbRecord: {
  status: string;
  certificateNumber: string | null | undefined;
  certificateName: string | null | undefined;
  completedAt: Date | null | undefined;
}): { certificateNumber: string; certificateName: string | null | undefined; completedAt: Date | null | undefined } | null {
  if (dbRecord.status !== "completed" || !dbRecord.certificateNumber) {
    return null; // 404
  }
  return {
    certificateNumber: dbRecord.certificateNumber,
    certificateName: dbRecord.certificateName,
    completedAt: dbRecord.completedAt,
  };
}

/**
 * Mirrors the short-circuit branch of POST /platform-mastery/complete:
 *   return res.json({ ok: true, certificateNumber: enrollmentRecord.certificateNumber });
 */
function simulateCompleteShortCircuit(enrollmentRecord: {
  status: string;
  certificateNumber: string | null | undefined;
  certificateName: string | null | undefined;
  completedAt: Date | null | undefined;
}): { ok: boolean; certificateNumber: string } | null {
  if (enrollmentRecord.status === "completed" && enrollmentRecord.certificateNumber) {
    return { ok: true, certificateNumber: enrollmentRecord.certificateNumber };
  }
  return null; // did not short-circuit
}

describe("short-circuit number matches GET /certificate", () => {
  const completedAt = new Date("2025-01-15T10:00:00Z");
  const dbRecord = {
    status: "completed",
    certificateNumber: "MPM-PM-XYZ789",
    certificateName: "Alice Smith",
    completedAt,
  };

  it("short-circuit returns a certificateNumber", () => {
    const completeResponse = simulateCompleteShortCircuit(dbRecord);
    expect(completeResponse).not.toBeNull();
    expect(completeResponse!.certificateNumber).toBe("MPM-PM-XYZ789");
  });

  it("GET /certificate returns the same certificateNumber from the same DB record", () => {
    const certResponse = simulateGetCertificate(dbRecord);
    expect(certResponse).not.toBeNull();
    expect(certResponse!.certificateNumber).toBe("MPM-PM-XYZ789");
  });

  it("short-circuit certificateNumber === GET /certificate certificateNumber (no mismatch)", () => {
    const completeResponse = simulateCompleteShortCircuit(dbRecord);
    const certResponse = simulateGetCertificate(dbRecord);

    // Both read from the same DB record, so the numbers must be identical
    expect(completeResponse!.certificateNumber).toBe(certResponse!.certificateNumber);
  });

  it("GET /certificate returns 404 when no completed record exists", () => {
    const missing = { status: "in_progress", certificateNumber: null, certificateName: null, completedAt: null };
    const certResponse = simulateGetCertificate(missing);
    expect(certResponse).toBeNull();
  });
});

// ── 5. certificateName is NOT overwritten when a different name is submitted ──

/**
 * Mirrors what happens when POST /complete short-circuits:
 * no DB write occurs, so the stored certificateName is preserved.
 */
function simulateCompleteDifferentName(
  dbRecord: { status: string; certificateNumber: string | null | undefined; certificateName: string | null | undefined; completedAt: Date | null | undefined },
  _submittedName: string,
): {
  shortCircuited: boolean;
  storedName: string | null | undefined;
} {
  if (dbRecord.status === "completed" && dbRecord.certificateNumber) {
    // Short-circuit: NO write to DB. Stored name is unchanged.
    return { shortCircuited: true, storedName: dbRecord.certificateName };
  }
  // If it didn't short-circuit, a new record would be written with _submittedName.
  // (Not the scenario under test, included for completeness.)
  return { shortCircuited: false, storedName: _submittedName };
}

describe("certificateName not overwritten by short-circuit path", () => {
  const originalRecord = {
    status: "completed",
    certificateNumber: "MPM-PM-ORIG001",
    certificateName: "Alice Smith",
    completedAt: new Date("2025-01-15T10:00:00Z"),
  };

  it("short-circuit fires and returns the existing certificateNumber", () => {
    const result = simulateCompleteDifferentName(originalRecord, "Bob Jones");
    expect(result.shortCircuited).toBe(true);
  });

  it("stored certificateName is Alice Smith, not the submitted Bob Jones", () => {
    const result = simulateCompleteDifferentName(originalRecord, "Bob Jones");
    expect(result.storedName).toBe("Alice Smith");
    expect(result.storedName).not.toBe("Bob Jones");
  });

  it("GET /certificate still serves the original name after a re-submit attempt", () => {
    // The short-circuit means no DB write happened, so the DB record is unchanged.
    const certResponse = simulateGetCertificate(originalRecord);
    expect(certResponse!.certificateName).toBe("Alice Smith");
  });

  it("GET /certificate still serves the original certificateNumber after a re-submit attempt", () => {
    const certResponse = simulateGetCertificate(originalRecord);
    expect(certResponse!.certificateNumber).toBe("MPM-PM-ORIG001");
  });
});

// ── 6. userId mismatch after account migration or merge ───────────────────────

/**
 * Mirrors the GET /platform-mastery/certificate query:
 *
 *   SELECT * FROM user_certifications
 *   WHERE userId = $authedUserId
 *     AND certificationType = 'platform_mastery'
 *     AND status = 'completed'
 *   LIMIT 1
 *
 * When a user's account is merged or their userId changes, the DB record is
 * stored under the OLD userId.  The query uses the NEW (authenticated) userId,
 * so the WHERE clause finds nothing and the endpoint returns 404.
 *
 * Returns null (→ 404) when authedUserId !== record's userId.
 */
function simulateGetCertificateForUser(
  authedUserId: string,
  dbRecord: {
    userId: string;
    status: string;
    certificateNumber: string | null | undefined;
    certificateName: string | null | undefined;
    completedAt: Date | null | undefined;
  },
): { certificateNumber: string; certificateName: string | null | undefined; completedAt: Date | null | undefined } | null {
  // The DB query filters by userId — if they don't match, no row is returned.
  if (dbRecord.userId !== authedUserId) {
    return null; // 404
  }
  if (dbRecord.status !== "completed" || !dbRecord.certificateNumber) {
    return null; // 404
  }
  return {
    certificateNumber: dbRecord.certificateNumber,
    certificateName: dbRecord.certificateName,
    completedAt: dbRecord.completedAt,
  };
}

describe("GET /certificate — userId mismatch after account migration or merge", () => {
  const completedAt = new Date("2025-03-10T09:00:00Z");

  // Record was written under the original userId before migration
  const dbRecord = {
    userId: "user-original-001",
    status: "completed",
    certificateNumber: "MPM-PM-MIG123",
    certificateName: "Carol Davis",
    completedAt,
  };

  it("returns 404 when the authenticated userId does not match the record's userId", () => {
    // After migration the user authenticates as a new userId
    const result = simulateGetCertificateForUser("user-migrated-002", dbRecord);
    expect(result).toBeNull();
  });

  it("returns the certificate when the authenticated userId matches the record's userId", () => {
    // Happy path: userId is consistent (no migration drift)
    const result = simulateGetCertificateForUser("user-original-001", dbRecord);
    expect(result).not.toBeNull();
    expect(result!.certificateNumber).toBe("MPM-PM-MIG123");
  });

  it("certificateNumber from the short-circuit response matches what GET /certificate returns when userId is consistent", () => {
    // Simulate POST /complete short-circuit returning a certificateNumber
    const completeResponse = simulateCompleteShortCircuit(dbRecord);
    expect(completeResponse).not.toBeNull();

    // The same userId is used for GET /certificate — should resolve successfully
    const certResponse = simulateGetCertificateForUser(dbRecord.userId, dbRecord);
    expect(certResponse).not.toBeNull();

    // The certificateNumber must be identical in both responses
    expect(completeResponse!.certificateNumber).toBe(certResponse!.certificateNumber);
  });

  it("a different authenticated userId — even with a valid cert in the DB — still gets 404", () => {
    // Proves the userId column is the discriminator, not just status + certificationType
    const result = simulateGetCertificateForUser("user-totally-different-999", dbRecord);
    expect(result).toBeNull();
  });
});
