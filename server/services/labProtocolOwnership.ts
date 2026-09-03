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
      if (cond) labDriven.push(cond);
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
export async function getPhysicianLockStatus(userId: string): Promise<boolean> {
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
  } catch {
    return false;
  }
}
