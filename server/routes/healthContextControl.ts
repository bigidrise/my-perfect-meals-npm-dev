import { Router } from "express";
import { z } from "zod";
import { db, pool } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { checkLegalAcceptance } from "../services/legalCheck";
import { exactFoodDirectiveSchema } from "../../shared/clinicalMealAuthority";
import { HEALTH_PROTOCOLS, type HealthProtocol } from "../../shared/healthProtocolState";
import { isSelfSelectableSupport } from "../../shared/nutritionSupportOptions";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import {
  readHealthContextView, decideLegacySupport, decideEarlierAntiPreference, markMedicationInformationPast,
  reconcileLegacyClaim,
} from "../services/healthProtocols/healthContextControl";
import {
  recordSubjectClinicalReview, recordSubjectHardFoodRestriction,
  recordProviderFoodDirective, discontinueProviderFoodDirective,
  verifyLegacyClaimAsProviderDirective,
} from "../services/healthProtocols/clinicalDirectiveStorage";
import {
  setUserNutritionSupport, discontinueLabProtocol, decideSystemRecommendation, recordLabDecision,
} from "../services/healthProtocols/persistence";

const protocol = z.enum(HEALTH_PROTOCOLS);
const decision = z.object({ current: z.boolean() }).strict();
const support = z.object({ enabled: z.boolean() }).strict();
const recommendation = z.object({ accept: z.boolean() }).strict();
const uuid = z.string().uuid();
const sourceReview = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("history_only") }).strict(),
  z.object({ decision: z.literal("historical") }).strict(),
  z.object({ decision: z.literal("current_guidance") }).strict(),
  z.object({ decision: z.literal("unresolved") }).strict(),
  z.object({ decision: z.literal("current_hard_restriction"), rule: exactFoodDirectiveSchema }).strict(),
]);
const providerDirective = z.object({
  sourceId: uuid, membershipId: uuid, rule: exactFoodDirectiveSchema,
  effectiveAt: z.string().datetime(), expiresAt: z.string().datetime().nullable().optional(),
  supersedesId: uuid.nullable().optional(),
}).strict();

async function authorizeClinicalReview(actorId: string, subjectId: string) {
  const [professional] = await db.select({
    role: users.professionalRole, training: users.procareTrainingCompleted,
  }).from(users).where(eq(users.id, actorId)).limit(1);
  if (professional?.role !== "physician" || professional.training !== true) return false;
  const [providerLegal, patientLegal] = await Promise.all([
    checkLegalAcceptance(actorId, "physician"),
    checkLegalAcceptance(subjectId, "patient_physician"),
  ]);
  return providerLegal.allAccepted && patientLegal.allAccepted;
}

