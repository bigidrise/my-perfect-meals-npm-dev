import express from "express";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { requireProAccess } from "../middleware/requireProAccess";
import { requirePhase1Cert } from "../middleware/requirePhase1Cert";
import { requirePhase2Training } from "../middleware/requirePhase2Training";
import { requireMfa } from "../middleware/requireMfa";
import { verifyPhysicianClientAccess } from "../services/procareAccessService";
import { getUserOrgId, handleOrgIsolationError } from "../lib/orgIsolation";
import { logAudit, getClientIp } from "../lib/auditLog";
import { hydrationDateSchema } from "@shared/hydration/schemas";
import {
  HYDRATION_DIRECTIVE_TARGET_KINDS,
} from "@shared/hydration/numericPolicy";
import {
  createHydrationClinicianDirective,
  getHydrationClinicianDirectiveResolution,
  revokeHydrationClinicianDirective,
} from "../services/hydration/hydrationClinicianDirectiveService";
import { resolveHydrationCenterState } from "../services/hydration/hydrationCenterService";
import {
  createHydrationHelp,
  getHydrationHubState,
  HYDRATION_BARRIER_CODES,
  recordHydrationInterventionEvent,
  saveHydrationBarriers,
  saveHydrationPreferences,
  type HydrationBarrierCode,
} from "../services/hydration/hydrationHubService";

const router = express.Router();

const timezoneSchema = z.string().trim().min(1).max(100).refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}, "Invalid timezone");

const directiveSchema = z
  .object({
    targetKind: z.enum(HYDRATION_DIRECTIVE_TARGET_KINDS),
    targetMl: z.number().int().positive().nullable().default(null),
    minimumMl: z.number().int().positive().nullable().default(null),
    maximumMl: z.number().int().positive().nullable().default(null),
    effectiveAt: z.string().datetime({ offset: true }),
    reviewAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    reasonCode: z.string().trim().min(1).max(100),
    rationaleCode: z.string().trim().min(1).max(100),
    sourceReference: z.string().trim().min(1).max(500),
    consentReference: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((value, ctx) => {
    const validShape =
      (value.targetKind === "point" &&
        value.targetMl !== null &&
        value.minimumMl === null &&
        value.maximumMl === null) ||
      (value.targetKind === "range" &&
        value.targetMl === null &&
        value.minimumMl !== null &&
        value.maximumMl !== null &&
        value.minimumMl <= value.maximumMl) ||
      (value.targetKind === "floor" &&
        value.targetMl === null &&
        value.minimumMl !== null &&
        value.maximumMl === null) ||
      (value.targetKind === "ceiling" &&
        value.targetMl === null &&
        value.minimumMl === null &&
        value.maximumMl !== null);
    if (!validShape) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Directive values do not match targetKind",
      });
    }
    const effectiveAt = new Date(value.effectiveAt);
    const reviewAt = new Date(value.reviewAt);
    const expiresAt = new Date(value.expiresAt);
    if (!(effectiveAt < reviewAt && reviewAt <= expiresAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected effectiveAt < reviewAt <= expiresAt",
      });
    }
  });

function developmentOnly(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }
  next();
}

