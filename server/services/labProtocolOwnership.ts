/**
 * labProtocolOwnership.ts — Phase 5
 *
 * Determines which specialty conditions are currently DRIVEN by lab values
 * vs. self-selected by the user. Used to enforce the three-tier hierarchy:
 *
 *   Tier 1 — Physician:  active studio membership with assigned builder
 *   Tier 2 — Lab values: conditions resolved from clinical lab records
 *   Tier 3 — Self:       user's own onboarding / Edit Profile selection
 *
 * Tier 2 conditions can only be changed through the biometrics lab entry
 * flow. The Edit Profile PATCH endpoint must reject attempts to remove them.
 *
 * Panel-specific resolution:
 *   Thyroid panel   → uses the most recent lab record that has ANY thyroid value
 *   Hormone panel   → uses the most recent lab record that has ANY hormone value
 *   Primary panel   → uses the most recent lab record that has ANY primary-protocol value
 * This correctly handles users who log different panels on different dates.
 *
 * Phase 5 additions:
 *   - Thyroid subtype conditions (hypothyroid, hyperthyroid, hashimotos) driven by labs
 *   - Hormone conditions (hormone-optimization, menopause, perimenopause) driven by labs
 *   - DHEA-S, estradiol, progesterone, LH, FSH, SHBG included in lab lookup
 */

import { db } from '../db';
import { clinicalLabs } from '../db/schema/clinicalLabs';
import { studioMemberships } from '../db/schema/studio';
import { users } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { clinicalProtocolRecommendations } from '../db/schema/clinicalProtocolRecommendations';
import {
  resolveProtocolFromLabs,
  resolveThyroidFromLabs,
  resolveHormoneFromLabs,
} from './resolveProtocolFromLabs';

/** Maps resolver protocol IDs → specialtyCondition values used in the users table */
const PROTOCOL_TO_CONDITION: Record<string, string> = {
  'kidney-disease': 'renal',
  'heart-failure':  'cardiac',
  'liver-disease':  'liver-disease',
  'liver-support':  'liver-support',
};

// A subject's explicit off decision is distinct from a lab measurement or a
// downgrade recommendation. Keep it in the existing clinical decision audit
// so a later profile save cannot silently reactivate the same lab signal.
const CARDIAC_LAB_CHOICE_REASON = 'subject_disabled_lab_cardiac_support';

