import { Router, type Request } from "express";
import { studioStarchPreferencesSchema, type StarchPreferences, type StudioStarchState } from "@shared/starchPreferences";

export class StudioStarchAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export interface StudioStarchAuthority {
  professionalRole(actorId: string): Promise<string | null>;
  businessStudioReady(actorId: string): Promise<boolean>;
  sameOrganization(actorId: string, clientId: string): Promise<void>;
  activeRelationship(actorId: string, clientId: string): Promise<boolean>;
}

export async function authorizeStudioStarchClient(
  authority: StudioStarchAuthority, actorId: string, clientId: string,
) {
  if (!actorId) throw new StudioStarchAccessError(401, "Authentication required");
  if (!clientId || clientId === actorId) throw new StudioStarchAccessError(403, "Select an authorized client");
  const role = await authority.professionalRole(actorId);
  // Persisted occupations are canonical. "doctor"/"coach" are display/request
  // aliases, not permission-bearing account roles.
  const businessOperator = role === "business" && await authority.businessStudioReady(actorId);
  if (!role || (!["physician", "trainer"].includes(role) && !businessOperator)) {
    throw new StudioStarchAccessError(403, "An authorized Physician or Trainer Studio is required to manage this client's starch plan.");
  }
  await authority.sameOrganization(actorId, clientId);
  if (!await authority.activeRelationship(actorId, clientId)) {
    throw new StudioStarchAccessError(403, "No active client relationship");
  }
}

interface Dependencies {
  developmentEnabled(): boolean;
  authorize(actorId: string, clientId: string): Promise<void>;
  read(clientId: string): Promise<StudioStarchState>;
  save(actorId: string, clientId: string, preferences: StarchPreferences): Promise<void>;
  audit(req: Request, actorId: string, clientId: string): void;
}

/** Mounted inside the existing authenticated/MFA/ProCare professional workflow. */
export function createStudioStarchPreferencesRouter(deps: Dependencies) {
  const router = Router({ mergeParams: true });
  router.use((_req, res, next) => {
    if (!deps.developmentEnabled()) return res.status(404).json({ error: "Not found" });
    next();
  });
  async function handle(req: Request, res: any, saving: boolean) {
    const actorId = (req as any).authUser?.id ?? "";
    const clientId = String(req.params.clientId ?? "");
    try {
      await deps.authorize(actorId, clientId);
      if (saving) {
        const parsed = studioStarchPreferencesSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Choose 1–6 starch meals and a valid timing preference. No other fields may be changed here." });
        if (parsed.data.starchDistributionStrategy === "workout") {
          const before = await deps.read(clientId);
          if (!before.workoutTimingAvailable && before.savedPreferences.starchDistributionStrategy !== "workout") {
            return res.status(400).json({ error: "Around-workout timing requires this client's training schedule." });
          }
        }
        await deps.save(actorId, clientId, parsed.data);
        deps.audit(req, actorId, clientId);
      }
      const state = await deps.read(clientId);
      if (state.clientUserId !== clientId) throw new Error("Client prescription identity mismatch");
      return res.json(state);
    } catch (error) {
      if (error instanceof StudioStarchAccessError) return res.status(error.status).json({ error: error.message });
      if ((error as any)?.code === "ORG_ISOLATION_VIOLATION") return res.status(403).json({ error: "Client belongs to another organization" });
      return res.status(500).json({ error: saving
        ? "The client's starch plan could not be saved and confirmed. Reload or retry before continuing."
        : "The client's starch plan could not be loaded." });
    }
  }
  router.get("/", (req, res) => { void handle(req, res, false); });
  router.patch("/", (req, res) => { void handle(req, res, true); });
  return router;
}