async function authorizeSubject(
  req: AuthenticatedRequest,
  res: express.Response,
  requestedClientId: unknown,
): Promise<{
  subjectUserId: string;
  mode: "self" | "delegated";
  authorizationReference?: string;
} | null> {
  const authenticatedUserId = req.authUser?.id;
  if (!authenticatedUserId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const clientId =
    typeof requestedClientId === "string" && requestedClientId.trim()
      ? requestedClientId.trim()
      : authenticatedUserId;
  if (clientId === authenticatedUserId) {
    return { subjectUserId: authenticatedUserId, mode: "self" };
  }
  try {
    if (!(await verifyPhysicianClientAccess(authenticatedUserId, clientId))) {
      res.status(403).json({ error: "Not authorized for this client" });
      return null;
    }
    return {
      subjectUserId: clientId,
      mode: "delegated",
      authorizationReference: `procare:${authenticatedUserId}:${clientId}`,
    };
  } catch (error) {
    if (handleOrgIsolationError(error, res)) return null;
    res.status(503).json({ error: "Authorization check unavailable" });
    return null;
  }
}

router.get("/hydration/evidence", requireAuth, async (_req, res) => {
  try {
    const raw = await readFile(
      path.resolve(process.cwd(), "research/sources.json"),
      "utf8",
    );
    const registry = JSON.parse(raw) as {
      policyVersion: string;
      sources: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(registry.sources) || registry.sources.length !== 32) {
      throw new Error("HYDRATION_EVIDENCE_REGISTRY_INVALID");
    }
    res.json({
      policyVersion: registry.policyVersion,
      sources: registry.sources.map((source) => ({
        key: source.key,
        title: source.title,
        organizationOrAuthor: source.organizationOrAuthor,
        publicationDate: source.publicationDate,
        url: source.url,
        citation: source.citation,
        evidenceTier: source.evidenceTier,
        evidenceLevel: source.evidenceLevel,
        populationScope: source.populationScope,
        ruleSupported: source.ruleSupported,
      })),
    });
  } catch (error) {
    console.error("[hydration] evidence registry failed", error);
    res.status(500).json({ error: "Hydration evidence is unavailable" });
  }
});

router.get("/hydration/state", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (
      typeof req.query.clientId === "string" &&
      req.query.clientId !== authReq.authUser?.id
    ) {
      return res.status(403).json({
        error: "Use the gated ProCare Hydration state endpoint",
      });
    }
    const owner = await authorizeSubject(authReq, res, req.query.clientId);
    if (!owner) return;
    const now = new Date();
    const timezone = timezoneSchema.parse(
      req.query.timezone || "America/Chicago",
    );
    const localDate = hydrationDateSchema.parse(
      req.query.date ||
        new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now),
    );
    const state = await resolveHydrationCenterState({
      subjectUserId: owner.subjectUserId,
      localDate,
      timezone,
      access: {
        authenticatedUserId: authReq.authUser!.id,
        subjectUserId: owner.subjectUserId,
        mode: owner.mode,
        authorizationStatus: "allowed",
        ...(owner.authorizationReference
          ? { authorizationReference: owner.authorizationReference }
          : {}),
      },
      now,
    });
    res.json(state);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid Hydration state request" });
    }
    console.error("[hydration] state failed", error);
    res.status(500).json({ error: "Failed to resolve Hydration state" });
  }
});

const hydrationHubPreferencesSchema = z.object({
  consented: z.boolean(),
  optedOut: z.boolean().default(false),
  preferences: z.record(z.string(), z.unknown()).default({}),
}).strict();

const hydrationHubBarriersSchema = z.object({
  barriers: z.array(z.object({
    barrierCode: z.enum(HYDRATION_BARRIER_CODES),
    note: z.string().trim().max(500).optional(),
  }).strict()).max(9),
}).strict();