export async function discontinueLabDrivenCardiac(userId: string): Promise<string[]> {
  if (await getPhysicianLockStatus(userId, true)) {
    throw new Error('Physician-controlled protocols cannot be changed here.');
  }
  const conditions = await db.transaction(async (tx) => {
    const [user] = await tx.select({
      specialtyConditions: users.specialtyConditions,
      specialtyCondition: users.specialtyCondition,
    }).from(users).where(eq(users.id, userId)).for('update').limit(1);
    if (!user) throw new Error('Profile unavailable.');

    const next = ((user.specialtyConditions as string[] | null) ??
      (user.specialtyCondition ? [user.specialtyCondition] : []))
      .filter((condition) => condition !== 'cardiac');
    await tx.insert(clinicalProtocolRecommendations).values({
      userId, recommendedProtocol: 'heart-failure', status: 'removed',
      reason: CARDIAC_LAB_CHOICE_REASON,
    });
    await tx.update(users).set({
      specialtyConditions: next,
      specialtyCondition: next[0] ?? null,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
    return next;
  });
  return conditions;
}

/**
 * Returns the list of specialty condition values that are currently driven
 * by the user's clinical lab records. An empty array means all conditions
 * are self-selected (Tier 3 — user controls via Edit Profile).
 *
 * Returned conditions may include:
 *   Primary protocols: renal, cardiac, liver-disease, liver-support
 *   Thyroid base:      thyroid-support
 *   Thyroid subtypes:  hashimotos, hypothyroid, hyperthyroid
 *   Hormone base/sub:  hormone-optimization, menopause, perimenopause
 */
export async function getLabDrivenConditions(userId: string): Promise<string[]> {
  const recentLabs = await db
    .select()
    .from(clinicalLabs)
    .where(eq(clinicalLabs.userId, userId as any))
    .orderBy(desc(clinicalLabs.recordedAt))
    .limit(10);

  if (recentLabs.length === 0) return [];

  // Most recent record with any thyroid value (including rT3)
  const thyroidLab = recentLabs.find(r =>
    r.tsh != null || r.freeT4 != null || r.freeT3 != null ||
    r.tpoAntibodies != null || r.thyroglobulinAntibodies != null ||
    r.reverseT3 != null
  );

  // Most recent record with any hormone/sex hormone value
  const hormoneLab = recentLabs.find(r =>
    r.totalTestosterone != null || r.freeTestosterone != null ||
    r.estradiol != null || r.progesterone != null ||
    r.lh != null || r.fsh != null || r.dheaS != null
  );

  // Most recent record with any primary-protocol value
  const primaryLab = recentLabs.find(r =>
    r.alt != null || r.ast != null || r.bilirubin != null || r.albumin != null ||
    r.creatinine != null || r.bun != null || r.ldl != null ||
    r.bloodPressureSystolic != null || r.ejectionFraction != null
  );

  const labDriven: string[] = [];

  // ── Primary protocol ──────────────────────────────────────────────────────
  if (primaryLab) {
    const signal = resolveProtocolFromLabs({
      alt: primaryLab.alt, ast: primaryLab.ast,
      bilirubin: primaryLab.bilirubin, albumin: primaryLab.albumin,
      creatinine: primaryLab.creatinine, bun: primaryLab.bun,
      ldl: primaryLab.ldl,
      bloodPressureSystolic: primaryLab.bloodPressureSystolic,
      ejectionFraction: primaryLab.ejectionFraction,
    });
    if (signal?.protocol) {
      const cond = PROTOCOL_TO_CONDITION[signal.protocol];
      if (cond === 'cardiac') {
        const [choice] = await db.select({ status: clinicalProtocolRecommendations.status })
          .from(clinicalProtocolRecommendations)
          .where(and(
            eq(clinicalProtocolRecommendations.userId, userId),
            eq(clinicalProtocolRecommendations.recommendedProtocol, 'heart-failure'),
            eq(clinicalProtocolRecommendations.reason, CARDIAC_LAB_CHOICE_REASON),
          ))
          .orderBy(desc(clinicalProtocolRecommendations.id))
          .limit(1);
        if (!choice || choice.status !== 'removed') labDriven.push(cond);
      } else if (cond) {
        labDriven.push(cond);
      }
    }
  }

  // ── Thyroid panel — base + subtypes ──────────────────────────────────────
  if (thyroidLab) {
    const signal = resolveThyroidFromLabs({
      tsh: thyroidLab.tsh,
      freeT4: thyroidLab.freeT4,
      freeT3: thyroidLab.freeT3,
      tpoAntibodies: thyroidLab.tpoAntibodies,
      thyroglobulinAntibodies: thyroidLab.thyroglobulinAntibodies,
      reverseT3: thyroidLab.reverseT3,
    });
    if (signal.hasThyroidIndicators) {
      labDriven.push('thyroid-support');
      // Push specific thyroid subtypes if detected
      for (const subtype of signal.subtypeConditions) {
        if (!labDriven.includes(subtype)) {
          labDriven.push(subtype);
        }
      }
    }
  }

  // ── Hormone panel — hormone-optimization / menopause / perimenopause ──────
  if (hormoneLab) {
    const signal = resolveHormoneFromLabs({
      totalTestosterone: hormoneLab.totalTestosterone,
      freeTestosterone:  hormoneLab.freeTestosterone,
      dheaS:             hormoneLab.dheaS,
      estradiol:         hormoneLab.estradiol,
      progesterone:      hormoneLab.progesterone,
      lh:                hormoneLab.lh,
      fsh:               hormoneLab.fsh,
      shbg:              hormoneLab.shbg,
    });
    if (signal.hasHormoneIndicators) {
      for (const cond of signal.conditions) {
        if (!labDriven.includes(cond)) {
          labDriven.push(cond);
        }
      }
    }
  }

  return labDriven;
}

/**
 * Returns true if the user has an active, non-archived studio membership
 * with an assigned builder — meaning a physician controls their protocol.
 */
export async function getPhysicianLockStatus(userId: string, failClosed = false): Promise<boolean> {
  try {
    const rows = await db
      .select({ assignedBuilder: studioMemberships.assignedBuilder })
      .from(studioMemberships)
      .where(
        and(
          eq(studioMemberships.clientUserId, userId as any),
          eq(studioMemberships.status, 'active'),
          eq(studioMemberships.isArchived, false)
        )
      )
      .limit(1);
    return rows.length > 0 && !!rows[0].assignedBuilder;
  } catch (error) {
    if (failClosed) throw error;
    return false;
  }
}
