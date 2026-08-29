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
import { resolveHydrationDay } from "../services/hydration/hydrationDay";
import {
  createHydrationHelp,
  getHydrationHubState,
  HYDRATION_BARRIER_CODES,
  recordHydrationInterventionEvent,
  saveHydrationBarriers,
  saveHydrationPreferences,
  type HydrationBarrierCode,
} from "../services/hydration/hydrationHubService";
import {
  activateLiquidNutritionProtocol,
  createLiquidNutritionProtocol,
  getCurrentLiquidNutritionProtocol,
} from "../services/hydration/liquidNutritionProtocolService";
import { liquidNutritionProtocolInputSchema } from "@shared/hydration/fourDoor";
import {
  issueHydrationHandoff,
  verifyHydrationHandoff,
} from "../services/hydration/hydrationHandoffService";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  athleticHydrationCoachingInputSchema,
  findProhibitedTrainerHydrationContent,
} from "@shared/hydration/professional";
import {
  getActiveAthleticHydrationCoaching,
  revokeAthleticHydrationCoaching,
  saveAthleticHydrationCoaching,
} from "../services/hydration/athleticHydrationCoachingService";

const router = express.Router();

const hydrationHandoffSchema = z.object({
  door: z.enum(["everyday", "athletic", "liquid_nutrition"]),
  description: z.string().trim().min(1).max(1200),
}).strict();

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
    const requestedDate = req.query.date
      ? hydrationDateSchema.parse(req.query.date)
      : undefined;
    const { timezone, localDate } = await resolveHydrationDay({
      subjectUserId: owner.subjectUserId,
      localDate: requestedDate,
      now,
    });
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
    const requestedDate = req.query.date
      ? hydrationDateSchema.parse(req.query.date)
      : undefined;
    const { timezone, localDate } = await resolveHydrationDay({
      subjectUserId: owner.subjectUserId,
      localDate: requestedDate,
    });
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

router.post("/hydration/hub/handoff", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const input = hydrationHandoffSchema.parse(req.body);
    const handoff = issueHydrationHandoff({
      userId,
      door: input.door,
      description: input.description,
    });
    return res.status(201).json({
      token: handoff.token,
      door: handoff.payload.door,
      description: handoff.payload.description,
      expiresAt: new Date(handoff.payload.expiresAt).toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid Hydration handoff request" });
    }
    console.error("[hydration] handoff creation failed", error);
    return res.status(500).json({ error: "Failed to create Hydration handoff" });
  }
});

router.get("/hydration/hub/handoff/:token", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const payload = verifyHydrationHandoff({
      token: req.params.token,
      userId,
    });
    return res.json({
      door: payload.door,
      description: payload.description,
      expiresAt: new Date(payload.expiresAt).toISOString(),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "HYDRATION_HANDOFF_WRONG_ACCOUNT") {
      return res.status(403).json({ error: "This Hydration handoff belongs to another account" });
    }
    if (code === "HYDRATION_HANDOFF_EXPIRED") {
      return res.status(410).json({ error: "This Hydration handoff has expired" });
    }
    return res.status(400).json({ error: "Invalid Hydration handoff" });
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
    await saveHydrationPreferences({
      userId,
      consented: input.consented!,
      preferences: input.preferences ?? {},
      optedOut: input.optedOut ?? false,
    });
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
    const options = await createHydrationHelp({
      userId,
      barriers: input.barriers ?? [],
      preferences: input.preferences ?? {},
    });
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
      eventType: input.eventType!,
      metadata: input.metadata,
    });
    if (!recorded) return res.status(404).json({ error: "Hydration intervention not found" });
    res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid intervention event" });
    console.error("[hydration] intervention event failed", error);
    res.status(500).json({ error: "Failed to record intervention outcome" });
  }
});

const liquidProtocolActivationSchema = z.object({
  confirm: z.literal(true),
}).strict();

router.get("/hydration/hub/liquid-protocol", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const owner = await authorizeSubject(authReq, res, req.query.clientId);
    if (!owner) return;
    const { timezone, localDate } = await resolveHydrationDay({
      subjectUserId: owner.subjectUserId,
    });
    const protocol = await getCurrentLiquidNutritionProtocol({
      userId: owner.subjectUserId,
      localDate,
    });
    res.json({ protocol, timezone, localDate });
  } catch (error) {
    console.error("[hydration] liquid protocol read failed", error);
    res.status(500).json({ error: "Failed to load Liquid Nutrition Support" });
  }
});

router.post("/hydration/hub/liquid-protocol", requireAuth, async (req, res) => {
  try {
    const userId = requireSelfHydrationWrite(req as AuthenticatedRequest, res);
    if (!userId) return;
    const input = liquidNutritionProtocolInputSchema.parse(req.body);
    const protocol = await createLiquidNutritionProtocol({
      userId,
      values: input,
    });
    res.status(201).json({ protocol });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid Liquid Nutrition Support instructions" });
    }
    console.error("[hydration] liquid protocol create failed", error);
    res.status(500).json({ error: "Failed to save Liquid Nutrition Support instructions" });
  }
});