const hydrationHubEventSchema = z.object({
  eventType: z.enum(["accepted", "dismissed", "opened", "completed", "logged", "rated"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

router.get("/hydration/hub", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const owner = await authorizeSubject(authReq, res, req.query.clientId);
    if (!owner) return;
    const timezone = timezoneSchema.parse(req.query.timezone || "America/Chicago");
    const localDate = hydrationDateSchema.parse(
      req.query.date || new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date()),
    );
    const state = await getHydrationHubState({
      subjectUserId: owner.subjectUserId,
      localDate,
      timezone,
      access: {
        authenticatedUserId: authReq.authUser!.id,
        subjectUserId: owner.subjectUserId,
        mode: owner.mode,
        authorizationStatus: "allowed",
        ...(owner.authorizationReference ? { authorizationReference: owner.authorizationReference } : {}),
      },
    });
    res.json(state);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid Hydration Hub request" });
    console.error("[hydration] hub state failed", error);
    res.status(500).json({ error: "Failed to resolve Hydration Hub" });
  }
});

function requireSelfHydrationWrite(req: AuthenticatedRequest, res: express.Response) {
  const authenticatedUserId = req.authUser?.id;
  if (!authenticatedUserId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (typeof req.body?.clientId === "string" && req.body.clientId !== authenticatedUserId) {
    res.status(403).json({ error: "Hydration Hub setup can only be changed by the account owner" });
    return null;
  }
  return authenticatedUserId;
}

router.put("/hydration/hub/preferences", requireAuth, async (req, res) => {
  try {
    const userId = requireSelfHydrationWrite(req as AuthenticatedRequest, res);
    if (!userId) return;
    const input = hydrationHubPreferencesSchema.parse(req.body);
    await saveHydrationPreferences({ userId, ...input });
    res.json({ ok: true, consented: input.consented && !input.optedOut });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid Hydration Hub preferences" });
    console.error("[hydration] preferences save failed", error);
    res.status(500).json({ error: "Failed to save Hydration Hub preferences" });
  }
});

router.put("/hydration/hub/barriers", requireAuth, async (req, res) => {
  try {
    const userId = requireSelfHydrationWrite(req as AuthenticatedRequest, res);
    if (!userId) return;
    const input = hydrationHubBarriersSchema.parse(req.body);
    await saveHydrationBarriers({ userId, barriers: input.barriers as Array<{ barrierCode: HydrationBarrierCode; note?: string }> });
    res.json({ ok: true, barriers: input.barriers });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid Hydration Hub barriers" });
    console.error("[hydration] barriers save failed", error);
    res.status(500).json({ error: "Failed to save Hydration Hub barriers" });
  }
});

router.post("/hydration/hub/help", requireAuth, async (req, res) => {
  try {
    const userId = requireSelfHydrationWrite(req as AuthenticatedRequest, res);
    if (!userId) return;
    const input = z.object({
      barriers: z.array(z.enum(HYDRATION_BARRIER_CODES)).max(9).default([]),
      preferences: z.record(z.string(), z.unknown()).default({}),
    }).strict().parse(req.body);
    const options = await createHydrationHelp({ userId, ...input });
    res.json({ options });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid Hydration Hub help request" });
    if ((error as { code?: string }).code === "HYDRATION_HUB_CONSENT_REQUIRED") {
      return res.status(403).json({ error: "Save Hydration Hub consent before requesting personalized options" });
    }
    console.error("[hydration] help generation failed", error);
    res.status(500).json({ error: "Failed to create practical hydration options" });
  }
});

router.post("/hydration/hub/interventions/:interventionId/events", requireAuth, async (req, res) => {
  try {
    const userId = requireSelfHydrationWrite(req as AuthenticatedRequest, res);
    if (!userId) return;
    const input = hydrationHubEventSchema.parse(req.body);
    const recorded = await recordHydrationInterventionEvent({
      userId,
      interventionId: req.params.interventionId,
      ...input,
    });
    if (!recorded) return res.status(404).json({ error: "Hydration intervention not found" });
    res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid intervention event" });
    console.error("[hydration] intervention event failed", error);
    res.status(500).json({ error: "Failed to record intervention outcome" });
  }
});

// Keep clinician directive and delegated ProCare hydration endpoints gated
// until numeric Hydration activation receives separate production approval.
router.use(developmentOnly);

const clinicianGate = [
  requireAuth,
  requireProAccess,
  requirePhase1Cert,
  requirePhase2Training,
  requireMfa,
] as const;

router.get(
  "/pro/clients/:clientId/hydration-state",
  ...clinicianGate,
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const owner = await authorizeSubject(authReq, res, req.params.clientId);
      if (!owner || owner.mode !== "delegated") return;
      const now = new Date();
      const timezone = timezoneSchema.parse(
        req.query.timezone || "America/Chicago",
      );
      const localDate = hydrationDateSchema.parse(
        req.query.date ||
          new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now),
      );
      const state = await resolveHydrationCenterState({
        subjectUserId: owner.subjectUserId,
        localDate,
        timezone,
        access: {
          authenticatedUserId: authReq.authUser!.id,
          subjectUserId: owner.subjectUserId,
          mode: "delegated",
          authorizationStatus: "allowed",
          authorizationReference: owner.authorizationReference!,
        },
        now,
      });
      res.json(state);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid Hydration state request" });
      }
      console.error("[hydration] delegated state failed", error);
      res.status(500).json({ error: "Failed to resolve Hydration state" });
    }
  },
);

