/**
 * certRelinkService.ts
 *
 * Atomically re-links a user_certifications row (and all associated
 * certification_module_progress rows) from oldUserId to newUserId.
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
 * Both UPDATE statements run inside a single DB transaction so a partial
 * failure leaves no orphaned state.
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
 * Both DB mutations (user_certifications + certification_module_progress) run
 * inside a single transaction.  If the progress update fails for any reason,
 * the cert update is rolled back automatically, leaving the DB in its
 * original state.
 *
 * @param dbClient - DB client to use; the route passes the real `db` object.
 *                   Tests pass a mock that implements CertRelinkDb.
 */
export async function relinkCertificate(
  oldUserId: string,
  newUserId: string,
  certificationType: string,
  dbClient: CertRelinkDb
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

  // ── Pre-flight reads (outside the transaction — read-only) ───────────────

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
      error: "Source certificate is not completed — only completed certificates can be re-linked",
    };
  }

  // Anti-theft: newUserId must not already own a cert row for this type
  const [targetConflict] = await dbClient
    .select({ id: userCertifications.id })
    .from(userCertifications)
    .where(
      and(
        eq(userCertifications.userId, newUserId),
        eq(userCertifications.certificationType, certificationType)
      )
    )
    .limit(1);

  if (targetConflict) {
    return {
      ok: false,
      status: 409,
      error: "newUserId already has a certificate record for this certificationType — re-link cannot proceed to avoid overwriting an existing record",
    };
  }

  // ── Atomic re-link (single transaction) ──────────────────────────────────
  //
  // Both UPDATEs execute inside one transaction.  If the progress update
  // fails (e.g. uniqueness conflict, transient DB error), Postgres rolls back
  // the cert update automatically — no partial migration state is possible.

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

    return { progressRowsRelinked: progressResult.length, quizAttemptRowsRelinked: quizResult.length };
  });

  console.info(
    `[certRelinkService] re-linked ${oldUserId} → ${newUserId} (${certificationType}), ` +
      `cert: ${sourceCert.certificateNumber}, progress rows: ${progressRowsRelinked}, ` +
      `quiz attempt rows: ${quizAttemptRowsRelinked}`
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