export default function healthContextControlRouter() {
  const router = Router();
  // DEV only even if this module is accidentally mounted in another entrypoint.
  router.use((_req, res, next) => {
    if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
      return res.status(404).json({ message: "Not found" });
    }
    next();
  });
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      return res.json(await readHealthContextView((req as unknown as AuthenticatedRequest).authUser.id));
    } catch {
      return res.status(503).json({ message: "Your support settings could not be loaded." });
    }
  });

  router.put("/support/:protocol", async (req, res) => {
    const parsed = protocol.safeParse(req.params.protocol);
    const body = support.safeParse(req.body);
    if (!parsed.success || !body.success) {
      return res.status(400).json({ message: "Choose a valid support setting." });
    }
    const subjectUserId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      // Never create an inactive personal source for a clinical protocol just
      // because a client sent "off": that would make a subsequent "on" look
      // like reactivation without ever confirming historical evidence.
      const current = await readHealthContextView(subjectUserId);
      const previouslyPersonal = current.supports.find((item) => item.protocol === parsed.data)
        ?.sources.some((source) => source.kind === "you");
      if (!isSelfSelectableSupport(parsed.data) && (!previouslyPersonal || body.data.enabled)) {
        return res.status(409).json({
          message: "This support requires a separate review before it can be changed.",
        });
      }
      if (!body.data.enabled && !previouslyPersonal) {
        return res.json({
          ...current,
          message: "No personal support was on. Other sources are unchanged.",
        });
      }
      await setUserNutritionSupport({
        actorUserId: subjectUserId, subjectUserId,
        protocol: parsed.data as HealthProtocol, enabled: body.data.enabled,
      });
      const view = await readHealthContextView(subjectUserId);
      const item = view.supports.find((entry) => entry.protocol === parsed.data)!;
      return res.json({
        ...view,
        message: !body.data.enabled && item.status === "active"
          ? "Your personal support is off. Another current source is still recorded separately."
          : body.data.enabled ? "Your personal nutrition support choice was saved for Development meal guidance."
            : "Your personal nutrition support choice was turned off for Development meal guidance.",
      });
    } catch {
      return res.status(503).json({ message: "Your support change could not be saved." });
    }
  });

  router.post("/earlier-profile/:sourceId/decision", async (req, res) => {
    const sourceId = uuid.safeParse(req.params.sourceId);
    const body = decision.safeParse(req.body);
    if (!sourceId.success || !body.success) {
      return res.status(400).json({ message: "Choose a valid confirmation." });
    }
    const subjectUserId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      return res.json(await decideLegacySupport({
        actorUserId: subjectUserId, subjectUserId,
        sourceId: sourceId.data, current: body.data.current,
      }));
    } catch {
      return res.status(404).json({ message: "That earlier profile entry is unavailable." });
    }
  });

  router.post("/earlier-anti-preference/decision", async (req, res) => {
    const body = decision.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: "Choose a valid confirmation." });
    const subjectUserId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      const view = await decideEarlierAntiPreference({
        actorUserId: subjectUserId, subjectUserId, current: body.data.current,
      });
      return res.json({
        ...view,
        message: "Your future support choice was saved. The current Anti-Inflammatory meal preference above is unchanged until you change it and save your profile.",
      });
    } catch {
      return res.status(404).json({ message: "That earlier preference is unavailable." });
    }
  });

  router.post("/lab/:protocol/discontinue", async (req, res) => {
    const parsed = protocol.safeParse(req.params.protocol);
    if (!parsed.success || (req.body && Object.keys(req.body).length)) {
      return res.status(400).json({ message: "Choose a valid support setting." });
    }
    const subjectUserId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      await discontinueLabProtocol({
        actorUserId: subjectUserId, subjectUserId, protocol: parsed.data,
      });
      return res.json(await readHealthContextView(subjectUserId));
    } catch {
      return res.status(503).json({ message: "Your support change could not be saved." });
    }
  });

  router.post("/lab-recommendation/:id/review", async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success || (req.body && Object.keys(req.body).length)) {
      return res.status(400).json({ message: "Choose a valid earlier lab recommendation." });
    }
    const subjectUserId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      // The service verifies the recommendation, its lab and exact subject.
      // No client-supplied acceptance status or clinical source is trusted.
      await recordLabDecision({
        actorUserId: subjectUserId, subjectUserId, recommendationId: id.data,
      });
      return res.json(await readHealthContextView(subjectUserId));
    } catch {
      return res.status(404).json({ message: "That lab recommendation is unavailable." });
    }
  });

  router.post("/medication/:sourceId/past", async (req, res) => {
    const sourceId = uuid.safeParse(req.params.sourceId);
    if (!sourceId.success || (req.body && Object.keys(req.body).length)) {
      return res.status(400).json({ message: "Choose valid medication information." });
    }
    const subjectUserId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      return res.json(await markMedicationInformationPast({
        actorUserId: subjectUserId, subjectUserId, sourceId: sourceId.data,
      }));
    } catch {
      return res.status(404).json({ message: "That medication information is unavailable." });
    }
  });

  router.post("/suggestion/:sourceId/decision", async (req, res) => {
    const sourceId = uuid.safeParse(req.params.sourceId);
    const body = recommendation.safeParse(req.body);
    if (!sourceId.success || !body.success) {
      return res.status(400).json({ message: "Choose a valid decision." });
    }
    const subjectUserId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      await decideSystemRecommendation({
        actorUserId: subjectUserId, subjectUserId,
        recommendationId: sourceId.data, accept: body.data.accept,
      });
      return res.json(await readHealthContextView(subjectUserId));
    } catch {
      return res.status(404).json({ message: "That recommendation is unavailable." });
    }
  });

  router.post("/source/:sourceId/review", async (req, res) => {
    const sourceId = uuid.safeParse(req.params.sourceId);
    const body = sourceReview.safeParse(req.body);
    if (!sourceId.success || !body.success) {
      return res.status(400).json({ message: "Choose a review outcome and an exact rule when required." });
    }
    const subjectUserId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      const { rows } = await pool.query(
        `SELECT source_kind FROM health_protocol_sources WHERE id=$1 AND subject_user_id=$2`,
        [sourceId.data, subjectUserId],
      );
      const kind = rows[0]?.source_kind;
      if (kind === "legacy_migrated") {
        if (body.data.decision === "historical") {
          return res.json(await reconcileLegacyClaim({
            actorUserId: subjectUserId, subjectUserId, sourceId: sourceId.data,
            decision: "history_only",
          }));
        }
        return res.json(await reconcileLegacyClaim({
          actorUserId: subjectUserId, subjectUserId, sourceId: sourceId.data,
          decision: body.data.decision, ...("rule" in body.data ? { rule: body.data.rule } : {}),
        }));
      }
      if (kind !== "user" && kind !== "lab") {
        return res.status(403).json({ message: "This source needs a separate authorized clinical review." });
      }
      if (body.data.decision === "current_hard_restriction") {
        await recordSubjectHardFoodRestriction({
          actorUserId: subjectUserId, subjectUserId, sourceId: sourceId.data,
          rule: body.data.rule, effectiveAt: new Date(), reasonCode: "subject_exact_review",
        });
      } else {
        await recordSubjectClinicalReview({
          actorUserId: subjectUserId, subjectUserId, sourceId: sourceId.data,
          disposition: body.data.decision, reasonCode: "subject_explicit_review",
        });
      }
      return res.json(await readHealthContextView(subjectUserId));
    } catch {
      return res.status(503).json({ message: "Your review could not be verified or saved. No meal rules changed." });
    }
  });

  // Physician actions are deliberately separate from patient review and only
  // exist on this DEV-gated router. The storage service rechecks exact source
  // ownership, verified active clinic membership and subject inside its lock.
  router.get("/provider/:subjectId/sources", async (req, res) => {
    const actorId = (req as unknown as AuthenticatedRequest).authUser.id;
    const subjectId = req.params.subjectId;
    try {
      if (!await authorizeClinicalReview(actorId, subjectId)) {
        return res.status(403).json({ message: "Current physician training and legal consent are required." });
      }
      const { rows } = await pool.query(
        `SELECT p.id, p.protocol_key, p.care_relationship_id,
                d.id AS directive_id, d.rule,
                (SELECT r.disposition FROM health_protocol_review_decisions r
                 WHERE r.directive_id=d.id ORDER BY r.decided_at DESC, r.id DESC LIMIT 1) AS disposition
         FROM health_protocol_sources p
         JOIN studio_memberships sm ON sm.id=p.care_relationship_id
         JOIN studios s ON s.id=sm.studio_id
         LEFT JOIN health_protocol_food_directives d ON d.source_id=p.id
         WHERE p.subject_user_id=$1 AND p.owner_user_id=$2
           AND p.source_kind='provider' AND p.status='active'
           AND sm.client_user_id=$1 AND sm.status='active' AND sm.is_archived=false
           AND s.owner_user_id=$2 AND s.type='clinic' AND s.status='active'
           AND s.verification_status='verified'
         ORDER BY p.created_at, d.created_at, d.id`,
        [subjectId, actorId],
      );
      const { rows: legacyClaims } = await pool.query(
        `SELECT DISTINCT p.id, p.protocol_key, sm.id AS membership_id
         FROM health_protocol_sources p
         JOIN studio_memberships sm ON sm.client_user_id=p.subject_user_id
         JOIN studios s ON s.id=sm.studio_id
         WHERE p.subject_user_id=$1 AND p.source_kind='legacy_migrated'
           AND p.status='pending_review' AND sm.status='active' AND sm.is_archived=false
           AND s.owner_user_id=$2 AND s.type='clinic' AND s.status='active'
           AND s.verification_status='verified'
         ORDER BY p.id, sm.id`,
        [subjectId, actorId],
      );
      return res.json({ shadowOnly: true, sources: rows, legacyClaims });
    } catch {
      return res.status(503).json({ message: "Provider sources could not be verified." });
    }
  });

  router.post("/provider/:subjectId/legacy/:legacySourceId/verify", async (req, res) => {
    const legacySourceId = uuid.safeParse(req.params.legacySourceId);
    const body = providerDirective.omit({ sourceId: true, supersedesId: true }).safeParse(req.body);
    if (!legacySourceId.success || !body.success) {
      return res.status(400).json({ message: "A pending claim, verified relationship, and exact instruction are required." });
    }
    const actorId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      if (!await authorizeClinicalReview(actorId, req.params.subjectId)) {
        return res.status(403).json({ message: "Current physician training and legal consent are required." });
      }
      const result = await verifyLegacyClaimAsProviderDirective({
        actorUserId: actorId, subjectUserId: req.params.subjectId,
        legacySourceId: legacySourceId.data, membershipId: body.data.membershipId,
        rule: body.data.rule, effectiveAt: new Date(body.data.effectiveAt),
        expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : null,
      });
      return res.json({ shadowOnly: true, ...result });
    } catch {
      return res.status(503).json({ message: "Clinical ownership or exact instruction could not be verified. No claim was reconciled." });
    }
  });

  router.post("/provider/:subjectId/directive", async (req, res) => {
    const body = providerDirective.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: "An exact current instruction is required." });
    const actorId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      if (!await authorizeClinicalReview(actorId, req.params.subjectId)) {
        return res.status(403).json({ message: "Current physician training and legal consent are required." });
      }
      const id = await recordProviderFoodDirective({
        actorUserId: actorId, subjectUserId: req.params.subjectId,
        sourceId: body.data.sourceId, membershipId: body.data.membershipId,
        rule: body.data.rule, effectiveAt: new Date(body.data.effectiveAt),
        expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : null,
        supersedesId: body.data.supersedesId,
        reasonCode: "provider_exact_review",
      });
      return res.json({ shadowOnly: true, directiveId: id });
    } catch {
      return res.status(503).json({ message: "Provider ownership or directive could not be verified. Nothing was changed." });
    }
  });

  router.post("/provider/:subjectId/directive/:directiveId/discontinue", async (req, res) => {
    const body = z.object({ sourceId: uuid, membershipId: uuid }).strict().safeParse(req.body);
    const directiveId = uuid.safeParse(req.params.directiveId);
    if (!body.success || !directiveId.success) return res.status(400).json({ message: "Choose a valid directive." });
    const actorId = (req as unknown as AuthenticatedRequest).authUser.id;
    try {
      if (!await authorizeClinicalReview(actorId, req.params.subjectId)) {
        return res.status(403).json({ message: "Current physician training and legal consent are required." });
      }
      await discontinueProviderFoodDirective({
        actorUserId: actorId, subjectUserId: req.params.subjectId,
        sourceId: body.data.sourceId, membershipId: body.data.membershipId,
        directiveId: directiveId.data,
      });
      return res.json({ shadowOnly: true, status: "historical" });
    } catch {
      return res.status(503).json({ message: "The provider directive could not be updated." });
    }
  });
  return router;
}