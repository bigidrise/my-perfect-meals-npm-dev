import { and, eq, inArray } from "drizzle-orm";
import {
  MARKETING_COACHING_MODULE_IDS,
  PLATFORM_MASTERY_LESSON_IDS,
  SPECIALIST_CERTIFICATION_TYPE,
  resolveAcademyProgression,
} from "@shared/academyProgression";
import { users } from "@shared/schema";
import { db } from "../db";
import {
  certificationModuleProgress,
  userCertifications,
} from "../db/schema/certifications";
import { hasCompletedLegacyProCareCertification } from "./procareCertification";

const PROCARE_PROFESSIONAL_ROLES = new Set([
  "trainer",
  "physician",
  "dietitian",
  "nurse_practitioner",
]);

export async function getAcademyProgression(userId: string) {
  const [progressRows, certRows, [user]] = await Promise.all([
    db
      .select({
        certificationType: certificationModuleProgress.certificationType,
        moduleId: certificationModuleProgress.moduleId,
        status: certificationModuleProgress.status,
        score: certificationModuleProgress.score,
        videoWatchedPct: certificationModuleProgress.videoWatchedPct,
      })
      .from(certificationModuleProgress)
      .where(
        and(
          eq(certificationModuleProgress.userId, userId),
          inArray(certificationModuleProgress.certificationType, [
            "platform_mastery",
            "marketing_coaching",
            "platform",
            "procare_certification",
          ]),
        ),
      ),
    db
      .select({
        certificationType: userCertifications.certificationType,
        status: userCertifications.status,
        certificateNumber: userCertifications.certificateNumber,
        isCertificationTrack: userCertifications.isCertificationTrack,
      })
      .from(userCertifications)
      .where(
        and(
          eq(userCertifications.userId, userId),
          inArray(userCertifications.certificationType, [
            "platform",
            "platform_mastery",
            "marketing_coaching",
            SPECIALIST_CERTIFICATION_TYPE,
            "procare_certification",
          ]),
        ),
      ),
    db
      .select({ professionalRole: users.professionalRole })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  const completed = (type: string) =>
    certRows.some(
      (row) => row.certificationType === type && row.status === "completed",
    );
  const completedLegacyPlatformMastery = certRows.some(
    (row) =>
      row.certificationType === "platform" &&
      row.status === "completed" &&
      row.isCertificationTrack === true,
  );
  const completedModules = (type: string, required: string[]) =>
    progressRows
      .filter(
        (row) =>
          row.certificationType === type &&
          row.status === "completed" &&
          required.includes(row.moduleId),
      )
      .map((row) => row.moduleId);
  const legacyProCareComplete = hasCompletedLegacyProCareCertification(
    certRows,
    progressRows
      .filter((row) => row.certificationType === "platform")
      .map((row) => ({
        moduleId: row.moduleId,
        status: row.status,
        score: row.score,
        videoWatchedPct: row.videoWatchedPct,
      })),
  );

  return resolveAcademyProgression({
    completedPlatformLessonIds: completedModules(
      "platform_mastery",
      PLATFORM_MASTERY_LESSON_IDS,
    ),
    completedMarketingModuleIds: completedModules(
      "marketing_coaching",
      MARKETING_COACHING_MODULE_IDS,
    ),
    legacyPlatformComplete:
      completed("platform_mastery") || completedLegacyPlatformMastery,
    legacyMarketingComplete: completed("marketing_coaching"),
    specialistCredentialComplete: completed(SPECIALIST_CERTIFICATION_TYPE),
    proCareTrainingComplete:
      completed("procare_certification") || legacyProCareComplete,
    proCareTrainingEligible: PROCARE_PROFESSIONAL_ROLES.has(
      user?.professionalRole ?? "",
    ),
  });
}