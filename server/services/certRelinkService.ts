/**
 * certRelinkService.ts
 *
 * Atomically re-links a user_certifications row (and all associated
 * certification_module_progress and certification_quiz_attempts rows) from
 * oldUserId to newUserId.
 *
 * Used by the admin POST /api/admin/cert/relink-user endpoint to recover
 * certificate access for users whose userId changed after an account
 * migration or merge.
 *
 * Guards:
 *  • Source cert must exist under oldUserId with status="completed"
 *  • newUserId must not already own a cert row for the same certificationType
 *    (anti-theft: prevents one user from stealing another's certificate)
 *  • oldUserId === newUserId → idempotent no-op, returns success immediately
 *
 * The re-link (cert row, progress rows, quiz attempt rows) and the audit log
 * insert all run inside a single transaction so a partial failure rolls back
 * the entire operation — including the audit entry — leaving no orphaned state.
 *
 * NOTE: This module does NOT import `db` directly. The caller must supply a
 * `dbClient` that implements the CertRelinkDb interface.  This keeps the
 * module import-free of DB setup code so it can be tested without a live
 * database connection.
 */

import { eq, and } from "drizzle-orm";
import {
  userCertifications,
  certificationModuleProgress,
  certificationQuizAttempts,
  certRelinkAuditLog,
} from "../db/schema/certifications";

// ── Minimal DB interface required by this service ─────────────────────────────
//
// We do NOT import the full Drizzle `db` type here so that callers in test
// files can import this module without triggering the database pool
// initialisation.  The route file (which already imports db) passes it in.

export interface CertRelinkDb {
  select: (...args: any[]) => any;
  transaction: <T>(fn: (tx: CertRelinkTx) => Promise<T>) => Promise<T>;
}

export interface CertRelinkTx {
  update: (...args: any[]) => any;
  insert: (...args: any[]) => any;
}

// ── Result types ──────────────────────────────────────────────────────────────

export type RelinkResult =
  | {
      ok: true;
      alreadyLinked: boolean;
      certificateNumber: string | null | undefined;
      certificateName: string | null | undefined;
      progressRowsRelinked: number;
      quizAttemptRowsRelinked: number;
    }
  | {
      ok: false;
      status: 400 | 404 | 409;
      error: string;
    };

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Re-links a completed certificate from oldUserId to newUserId.
 *
 * The cert update, progress update, quiz attempt update, and audit log insert
 * all run inside a single transaction.  If any step fails, Postgres rolls back
 * the entire operation automatically — leaving the DB in its original state
 * with no partial migration or missing audit record.
 *
 * @param adminUserId - ID of the admin who initiated the re-link (for audit).
 * @param dbClient    - DB client to use; the route passes the real `db` object.
 *                      Tests pass a mock that implements CertRelinkDb.
 */