router.post("/hydration/hub/liquid-protocol/:protocolId/activate", requireAuth, async (req, res) => {
  try {
    const userId = requireSelfHydrationWrite(req as AuthenticatedRequest, res);
    if (!userId) return;
    liquidProtocolActivationSchema.parse(req.body);
    const { localDate } = await resolveHydrationDay({ subjectUserId: userId });
    const result = await activateLiquidNutritionProtocol({
      userId,
      protocolId: req.params.protocolId,
      localDate,
    });
    if (result.ok === false) {
      if (result.reason === "not_found") {
        return res.status(404).json({ error: "Liquid Nutrition Support instructions not found" });
      }
      if (result.reason === "expired") {
        return res.status(409).json({ error: "These instructions have expired. Add a current instruction before activating a plan." });
      }
      return res.status(409).json({
        error: "Clarification is needed before these instructions can become active.",
        unresolvedItems: result.unresolvedItems || [],
      });
    }
    res.json({ protocol: result.protocol });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Confirm the reviewed instructions before activation" });
    }
    console.error("[hydration] liquid protocol activation failed", error);
    res.status(500).json({ error: "Failed to activate Liquid Nutrition Support" });
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

function requireHydrationProfessionalRole(
  allowed: readonly string[],
): express.RequestHandler {
  return async (req, res, next) => {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const [provider] = await db
      .select({ professionalRole: users.professionalRole })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!provider?.professionalRole || !allowed.includes(provider.professionalRole)) {
      return res.status(403).json({
        error: "This Hydration control is not available for your professional role",
      });
    }
    next();
  };
}

const clinicalHydrationGate = [
  ...clinicianGate,
  requireHydrationProfessionalRole(["physician", "dietitian", "nurse_practitioner"]),
] as const;

const trainerHydrationGate = [
  ...clinicianGate,
  requireHydrationProfessionalRole(["trainer"]),
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
      const requestedDate = req.query.date
        ? hydrationDateSchema.parse(req.query.date)
        : undefined;
      const { timezone, localDate } = await resolveHydrationDay({
        subjectUserId: owner.subjectUserId,
        localDate: requestedDate,
        now,
      });
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
  ...clinicalHydrationGate,
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
  ...clinicalHydrationGate,
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
  ...clinicalHydrationGate,
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
    res.json({ ok: true });
  },
);

router.get(
  "/pro/clients/:clientId/athletic-hydration-coaching",
  ...trainerHydrationGate,
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const owner = await authorizeSubject(authReq, res, req.params.clientId);
      if (!owner || owner.mode !== "delegated") return;
      const guidance = await getActiveAthleticHydrationCoaching(owner.subjectUserId);
      res.json({ guidance });
    } catch (error) {
      if (handleOrgIsolationError(error, res)) return;
      console.error("[hydration] trainer guidance read failed", error);
      res.status(500).json({ error: "Failed to load Athletic Hydration coaching" });
    }
  },
);

router.put(
  "/pro/clients/:clientId/athletic-hydration-coaching",
  ...trainerHydrationGate,
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const owner = await authorizeSubject(authReq, res, req.params.clientId);
      if (!owner || owner.mode !== "delegated") return;
      const guidanceInput = athleticHydrationCoachingInputSchema.parse(req.body);
      const prohibitedCode = findProhibitedTrainerHydrationContent(guidanceInput);
      if (prohibitedCode) {
        return res.status(422).json({
          error:
            "Trainer Hydration coaching cannot include clinical fluid dosing, electrolyte prescriptions, dehydration, water-cut, sauna, diuretic/laxative, or weigh-in manipulation strategies.",
          code: prohibitedCode,
        });
      }
      const coachUserId = authReq.authUser!.id;
      const organizationId = await getUserOrgId(coachUserId);
      const guidance = await saveAthleticHydrationCoaching({
        subjectUserId: owner.subjectUserId,
        coachUserId,
        organizationId,
        guidance: guidanceInput,
      });
      logAudit({
        actor: coachUserId,
        target: owner.subjectUserId,
        orgId: organizationId,
        action: "WRITE",
        resourceType: "athletic_hydration_coaching",
        table: "hydration_athletic_coaching_guidance",
        resourceId: guidance.id,
        route: req.path,
        ip: getClientIp(req),
        meta: {
          trainingContext: guidance.trainingContext,
          emphasis: guidance.emphasis,
        },
      });
      res.json({ guidance });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid Athletic Hydration coaching guidance" });
      }
      if (handleOrgIsolationError(error, res)) return;
      console.error("[hydration] trainer guidance save failed", error);
      res.status(500).json({ error: "Failed to save Athletic Hydration coaching" });
    }
  },
);

router.delete(
  "/pro/clients/:clientId/athletic-hydration-coaching/:guidanceId",
  ...trainerHydrationGate,
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const owner = await authorizeSubject(authReq, res, req.params.clientId);
      if (!owner || owner.mode !== "delegated") return;
      const revoked = await revokeAthleticHydrationCoaching({
        subjectUserId: owner.subjectUserId,
        guidanceId: req.params.guidanceId,
        coachUserId: authReq.authUser!.id,
      });
      if (!revoked) return res.status(404).json({ error: "Active guidance not found" });
      res.json({ ok: true });
    } catch (error) {
      if (handleOrgIsolationError(error, res)) return;
      console.error("[hydration] trainer guidance revoke failed", error);
      res.status(500).json({ error: "Failed to remove Athletic Hydration coaching" });
    }
  },
);

export default router;