router.get(
  "/pro/clients/:clientId/hydration-directive",
  ...clinicianGate,
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const owner = await authorizeSubject(authReq, res, req.params.clientId);
    if (!owner || owner.mode !== "delegated") return;
    const resolution = await getHydrationClinicianDirectiveResolution(
      owner.subjectUserId,
    );
    if (resolution.conflict) {
      return res.status(409).json({
        error: "Multiple active directives require review",
        code: "HYDRATION_DIRECTIVE_CONFLICT",
      });
    }
    const directive = resolution.directive;
    logAudit({
      actor: authReq.authUser!.id,
      target: owner.subjectUserId,
      orgId: await getUserOrgId(authReq.authUser!.id),
      action: "READ",
      resourceType: "hydration_clinician_directive",
      table: "hydration_clinician_directives",
      resourceId: directive?.id,
      route: req.path,
      ip: getClientIp(req),
    });
    res.json({ directive });
  },
);

router.put(
  "/pro/clients/:clientId/hydration-directive",
  ...clinicianGate,
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const owner = await authorizeSubject(authReq, res, req.params.clientId);
      if (!owner || owner.mode !== "delegated") return;
      const input = directiveSchema.parse(req.body);
      const authorityUserId = authReq.authUser!.id;
      const organizationId = await getUserOrgId(authorityUserId);
      const directive = await createHydrationClinicianDirective({
        subjectUserId: owner.subjectUserId,
        organizationId,
        authorityUserId,
        targetKind: input.targetKind,
        targetMl: input.targetMl,
        minimumMl: input.minimumMl,
        maximumMl: input.maximumMl,
        effectiveAt: new Date(input.effectiveAt),
        reviewAt: new Date(input.reviewAt),
        expiresAt: new Date(input.expiresAt),
        reasonCode: input.reasonCode,
        rationaleCode: input.rationaleCode,
        sourceReference: input.sourceReference,
        consentReference: input.consentReference,
      });
      logAudit({
        actor: authorityUserId,
        target: owner.subjectUserId,
        orgId: organizationId,
        action: "WRITE",
        resourceType: "hydration_clinician_directive",
        table: "hydration_clinician_directives",
        resourceId: directive.id,
        route: req.path,
        ip: getClientIp(req),
        meta: { targetKind: directive.targetKind },
      });
      res.json({ directive });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid clinician directive" });
      }
      if ((error as { code?: string })?.code === "23505") {
        return res.status(409).json({
          error: "An active directive already exists; retry after review",
          code: "HYDRATION_DIRECTIVE_CONFLICT",
        });
      }
      console.error("[hydration] directive create failed", error);
      res.status(500).json({ error: "Failed to save clinician directive" });
    }
  },
);

router.delete(
  "/pro/clients/:clientId/hydration-directive/:directiveId",
  ...clinicianGate,
  async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const owner = await authorizeSubject(authReq, res, req.params.clientId);
    if (!owner || owner.mode !== "delegated") return;
    const revoked = await revokeHydrationClinicianDirective(
      owner.subjectUserId,
      req.params.directiveId,
      authReq.authUser!.id,
    );
    if (!revoked) {
      return res.status(404).json({ error: "Active directive not found" });
    }
    logAudit({
      actor: authReq.authUser!.id,
      target: owner.subjectUserId,
      orgId: await getUserOrgId(authReq.authUser!.id),
      action: "WRITE",
      resourceType: "hydration_clinician_directive",
      table: "hydration_clinician_directives",
      resourceId: req.params.directiveId,
      route: req.path,
      ip: getClientIp(req),
      meta: { operation: "revoke" },
    });
    res.status(204).end();
  },
);

export default router;