export async function relinkCertificate(
  oldUserId: string,
  newUserId: string,
  certificationType: string,
  dbClient: CertRelinkDb,
  adminUserId: string = "unknown"
): Promise<RelinkResult> {
  if (!oldUserId?.trim() || !newUserId?.trim() || !certificationType?.trim()) {
    return {
      ok: false,
      status: 400,
      error: "oldUserId, newUserId, and certificationType are all required",
    };
  }

  // ── Idempotent: source === destination ───────────────────────────────────
  if (oldUserId === newUserId) {
    const [existing] = await dbClient
      .select({
        certificateNumber: userCertifications.certificateNumber,
        certificateName: userCertifications.certificateName,
        status: userCertifications.status,
      })
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.userId, newUserId),
          eq(userCertifications.certificationType, certificationType)
        )
      )
      .limit(1);

    if (!existing || existing.status !== "completed") {
      return {
        ok: false,
        status: 404,
        error: "No completed certificate found for oldUserId",
      };
    }
    return {
      ok: true,
      alreadyLinked: true,
      certificateNumber: existing.certificateNumber,
      certificateName: existing.certificateName,
      progressRowsRelinked: 0,
      quizAttemptRowsRelinked: 0,
    };
  }

  // ── Guard: source cert must exist and be completed ───────────────────────
  const [sourceCert] = await dbClient
    .select({
      certificateNumber: userCertifications.certificateNumber,
      certificateName: userCertifications.certificateName,
      status: userCertifications.status,
    })
    .from(userCertifications)
    .where(
      and(
        eq(userCertifications.userId, oldUserId),
        eq(userCertifications.certificationType, certificationType)
      )
    )
    .limit(1);

  if (!sourceCert) {
    return {
      ok: false,
      status: 404,
      error: "No certificate record found for oldUserId with the given certificationType",
    };
  }

  if (sourceCert.status !== "completed") {
    return {
      ok: false,
      status: 409,
      error: `Source certificate is not completed (current status: ${sourceCert.status}) — re-link is only permitted for completed certificates`,
    };
  }

  // ── Guard: destination must not already have a cert row ──────────────────
  const [destCert] = await dbClient
    .select({ id: userCertifications.id })
    .from(userCertifications)
    .where(
      and(
        eq(userCertifications.userId, newUserId),
        eq(userCertifications.certificationType, certificationType)
      )
    )
    .limit(1);

  if (destCert) {
    return {
      ok: false,
      status: 409,
      error: "newUserId already has a certificate record for this certificationType — re-link cannot proceed to avoid overwriting an existing record",
    };
  }

  // ── Guard: destination must not already have quiz attempt rows ────────────
  //
  // certificationQuizAttempts has a unique constraint on
  // (user_id, certification_type, module_id).  If newUserId already has any
  // quiz attempt rows for this cert type (e.g. they started the certification
  // independently before the re-link was requested), the UPDATE inside the
  // transaction would hit that constraint and throw an opaque DB error.
  //
  // We detect this up front and return a clear 409 so the admin knows exactly
  // why the re-link was blocked — no silent constraint violation, no partial
  // transaction, no orphaned state.
  const [destQuizAttempt] = await dbClient
    .select({ id: certificationQuizAttempts.id })
    .from(certificationQuizAttempts)
    .where(
      and(
        eq(certificationQuizAttempts.userId, newUserId),
        eq(certificationQuizAttempts.certificationType, certificationType)
      )
    )
    .limit(1);

  if (destQuizAttempt) {
    return {
      ok: false,
      status: 409,
      error:
        "newUserId already has quiz attempt rows for this certificationType — re-link cannot proceed because moving the source rows would violate the unique constraint on certification_quiz_attempts (user_id, certification_type, module_id). An admin must manually remove or reassign the conflicting rows before re-linking.",
    };
  }

  // ── Atomic re-link + audit (single transaction) ───────────────────────────
  //
  // All four writes run inside one transaction:
  //   1. Move the cert enrollment row to newUserId
  //   2. Move all module-progress rows to newUserId
  //   3. Move all quiz attempt rows to newUserId
  //   4. Write a durable audit log entry
  //
  // If any step fails, Postgres rolls back everything — including the audit
  // insert — so there is never a partial migration or a re-link without a
  // corresponding audit record.

  const { progressRowsRelinked, quizAttemptRowsRelinked } = await dbClient.transaction(async (tx) => {
    // 1. Move the enrollment / certificate row
    await tx
      .update(userCertifications)
      .set({ userId: newUserId, updatedAt: new Date() })
      .where(
        and(
          eq(userCertifications.userId, oldUserId),
          eq(userCertifications.certificationType, certificationType)
        )
      );

    // 2. Move all module-progress rows for this user+cert combination
    const progressResult = await tx
      .update(certificationModuleProgress)
      .set({ userId: newUserId })
      .where(
        and(
          eq(certificationModuleProgress.userId, oldUserId),
          eq(certificationModuleProgress.certificationType, certificationType)
        )
      )
      .returning({ id: certificationModuleProgress.id });

    // 3. Move all quiz attempt rows for this user+cert combination
    const quizResult = await tx
      .update(certificationQuizAttempts)
      .set({ userId: newUserId })
      .where(
        and(
          eq(certificationQuizAttempts.userId, oldUserId),
          eq(certificationQuizAttempts.certificationType, certificationType)
        )
      )
      .returning({ id: certificationQuizAttempts.id });

    // 4. Write audit log inside the same transaction — guaranteed to exist
    //    iff and only iff the re-link itself committed.
    await tx.insert(certRelinkAuditLog).values({
      adminUserId,
      oldUserId,
      newUserId,
      certificationType,
      certificateNumber: sourceCert.certificateNumber ?? null,
      progressRowsRelinked: progressResult.length,
    });

    return {
      progressRowsRelinked: progressResult.length,
      quizAttemptRowsRelinked: quizResult.length,
    };
  });

  console.info(
    `[certRelinkService] re-linked ${oldUserId} → ${newUserId} (${certificationType}), ` +
      `cert: ${sourceCert.certificateNumber}, progress rows: ${progressRowsRelinked}, ` +
      `quiz attempt rows: ${quizAttemptRowsRelinked}, admin: ${adminUserId}`
  );

  return {
    ok: true,
    alreadyLinked: false,
    certificateNumber: sourceCert.certificateNumber,
    certificateName: sourceCert.certificateName,
    progressRowsRelinked,
    quizAttemptRowsRelinked,
  };
}
