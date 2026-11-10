import type { Request, Response } from "express";
import type { PediatricImageGeneration } from "../../../shared/pediatricMealImage";
import { isFallbackMealImage } from "../../../shared/pediatricMealImage";

export interface SavedPediatricImage {
  id: string;
  recipe: Record<string, any>;
  imageUrl: string | null;
}

interface RecoveryDependencies {
  enabled: () => boolean;
  load: (userId: string, mealId: string, childId: string) => Promise<SavedPediatricImage | null>;
  /** Atomically compare-and-set the saved recipe; cross-process request protection. */
  claim: (userId: string, row: SavedPediatricImage, meta: PediatricImageGeneration) => Promise<boolean>;
  save: (userId: string, row: SavedPediatricImage, imageUrl: string | null, meta: PediatricImageGeneration) => Promise<void>;
  generate: (row: SavedPediatricImage) => Promise<{ imageUrl: string | null; imageGeneration: PediatricImageGeneration }>;
  persist: (url: string, name: string) => Promise<string | null>;
  now?: () => number;
}

export const MANUAL_IMAGE_COOLDOWN_MS = 5 * 60 * 1000;

/** No background work and no client-authored recipe. One click, one saved meal,
 * one atomic claim, at most one paid image attempt. An uncertain request is not retried. */
export function createManualPediatricImageHandler(deps: RecoveryDependencies) {
  return async (req: Request, res: Response) => {
    if (!deps.enabled()) return res.sendStatus(404);
    const userId = (req as any).authUser?.id;
    if (!userId) return res.sendStatus(401);
    const { requestId, childProfileId } = req.body ?? {};
    const mealId = req.params.mealId;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof requestId !== "string" || !uuid.test(requestId) ||
        typeof childProfileId !== "string" || !uuid.test(childProfileId) ||
        typeof mealId !== "string" || !uuid.test(mealId)) {
      return res.status(400).json({ error: "A saved meal, child profile and request identifier are required." });
    }
    try {
      const row = await deps.load(userId, mealId, childProfileId);
      if (!row) return res.status(404).json({ error: "Saved meal unavailable or the child profile changed. Reopen the meal or create a fresh recipe." });
      const prior = row.recipe._imageGeneration as PediatricImageGeneration | undefined;
      // Do not create a new image for a successful photo, even with a new request ID.
      if (row.imageUrl && !isFallbackMealImage(row.imageUrl)) {
        return res.json({ imageUrl: row.imageUrl, imageGeneration: prior, imagePersisted: true });
      }
      if (!prior?.pediatricContext || !Array.isArray(row.recipe.ingredients) || !row.recipe.ingredients.length) {
        return res.status(409).json({ error: "This saved meal needs a new recipe before its image can be regenerated." });
      }
      const now = (deps.now ?? Date.now)();
      const last = prior.manualRetry;
      if (last?.requestId === requestId && last.state === "complete") {
        return res.json({ imageUrl: row.imageUrl, imageGeneration: prior, imagePersisted: false });
      }
      if (last && (last.requestId === requestId || now - last.attemptedAt < MANUAL_IMAGE_COOLDOWN_MS)) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil((MANUAL_IMAGE_COOLDOWN_MS - (now - last.attemptedAt)) / 1000))));
        return res.status(429).json({ error: "An image attempt was already started. Wait five minutes before trying again." });
      }
      const pending: PediatricImageGeneration = {
        ...prior, manualRetry: { requestId, attemptedAt: now, state: "pending" },
      };
      if (!await deps.claim(userId, row, pending)) {
        return res.status(409).json({ error: "This saved meal changed or another image request started. Reopen it before trying again." });
      }
      let outcome: Awaited<ReturnType<RecoveryDependencies["generate"]>>;
      try {
        outcome = await deps.generate(row);
      } catch {
        outcome = { imageUrl: null, imageGeneration: { ...prior, status: "unavailable", failureCode: "unexpected_error" } };
      }
      let permanent: string | null = null;
      if (outcome.imageUrl && !isFallbackMealImage(outcome.imageUrl)) {
        try { permanent = await deps.persist(outcome.imageUrl, row.recipe.recipeName); } catch { /* Explicit storage failure below. */ }
      }
      const meta: PediatricImageGeneration = {
        ...outcome.imageGeneration,
        status: permanent ? "generated" : outcome.imageGeneration.status === "fallback" ? "fallback" : "unavailable",
        manualRetry: { requestId, attemptedAt: now, state: "complete" },
      };
      if (!permanent && outcome.imageUrl && !isFallbackMealImage(outcome.imageUrl)) meta.failureCode = "storage_unavailable";
      if (permanent) { delete meta.fallbackUrl; delete meta.failureCode; }
      await deps.save(userId, row, permanent, meta);
      return res.json({ imageUrl: permanent ?? meta.fallbackUrl ?? null, imageGeneration: meta, imagePersisted: !!permanent });
    } catch {
      // A pending claim survives errors/restarts. Never issue a second paid attempt.
      return res.status(503).json({ error: "The image result could not be saved. Reopen the meal before another attempt." });
    }
  };
}
