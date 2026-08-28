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

router.use(developmentOnly);

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