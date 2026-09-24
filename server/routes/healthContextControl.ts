import { Router } from "express";
import { z } from "zod";
import { HEALTH_PROTOCOLS, type HealthProtocol } from "../../shared/healthProtocolState";
import { isSelfSelectableSupport } from "../../shared/nutritionSupportOptions";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import {
  readHealthContextView, decideLegacySupport, decideEarlierAntiPreference, markMedicationInformationPast,
} from "../services/healthProtocols/healthContextControl";
import {
  setUserNutritionSupport, discontinueLabProtocol, decideSystemRecommendation, recordLabDecision,
} from "../services/healthProtocols/persistence";

const protocol = z.enum(HEALTH_PROTOCOLS);
const decision = z.object({ current: z.boolean() }).strict();
const support = z.object({ enabled: z.boolean() }).strict();
const recommendation = z.object({ accept: z.boolean() }).strict();
const uuid = z.string().uuid();

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
          : body.data.enabled ? "Your personal nutrition support choice was saved. Current meals are unchanged."
            : "Your personal nutrition support choice was turned off. Current meals are unchanged.",
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
  return router;
}